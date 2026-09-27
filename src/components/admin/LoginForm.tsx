import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

    setCarregando(false);
    if (error) {
      setErro('E-mail ou senha inválidos.');
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <span className="admin-nav__logo" aria-hidden="true">
          D
        </span>
        <h1 className="admin-login__title">Área administrativa</h1>
        <div className="admin-login__subtitle">Acesso restrito à psicóloga Daniele Walczak.</div>

        <form onSubmit={handleSubmit}>
          {erro && <div className="alert alert-error">{erro}</div>}

          <div className="field">
            <label htmlFor="admin-email">E-mail</label>
            <input
              id="admin-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label htmlFor="admin-senha">Senha</label>
            <input
              id="admin-senha"
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <a href="/" className="admin-login__back">
          ← Voltar ao site
        </a>
      </div>
    </div>
  );
}
