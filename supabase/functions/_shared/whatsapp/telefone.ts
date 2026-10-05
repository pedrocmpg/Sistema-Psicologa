// Telefone brasileiro: normalização, validação e máscaras.
// TS puro — usado pela Edge Function (Deno), pelos testes (Node) e pelo frontend (Vite).

export type ResultadoTelefone =
  | { ok: true; numero: string } // só dígitos: 55 + DDD + 9 + 8 dígitos
  | { ok: false; motivo: 'telefone_invalido' };

const CELULAR_BR = /^55[1-9]{2}9\d{8}$/;

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

/**
 * Normaliza para 55 + DDD + 9 + 8 dígitos. Com 10 ou 11 dígitos, assume Brasil e prefixa 55.
 * Aceita só celular: fixo, curto ou sem o nono dígito vira inválido (não tentamos adivinhar o 9).
 */
export function normalizarTelefone(valor: string): ResultadoTelefone {
  let digitos = apenasDigitos(valor ?? '');
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  return CELULAR_BR.test(digitos) ? { ok: true, numero: digitos } : { ok: false, motivo: 'telefone_invalido' };
}

/** Celular com DDD válido (com ou sem +55)? */
export function validarCelularBR(valor: string): boolean {
  return normalizarTelefone(valor).ok;
}

/** Para logs: "+55 54 9****-1234". Nunca loga o número completo. */
export function mascararTelefone(valor: string): string {
  const r = normalizarTelefone(valor);
  if (!r.ok) {
    const digitos = apenasDigitos(valor ?? '');
    return `****${digitos.slice(-2)}`;
  }
  const n = r.numero;
  return `+55 ${n.slice(2, 4)} 9****-${n.slice(-4)}`;
}

/** "(54) 99999-9999" a partir de qualquer formato válido; devolve o valor original se inválido. */
export function formatarTelefoneExibicao(valor: string): string {
  const r = normalizarTelefone(valor);
  if (!r.ok) return valor;
  const n = r.numero.slice(2);
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
}

/** Máscara de digitação para o campo de telefone: "(54) 99999-9999", aplicada aos poucos. */
export function mascaraDigitacaoTelefone(valor: string): string {
  const d = apenasDigitos(valor).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
