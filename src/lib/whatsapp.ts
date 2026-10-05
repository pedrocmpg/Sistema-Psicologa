import { profissional } from '../config/profissional';

const WHATSAPP_NUMBER = profissional.telefoneInternacional;
const WHATSAPP_MENSAGEM = profissional.mensagemWhatsapp;

export const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MENSAGEM)}`;

/** Link de WhatsApp para o telefone de um paciente (assume Brasil quando vier sem DDI). */
export function whatsappPara(telefone: string): string {
  let digitos = telefone.replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  return `https://wa.me/${digitos}`;
}

/** Link de WhatsApp para o paciente com a mensagem já preenchida. */
export function whatsappComTexto(telefone: string, texto: string): string {
  return `${whatsappPara(telefone)}?text=${encodeURIComponent(texto)}`;
}
