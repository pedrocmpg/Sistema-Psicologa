import Reveal from './Reveal';
import { ICONES_TEXTO } from './iconesTexto';
import { textos } from '../config/profissional';

export default function Specialties() {
  const { especialidades } = textos;
  return (
    <section id="especialidades" className="section specialties">
      <div className="container">
        <Reveal>
          <div className="section-eyebrow">{especialidades.chamada}</div>
          <h2 className="section-heading">{especialidades.titulo}</h2>
        </Reveal>

        <div className="specialties__grid">
          {especialidades.itens.map((e, i) => {
            const Icone = ICONES_TEXTO[e.icone];
            return (
              <Reveal key={e.titulo} delay={i * 80}>
                <div className="specialty-card">
                  <div className="specialty-card__icon" aria-hidden="true">
                    <Icone size={22} strokeWidth={2} />
                  </div>
                  <div className="specialty-card__title">{e.titulo}</div>
                  <p className="specialty-card__desc">{e.texto}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
