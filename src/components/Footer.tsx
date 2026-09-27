export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <span>Daniele Walczak — Psicóloga Clínica — CRP 07/36785</span>
        <span>© {new Date().getFullYear()} · Bento Gonçalves, RS</span>
        <a href="/admin">Acesso administrativo</a>
      </div>
    </footer>
  );
}
