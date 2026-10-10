import Reveal from './Reveal';
import { MapPin, Phone, Clock, MessageCircle } from './icons';
import { whatsappHref } from '../lib/whatsapp';
import { profissional, textos } from '../config/profissional';

const ENDERECO = profissional.endereco;
const MAPS_QUERY = encodeURIComponent(ENDERECO);

export default function ContactSection() {
  const { contato } = textos;
  return (
    <section id="contato" className="section contact">
      <div className="container">
        <Reveal>
          <div className="section-eyebrow">{contato.chamada}</div>
          <h2 className="section-heading">{contato.titulo}</h2>
        </Reveal>

        <div className="contact__grid">
          <Reveal>
            <ul className="contact__list">
              <li>
                <span className="contact__list-icon" aria-hidden="true">
                  <MapPin size={18} strokeWidth={2} />
                </span>
                <div>
                  <div className="contact__list-title">{contato.enderecoRotulo}</div>
                  <div className="contact__list-desc">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${MAPS_QUERY}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {ENDERECO}
                    </a>
                  </div>
                </div>
              </li>
              <li>
                <span className="contact__list-icon" aria-hidden="true">
                  <Phone size={18} strokeWidth={2} />
                </span>
                <div>
                  <div className="contact__list-title">{contato.telefoneRotulo}</div>
                  <div className="contact__list-desc">
                    <a href={`tel:+${profissional.telefoneInternacional}`}>{profissional.telefoneExibicao}</a>
                  </div>
                </div>
              </li>
              <li>
                <span className="contact__list-icon" aria-hidden="true">
                  <Clock size={18} strokeWidth={2} />
                </span>
                <div>
                  <div className="contact__list-title">{contato.horarioRotulo}</div>
                  <div className="contact__list-desc">{profissional.horarioAtendimento}</div>
                </div>
              </li>
            </ul>

            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-light">
              <MessageCircle size={18} strokeWidth={2} aria-hidden="true" />
              {contato.botaoWhatsapp}
            </a>

            <div className="contact__crp">{contato.assinatura}</div>
          </Reveal>

          <Reveal delay={120}>
            <div className="contact__map">
              <iframe
                title={contato.mapaTitulo}
                src={`https://www.google.com/maps?q=${MAPS_QUERY}&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
