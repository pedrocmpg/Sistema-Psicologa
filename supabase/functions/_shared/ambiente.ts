// Monta as dependências a partir das envs da Edge Function (Deno). Os secrets do provedor só
// existem aqui, no servidor — nunca no frontend.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { SupabaseRepo } from './repo-supabase.ts';
import type { Deps } from './whatsapp/notificar.ts';
import { criarProvider, lerAmbiente } from './whatsapp/providers/index.ts';

declare const EdgeRuntime: { waitUntil(tarefa: Promise<unknown>): void } | undefined;

export const env = (nome: string) => Deno.env.get(nome);

// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetadas automaticamente pelo Supabase.
export const supabaseAdmin = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function criarDeps(): Deps {
  return {
    repo: new SupabaseRepo(supabaseAdmin),
    provider: () => criarProvider(env),
    dryRun: lerAmbiente(env).dryRun,
  };
}

export function emSegundoPlano(tarefa: Promise<unknown>) {
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime) EdgeRuntime.waitUntil(tarefa);
}
