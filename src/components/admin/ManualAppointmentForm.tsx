import { useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import DatePicker from './DatePicker';
import ToolCard from './ToolCard';
import { CalendarPlus } from '../icons';

interface ManualAppointmentFormProps {
  onCriado: () => void;
}

export default function ManualAppointmentForm({ onCriado }: ManualAppointmentFormProps) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [repetir, setRepetir] = useState(false);
  const [semanas, setSemanas] = useState(8);
  const [notificar, setNotificar] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  function limpar() {
    setNome('');
    setTelefone('');
    setData('');
    setHora('');
    setRepetir(false);
    setSemanas(8);
    setNotificar(true);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setResultado(null);

    if (!nome.trim() || !telefone.trim() || !data || !hora) {
      setErro('Preencha nome, telefone, data e horário.');
      return;
    }

    setSalvando(true);

    const { data: resp, error } = await supabase.rpc('criar_agendamento_manual', {
      p_nome_paciente: nome,
      p_telefone: telefone,
      p_data: data,
      p_hora: hora,
      p_semanas: repetir ? semanas : 1,
      p_notificar_whatsapp: notificar,
    });

    setSalvando(false);

    if (error) {
      setErro(
        error.message.includes('Já existe uma consulta')
          ? 'Já existe uma consulta cadastrada nesse dia e horário.'
          : 'Não foi possível salvar o agendamento.'
      );
      return;
    }

    const linha = resp?.[0];
    setResultado(
      linha && linha.ocorrencias_criadas > 1
        ? `Agendamento confirmado. ${linha.ocorrencias_criadas} consultas semanais criadas${
            linha.ocorrencias_puladas > 0
              ? ` (${linha.ocorrencias_puladas} já estavam ocupadas e foram puladas)`
              : ''
          }.`
        : 'Agendamento confirmado.'
    );
    limpar();
    onCriado();
  }

  return (
    <ToolCard titulo="Adicionar agendamento manual" Icon={CalendarPlus}>
        <form className="batch-form" onSubmit={salvar}>
          <p className="admin-panel__hint">
            Para quando o paciente marcar por telefone ou WhatsApp, fora do site. Entra direto
            como confirmado.
          </p>

          {erro && <div className="alert alert-error">{erro}</div>}
          {resultado && <div className="alert alert-success">{resultado}</div>}

          <div className="field">
            <label htmlFor="manual-nome">Nome do paciente</label>
            <input id="manual-nome" type="text" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="manual-telefone">Telefone</label>
            <input
              id="manual-telefone"
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="(54) 99999-9999"
            />
          </div>

          <div className="batch-form__row">
            <div className="field">
              <label>Dia</label>
              <DatePicker value={data} onChange={setData} />
            </div>
            <div className="field">
              <label htmlFor="manual-hora">Horário</label>
              <input id="manual-hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>

          <label className="field-checkbox">
            <input type="checkbox" checked={repetir} onChange={(e) => setRepetir(e.target.checked)} />
            Repetir semanalmente neste mesmo horário
          </label>

          {repetir && (
            <div className="field field--narrow">
              <label htmlFor="manual-semanas">Por quantas semanas?</label>
              <input
                id="manual-semanas"
                type="number"
                min={2}
                max={52}
                value={semanas}
                onChange={(e) => setSemanas(Math.max(2, Math.min(52, Number(e.target.value) || 2)))}
              />
            </div>
          )}

          <label className="field-checkbox">
            <input type="checkbox" checked={notificar} onChange={(e) => setNotificar(e.target.checked)} />
            Enviar confirmação por WhatsApp
          </label>

          <button type="submit" className="btn btn-primary" disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar agendamento'}
          </button>
        </form>
    </ToolCard>
  );
}
