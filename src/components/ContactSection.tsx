import Reveal from './Reveal';
import { MapPin, Phone, Clock, MessageCircle } from './icons';
import { whatsappHref } from '../lib/whatsapp';

const ENDERECO = 'R. Dr. José Mário Mônaco, 227, sala 508, Centro, Bento Gonçalves, RS';
const MAPS_QUERY = encodeURIComponent(ENDERECO);

export default function ContactSection() {
  return (
    <section id="contato" className="section contact">
      <div className="container">
        <Reveal>
          <div className="section-eyebrow">Contato</div>
          <h2 className="section-heading">Onde e como encontrar o consultório</h2>
        </Reveal>

        <div className="contact__grid">
          <Reveal>
            <ul className="contact__list">
              <li>
                <span className="contact__list-icon" aria-hidden="true">
                  <MapPin size={18} strokeWidth={2} />
                </span>
                <div>
                  <div className="contact__list-title">Endereço</div>
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
                  <div className="contact__list-title">Telefone / WhatsApp</div>
                  <div className="contact__list-desc">
                    <a href="tel:+5554997122959">(54) 99712-2959</a>
                  </div>
                </div>
              </li>
              <li>
                <span className="contact__list-icon" aria-hidden="true">
                  <Clock size={18} strokeWidth={2} />
                </span>
                <div>
                  <div className="contact__list-title">Horário de atendimento</div>
                  <div className="contact__list-desc">Segunda a sexta, das 9h às 19h30</div>
                </div>
              </li>
            </ul>

            <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn btn-light">
              <MessageCircle size={18} strokeWidth={2} aria-hidden="true" />
              Conversar pelo WhatsApp
            </a>

            <div className="contact__crp">Daniele Walczak — Psicóloga Clínica — CRP 07/36785</div>
          </Reveal>

          <Reveal delay={120}>
            <div className="contact__map">
              <iframe
                title="Localização do consultório"
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
