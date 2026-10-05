// Edge Function chamada pelo Database Webhook (INSERT/UPDATE em agendamentos).
// verify_jwt = false (config.toml): a autenticação é o header x-webhook-secret = WEBHOOK_SECRET.
import { criarDeps, emSegundoPlano, env } from '../_shared/ambiente.ts';
import { criarHandlerWebhook } from '../_shared/whatsapp/http.ts';

Deno.serve(
  criarHandlerWebhook({
    segredo: env('WEBHOOK_SECRET'),
    deps: criarDeps(),
    emSegundoPlano,
  })
);
