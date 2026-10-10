import Reveal from './Reveal';
import { ICONES_TEXTO } from './iconesTexto';
import { textos } from '../config/profissional';

export default function About() {
  const { sobre } = textos;
  return (
    <section id="sobre" className="section about">
      <div className="container">
        <Reveal>
          <div className="section-eyebrow">{sobre.chamada}</div>
          <h2 className="section-heading">{sobre.titulo}</h2>
          <p className="section-subheading">{sobre.texto}</p>
        </Reveal>

        <div className="about__grid">
          <Reveal>
            <ul className="about__list">
              {sobre.pontos.map((ponto) => {
                const Icone = ICONES_TEXTO[ponto.icone];
                return (
                  <li key={ponto.titulo}>
                    <span className="about__list-icon" aria-hidden="true">
                      <Icone size={20} strokeWidth={1.8} />
                    </span>
                    <div>
                      <div className="about__list-title">{ponto.titulo}</div>
                      <div className="about__list-desc">{ponto.texto}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <div className="about__card">
              <dl>
                {sobre.ficha.map((d) => {
                  const Icone = ICONES_TEXTO[d.icone];
                  return (
                    <div className="about__card-row" key={d.rotulo}>
                      <dt>
                        <Icone size={16} strokeWidth={2} aria-hidden="true" />
                        {d.rotulo}
                      </dt>
                      <dd>{d.valor}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
