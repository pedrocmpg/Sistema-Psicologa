import { LogOut } from '../icons';
import { ABAS, type Aba } from './abas';

interface AdminNavProps {
  aba: Aba;
  onChange: (aba: Aba) => void;
  pendentes: number;
  onSair: () => void;
}

/** Sidebar no desktop; no celular vira topbar (marca + sair) com as seções numa barra inferior fixa. */
export default function AdminNav({ aba, onChange, pendentes, onSair }: AdminNavProps) {
  return (
    <aside className="admin-nav">
      <div className="admin-nav__brand">
        <span className="admin-nav__logo" aria-hidden="true">
          D
        </span>
        <span className="admin-nav__brand-text">
          <span className="admin-nav__brand-name">Daniele Walczak</span>
          <span className="admin-nav__brand-sub">Painel de agendamentos</span>
        </span>
      </div>

      <nav className="admin-nav__items" aria-label="Seções do painel">
        {ABAS.map(({ id, rotulo, Icon }) => (
          <button
            key={id}
            type="button"
            className="admin-nav__item"
            aria-current={aba === id ? 'page' : undefined}
            onClick={() => onChange(id)}
          >
            <span className="admin-nav__item-icon" aria-hidden="true">
              <Icon size={20} strokeWidth={1.9} />
            </span>
            {rotulo}
            {id === 'pendentes' && pendentes > 0 && (
              <span className="admin-nav__count" aria-label={`${pendentes} pendentes`}>
                {pendentes}
              </span>
            )}
          </button>
        ))}
      </nav>

      <button type="button" className="btn btn-ghost btn-sm admin-nav__sair" onClick={onSair} aria-label="Sair">
        <LogOut size={16} strokeWidth={2} aria-hidden="true" />
        <span className="admin-nav__sair-label">Sair</span>
      </button>
    </aside>
  );
}
