import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import LoginForm from '../components/admin/LoginForm';
import AvailabilityManager from '../components/admin/AvailabilityManager';
import PendingRequests from '../components/admin/PendingRequests';
import ConfirmedList from '../components/admin/ConfirmedList';
import RecusadosList from '../components/admin/RecusadosList';
import ResumoPainel from '../components/admin/ResumoPainel';

type Aba = 'pendentes' | 'confirmados' | 'recusados' | 'agenda';

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [aba, setAba] = useState<Aba>('pendentes');
  const [refreshTick, setRefreshTick] = useState(0);

  function bump() {
    setRefreshTick((t) => t + 1);
  }

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
        <ResumoPainel key={refreshTick} />

        <div className="admin-tabs">
          <button
            className={`admin-tab ${aba === 'pendentes' ? 'is-active' : ''}`}
            onClick={() => setAba('pendentes')}
          >
            Pendentes
          </button>
          <button
            className={`admin-tab ${aba === 'confirmados' ? 'is-active' : ''}`}
            onClick={() => setAba('confirmados')}
          >
            Confirmados
          </button>
          <button
            className={`admin-tab ${aba === 'recusados' ? 'is-active' : ''}`}
            onClick={() => setAba('recusados')}
          >
            Recusados
          </button>
          <button className={`admin-tab ${aba === 'agenda' ? 'is-active' : ''}`} onClick={() => setAba('agenda')}>
            Agenda
          </button>
        </div>

        {aba === 'pendentes' && <PendingRequests onChange={bump} />}
        {aba === 'confirmados' && <ConfirmedList />}
        {aba === 'recusados' && <RecusadosList />}
        {aba === 'agenda' && <AvailabilityManager />}
      </div>
    </div>
  );
}
