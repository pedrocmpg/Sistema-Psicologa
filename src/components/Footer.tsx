import { profissional } from '../config/profissional';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <span>
          {profissional.nome} — {profissional.titulo} — {profissional.crp}
        </span>
        <span>© {new Date().getFullYear()} · {profissional.cidadeUF}</span>
        <a href="/admin">Acesso administrativo</a>
      </div>
    </footer>
  );
}
