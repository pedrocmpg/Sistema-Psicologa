import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import LoginForm from '../components/admin/LoginForm';
import AvailabilityManager from '../components/admin/AvailabilityManager';
import PendingRequests from '../components/admin/PendingRequests';
import ConfirmedList from '../components/admin/ConfirmedList';
import RecusadosList from '../components/admin/RecusadosList';
import ResumoPainel from '../components/admin/ResumoPainel';
import WhatsAppConfig from '../components/admin/WhatsAppConfig';
import { TriangleAlert } from '../components/icons';
import { profissional } from '../config/profissional';
import AdminNav from '../components/admin/AdminNav';
import { ABAS, type Aba } from '../components/admin/abas';
import { useResumoPainel } from '../hooks/useResumoPainel';
import { useConfigWhatsApp } from '../hooks/useConfigWhatsApp';
import { useStatusWhatsApp } from '../hooks/useStatusWhatsApp';

function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();

  // Aba ativa fica na URL (?aba=...), assim recarregar ou voltar não perde onde estava.
  const abaParam = searchParams.get('aba');
  const aba: Aba = ABAS.some((a) => a.id === abaParam) ? (abaParam as Aba) : 'pendentes';

  function setAba(nova: Aba) {
    setSearchParams(nova === 'pendentes' ? {} : { aba: nova });
    window.scrollTo({ top: 0 });
  }

  function bump() {
    setRefreshTick((t) => t + 1);
  }

  const numeros = useResumoPainel(refreshTick, !!session);
  const whatsapp = useConfigWhatsApp(!!session);
  const statusWhatsApp = useStatusWhatsApp(!!session);
  const whatsappCaiu = !!whatsapp.config?.ativo && statusWhatsApp.saude?.conectado === false;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregandoSessao(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, novaSessao) => {
      setSession(novaSessao);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (carregandoSessao) {
    return (
      <div className="admin-shell admin-loading" role="status" aria-label="Carregando painel">
        <span className="spinner spinner--lg" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="admin-shell">
        <LoginForm />
      </div>
    );
  }

  const hoje = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());

  return (
    <div className="admin-shell">
      <AdminNav aba={aba} onChange={setAba} pendentes={numeros?.pendentes ?? 0} onSair={() => supabase.auth.signOut()} />

      <main className="admin-main">
        {whatsappCaiu && (
          <div className="admin-banner" role="alert">
            <TriangleAlert size={20} strokeWidth={2} aria-hidden="true" />
            <span>
              <strong>WhatsApp automático desconectado.</strong> As mensagens não estão saindo. Reconecte o
              número (QR code) e, enquanto isso, use "Enviar manualmente" nos agendamentos.
            </span>
            {aba !== 'config' && (
              <button type="button" className="btn btn-sm admin-banner__btn" onClick={() => setAba('config')}>
                Ver conexão
              </button>
            )}
          </div>
        )}

        <header className="admin-main__header">
          <h1 className="admin-main__title">{saudacao()}, {profissional.primeiroNome}</h1>
          <p className="admin-main__date">{hoje}</p>
        </header>

        <ResumoPainel numeros={numeros} onNavegar={setAba} />

        {aba === 'pendentes' && <PendingRequests onChange={bump} />}
        {aba === 'confirmados' && <ConfirmedList onChange={bump} configWhatsApp={whatsapp.config} />}
        {aba === 'recusados' && <RecusadosList configWhatsApp={whatsapp.config} />}
        {aba === 'agenda' && <AvailabilityManager />}
        {aba === 'config' && <WhatsAppConfig whatsapp={whatsapp} status={statusWhatsApp} />}
      </main>
    </div>
  );
}
