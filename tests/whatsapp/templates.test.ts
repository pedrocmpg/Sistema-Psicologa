import { describe, expect, it } from 'vitest';
import {
  dataPorExtenso,
  diaFixoSemanal,
  horaFalada,
  instanteCurto,
} from '../../supabase/functions/_shared/whatsapp/datas.ts';
import {
  type DadosMensagem,
  EVENTOS,
  montarMensagem,
  renderizarTemplate,
  TEMPLATES_PADRAO,
  templatesEfetivos,
  termosClinicos,
} from '../../supabase/functions/_shared/whatsapp/templates.ts';

const DADOS: DadosMensagem = {
  nomePaciente: 'Paciente Teste',
  profissional: 'Profissional Exemplo',
  telefoneContato: '+55 54 90000-0009',
  endereco: 'Rua Fictícia, 100, sala 1',
  data: '2026-10-13',
  hora: '14:00:00',
};

describe('datas em America/Sao_Paulo', () => {
  it('formata dia por extenso e hora falada', () => {
    expect(dataPorExtenso('2026-10-13')).toBe('terça-feira, 13/10');
    expect(horaFalada('14:00:00')).toBe('14h');
    expect(horaFalada('09:30')).toBe('9h30');
  });

  it('não muda de dia por causa do fuso da máquina (UTC na Edge Function)', () => {
    // Viradas de mês e de ano.
    expect(dataPorExtenso('2026-03-01')).toBe('domingo, 01/03');
    expect(dataPorExtenso('2026-12-31')).toBe('quinta-feira, 31/12');
  });

  it('concorda o gênero do dia fixo', () => {
    expect(diaFixoSemanal('2026-10-13')).toBe('toda terça-feira');
    expect(diaFixoSemanal('2026-10-17')).toBe('todo sábado');
    expect(diaFixoSemanal('2026-10-18')).toBe('todo domingo');
  });

  it('converte instantes UTC para o horário de Brasília', () => {
    // 18h40 UTC = 15h40 em São Paulo (UTC-3, sem horário de verão).
    expect(instanteCurto('2026-10-05T18:40:00Z')).toBe('05/10 às 15h40');
    // 01h UTC do dia 06 ainda é dia 05 em São Paulo.
    expect(instanteCurto('2026-10-06T01:00:00Z')).toBe('05/10 às 22h00');
  });
});

describe('renderização de templates', () => {
  it('confirmado com endereço', () => {
    expect(montarMensagem('confirmado', TEMPLATES_PADRAO, DADOS)).toBe(
      'Olá, Paciente! Seu horário com Profissional Exemplo está confirmado para terça-feira, 13/10, às 14h. ' +
        'Endereço: Rua Fictícia, 100, sala 1. Para remarcar ou cancelar, fale com (54) 90000-0009.'
    );
  });

  it('confirmado sem endereço não deixa espaço duplo', () => {
    const msg = montarMensagem('confirmado', TEMPLATES_PADRAO, { ...DADOS, endereco: null });
    expect(msg).toBe(
      'Olá, Paciente! Seu horário com Profissional Exemplo está confirmado para terça-feira, 13/10, às 14h. ' +
        'Para remarcar ou cancelar, fale com (54) 90000-0009.'
    );
    expect(msg).not.toMatch(/ {2}/);
  });

  it('recusado e cancelado', () => {
    expect(montarMensagem('recusado', TEMPLATES_PADRAO, DADOS)).toBe(
      'Olá, Paciente! Não foi possível confirmar o horário solicitado com Profissional Exemplo. ' +
        'Para ver outras opções, fale com (54) 90000-0009.'
    );
    expect(montarMensagem('cancelado', TEMPLATES_PADRAO, DADOS)).toBe(
      'Olá, Paciente! Seu horário com Profissional Exemplo em terça-feira, 13/10, às 14h, foi cancelado. ' +
        'Para reagendar, fale com (54) 90000-0009.'
    );
  });

  it('séries descrevem o dia fixo semanal', () => {
    expect(montarMensagem('confirmado_serie', TEMPLATES_PADRAO, { ...DADOS, semanas: 8, endereco: null })).toBe(
      'Olá, Paciente! Seus horários com Profissional Exemplo estão confirmados: toda terça-feira, às 14h, ' +
        'a partir de 13/10, por 8 semanas. Para remarcar ou cancelar, fale com (54) 90000-0009.'
    );
    expect(montarMensagem('cancelado_serie', TEMPLATES_PADRAO, { ...DADOS, semanas: 3 })).toBe(
      'Olá, Paciente! Seus horários de toda terça-feira, às 14h, com Profissional Exemplo, a partir de 13/10, ' +
        'foram cancelados. Para reagendar, fale com (54) 90000-0009.'
    );
    expect(montarMensagem('confirmado_serie', TEMPLATES_PADRAO, { ...DADOS, semanas: 1 })).toContain('por 1 semana.');
  });

  it('placeholder desconhecido fica visível (para a pré-visualização acusar)', () => {
    expect(renderizarTemplate('Oi {nome}, {inexistente}', { nome: 'Paciente' })).toBe('Oi Paciente, {inexistente}');
  });

  it('template salvo vazio cai no padrão', () => {
    const t = templatesEfetivos({ confirmado: '  ', recusado: 'Texto próprio {nome}' });
    expect(t.confirmado).toBe(TEMPLATES_PADRAO.confirmado);
    expect(t.recusado).toBe('Texto próprio {nome}');
  });
});

describe('privacidade: termos clínicos', () => {
  it('nenhum template padrão tem termo clínico', () => {
    for (const evento of EVENTOS) {
      expect(termosClinicos(montarMensagem(evento, TEMPLATES_PADRAO, { ...DADOS, semanas: 8 }))).toEqual([]);
    }
  });

  it.each([
    'Sua sessão de psicoterapia está confirmada',
    'Sua SESSAO foi marcada',
    'Seu horário com a Psicóloga',
    'Lembrete do tratamento',
    'Resultado do diagnóstico',
  ])('detecta "%s"', (texto) => {
    expect(termosClinicos(texto).length).toBeGreaterThan(0);
  });
});
