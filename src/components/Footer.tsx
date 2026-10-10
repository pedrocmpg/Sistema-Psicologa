import { textos } from '../config/profissional';

export default function Footer() {
  const { rodape } = textos;
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <span>{rodape.assinatura}</span>
        <span>
          © {new Date().getFullYear()} · {rodape.local}
        </span>
        <a href="/admin">{rodape.acessoAdmin}</a>
      </div>
    </footer>
  );
}
