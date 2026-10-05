// Edge Function chamada pelo painel /admin: health | teste | reenviar.
// Só a psicóloga logada: o token do header Authorization precisa ser de um usuário válido.
import { criarDeps, supabaseAdmin } from '../_shared/ambiente.ts';
import { criarHandlerAdmin } from '../_shared/whatsapp/http.ts';

async function autenticar(req: Request): Promise<boolean> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  return !error && !!data.user;
}

Deno.serve(criarHandlerAdmin({ autenticar, deps: criarDeps() }));
