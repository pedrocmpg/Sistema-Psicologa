export default function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a href="#topo" className="site-header__brand">
          <span className="site-header__name">Daniele Walczak</span>
          <span className="site-header__crp">Psicóloga Clínica · CRP 07/36785</span>
        </a>
        <nav className="site-header__nav">
          <div className="site-header__nav-links">
            <a href="#sobre">Sobre</a>
            <a href="#especialidades">Especialidades</a>
            <a href="#contato">Contato</a>
          </div>
          <a href="#agendamento" className="btn btn-primary btn-sm">
            Agendar horário
          </a>
        </nav>
      </div>
    </header>
  );
}
