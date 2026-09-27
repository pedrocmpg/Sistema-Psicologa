import { useEffect, useState } from 'react';
import { Menu, X } from './icons';

export default function Header() {
  const [menuAberto, setMenuAberto] = useState(false);
  const [rolou, setRolou] = useState(false);

  useEffect(() => {
    function aoRolar() {
      setRolou(window.scrollY > 8);
    }
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  useEffect(() => {
    if (!menuAberto) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuAberto(false);
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [menuAberto]);

  function fecharMenu() {
    setMenuAberto(false);
  }

  return (
    <header className={`site-header ${rolou || menuAberto ? 'is-scrolled' : ''}`}>
      <div className="container site-header__inner">
        <a href="#topo" className="site-header__brand" onClick={fecharMenu}>
          <span className="site-header__name">Daniele Walczak</span>
          <span className="site-header__crp">Psicóloga Clínica · CRP 07/36785</span>
        </a>
        <nav className="site-header__nav" aria-label="Principal">
          <div id="menu-principal" className={`site-header__nav-links ${menuAberto ? 'is-open' : ''}`}>
            <a href="#sobre" onClick={fecharMenu}>
              Sobre
            </a>
            <a href="#especialidades" onClick={fecharMenu}>
              Especialidades
            </a>
            <a href="#contato" onClick={fecharMenu}>
              Contato
            </a>
            <a href="#agendamento" className="btn btn-primary" onClick={fecharMenu}>
              Agendar horário
            </a>
          </div>
          <a href="#agendamento" className="btn btn-primary btn-sm" onClick={fecharMenu}>
            <span className="site-header__cta-long">Agendar horário</span>
            <span className="site-header__cta-short">Agendar</span>
          </a>
          <button
            type="button"
            className="site-header__menu-btn"
            aria-expanded={menuAberto}
            aria-controls="menu-principal"
            aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setMenuAberto((a) => !a)}
          >
            {menuAberto ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
        </nav>
      </div>
    </header>
  );
}
