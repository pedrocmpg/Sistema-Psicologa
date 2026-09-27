const WHATSAPP_NUMBER = '5554997122959';
const WHATSAPP_MENSAGEM = 'Olá! Gostaria de agendar uma consulta.';

export const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MENSAGEM)}`;
