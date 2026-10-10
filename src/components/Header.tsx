import { useEffect, useState } from 'react';
import { Menu, X } from './icons';
import { profissional, textos } from '../config/profissional';

export default function Header() {
  const { cabecalho } = textos;
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
          <span className="site-header__name">{profissional.nome}</span>
          <span className="site-header__crp">{cabecalho.subtitulo}</span>
        </a>
        <nav className="site-header__nav" aria-label="Principal">
          <div id="menu-principal" className={`site-header__nav-links ${menuAberto ? 'is-open' : ''}`}>
            {cabecalho.menu.map((item) => (
              <a key={item.destino} href={item.destino} onClick={fecharMenu}>
                {item.rotulo}
              </a>
            ))}
            <a href="#agendamento" className="btn btn-primary" onClick={fecharMenu}>
              {cabecalho.botaoAgendar}
            </a>
          </div>
          <a href="#agendamento" className="btn btn-primary btn-sm" onClick={fecharMenu}>
            <span className="site-header__cta-long">{cabecalho.botaoAgendar}</span>
            <span className="site-header__cta-short">{cabecalho.botaoAgendarCurto}</span>
          </a>
          <button
            type="button"
            className="site-header__menu-btn"
            aria-expanded={menuAberto}
            aria-controls="menu-principal"
            aria-label={menuAberto ? cabecalho.fecharMenu : cabecalho.abrirMenu}
            onClick={() => setMenuAberto((a) => !a)}
          >
            {menuAberto ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
        </nav>
      </div>
    </header>
  );
}
