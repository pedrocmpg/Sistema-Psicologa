import { describe, expect, it } from 'vitest';
import {
  formatarTelefoneExibicao,
  mascaraDigitacaoTelefone,
  mascararTelefone,
  normalizarTelefone,
  validarCelularBR,
} from '../../supabase/functions/_shared/whatsapp/telefone.ts';

// Só números obviamente fictícios (prefixo 90000).
describe('normalizarTelefone', () => {
  it.each([
    ['54900000001', '5554900000001'],
    ['(54) 90000-0001', '5554900000001'],
    ['+55 54 90000-0001', '5554900000001'],
    ['55 (54) 9 0000-0001', '5554900000001'],
    ['54.90000.0001', '5554900000001'],
    ['11 90000-0002', '5511900000002'],
  ])('aceita celular válido %s', (entrada, esperado) => {
    expect(normalizarTelefone(entrada)).toEqual({ ok: true, numero: esperado });
  });

  it.each([
    ['fixo com DDD', '(54) 3000-0001'],
    ['fixo com DDI', '+55 54 3000-0001'],
    ['celular antigo sem o nono dígito', '54 8000-0001'],
    ['curto', '90000-0001'],
    ['vazio', ''],
    ['só símbolos', '()- +'],
    ['DDD com zero', '(04) 90000-0001'],
    ['longo demais', '+55 54 90000-00011'],
    ['estrangeiro', '+1 415 900 0001'],
  ])('rejeita %s', (_caso, entrada) => {
    expect(normalizarTelefone(entrada)).toEqual({ ok: false, motivo: 'telefone_invalido' });
  });

  it('não tenta adivinhar o nono dígito', () => {
    // 10 dígitos de celular antigo (sem o 9) continua inválido, não vira 54 9 8000-0001.
    expect(validarCelularBR('5480000001')).toBe(false);
  });
});

describe('mascararTelefone', () => {
  it('esconde o meio do número', () => {
    expect(mascararTelefone('(54) 90000-1234')).toBe('+55 54 9****-1234');
  });

  it('não vaza número inválido', () => {
    expect(mascararTelefone('(54) 3000-0001')).toBe('****01');
  });
});

describe('formatação para exibição e digitação', () => {
  it('formata (DD) 9XXXX-XXXX', () => {
    expect(formatarTelefoneExibicao('5554900000001')).toBe('(54) 90000-0001');
  });

  it('aplica a máscara aos poucos', () => {
    expect(mascaraDigitacaoTelefone('5')).toBe('(5');
    expect(mascaraDigitacaoTelefone('5490')).toBe('(54) 90');
    expect(mascaraDigitacaoTelefone('5490000')).toBe('(54) 9000-0');
    expect(mascaraDigitacaoTelefone('54900000001')).toBe('(54) 90000-0001');
    expect(mascaraDigitacaoTelefone('549000000019999')).toBe('(54) 90000-0001');
  });
});
