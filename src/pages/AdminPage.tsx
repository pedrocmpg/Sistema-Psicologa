import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import LoginForm from '../components/admin/LoginForm';
import AvailabilityManager from '../components/admin/AvailabilityManager';
import PendingRequests from '../components/admin/PendingRequests';
import ConfirmedList from '../components/admin/ConfirmedList';

type Aba = 'agenda' | 'pendentes' | 'confirmados';

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [aba, setAba] = useState<Aba>('pendentes');

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
    return <div className="admin-shell" />;
  }

  if (!session) {
    return (
      <div className="admin-shell">
        <LoginForm />
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <div className="admin-topbar__inner">
          <span className="admin-topbar__title">Painel — Daniele Walczak</span>
          <button className="btn btn-ghost btn-sm" onClick={() => supabase.auth.signOut()}>
            Sair
          </button>
        </div>
      </div>

      <div className="container">
        <div className="admin-tabs">
          <button
            className={`admin-tab ${aba === 'pendentes' ? 'is-active' : ''}`}
            onClick={() => setAba('pendentes')}
          >
            Pedidos pendentes
          </button>
          <button className={`admin-tab ${aba === 'agenda' ? 'is-active' : ''}`} onClick={() => setAba('agenda')}>
            Agenda
          </button>
          <button
            className={`admin-tab ${aba === 'confirmados' ? 'is-active' : ''}`}
            onClick={() => setAba('confirmados')}
          >
            Confirmados
          </button>
        </div>

        {aba === 'agenda' && <AvailabilityManager />}
        {aba === 'pendentes' && <PendingRequests />}
        {aba === 'confirmados' && <ConfirmedList />}
      </div>
    </div>
  );
}
