// Guarda: o frontend (que vira JavaScript público no Netlify) só pode importar os módulos puros
// do núcleo e só pode ler as duas envs públicas. Providers, Repo e secrets ficam no servidor.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PERMITIDOS = new Set(['telefone.ts', 'datas.ts', 'templates.ts']);
const ENVS_PUBLICAS = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']);
const SECRETS = [
  'WHATSAPP_PROVIDER',
  'WEBHOOK_SECRET',
  'EVOLUTION_API_URL',
  'EVOLUTION_API_KEY',
  'EVOLUTION_INSTANCE',
  'ZAPI_INSTANCE_ID',
  'ZAPI_TOKEN',
  'ZAPI_CLIENT_TOKEN',
  'WHATSAPP_DRY_RUN',
  'SERVICE_ROLE',
];

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    return statSync(caminho).isDirectory() ? arquivos(caminho) : /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

const fontes = [...arquivos('src'), 'vite.config.ts'].map((f) => ({ f, texto: readFileSync(f, 'utf8') }));

describe('frontend sem segredos', () => {
  it('só importa telefone/datas/templates do núcleo do WhatsApp', () => {
    const violacoes = fontes.flatMap(({ f, texto }) =>
      [...texto.matchAll(/from\s+'([^']*supabase\/functions[^']*)'/g)]
        .map((m) => m[1])
        .filter((caminho) => !caminho.includes('/_shared/whatsapp/') || !PERMITIDOS.has(caminho.split('/').pop()!))
        .map((caminho) => `${f}: ${caminho}`)
    );
    expect(violacoes).toEqual([]);
  });

  it('só lê as envs públicas do Vite', () => {
    const usadas = fontes.flatMap(({ texto }) => [...texto.matchAll(/import\.meta\.env\.(\w+)/g)].map((m) => m[1]));
    expect(usadas.filter((n) => !ENVS_PUBLICAS.has(n))).toEqual([]);
  });

  it('não cita nenhum secret do servidor', () => {
    const citados = fontes.flatMap(({ f, texto }) => SECRETS.filter((s) => texto.includes(s)).map((s) => `${f}: ${s}`));
    expect(citados).toEqual([]);
  });

  it('os módulos permitidos não leem env nem importam provider', () => {
    for (const nome of PERMITIDOS) {
      const texto = readFileSync(join('supabase/functions/_shared/whatsapp', nome), 'utf8');
      expect(texto).not.toMatch(/Deno\.env|process\.env|import\.meta\.env|providers\//);
    }
  });
});
