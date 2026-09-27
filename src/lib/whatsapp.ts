const WHATSAPP_NUMBER = '5554997122959';
const WHATSAPP_MENSAGEM = 'Olá! Gostaria de agendar uma consulta.';

export const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MENSAGEM)}`;

/** Link de WhatsApp para o telefone de um paciente (assume Brasil quando vier sem DDI). */
export function whatsappPara(telefone: string): string {
  let digitos = telefone.replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  return `https://wa.me/${digitos}`;
}
