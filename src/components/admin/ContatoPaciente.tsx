import { Phone, Mail } from '../icons';
import { whatsappPara } from '../../lib/whatsapp';

interface ContatoPacienteProps {
  telefone: string;
  email: string | null;
}

/** Telefone (abre o WhatsApp do paciente) e e-mail, para a linha de meta dos cards. */
export default function ContatoPaciente({ telefone, email }: ContatoPacienteProps) {
  return (
    <>
      <a href={whatsappPara(telefone)} target="_blank" rel="noopener noreferrer" title="Abrir no WhatsApp">
        <Phone size={14} strokeWidth={2} aria-hidden="true" /> {telefone}
      </a>
      {email && (
        <a href={`mailto:${email}`}>
          <Mail size={14} strokeWidth={2} aria-hidden="true" /> {email}
        </a>
      )}
    </>
  );
}
