import Reveal from './Reveal';

const especialidades = [
  {
    icon: '💬',
    title: 'Terapia Cognitivo-Comportamental',
    desc: 'Processo estruturado que ajuda a identificar padrões de pensamento e desenvolver estratégias mais saudáveis no dia a dia.',
  },
  {
    icon: '💞',
    title: 'Terapia de casal',
    desc: 'Espaço para casais trabalharem comunicação, conflitos e reconexão, com condução neutra e acolhedora.',
  },
  {
    icon: '🌿',
    title: 'Transtornos de ansiedade',
    desc: 'Acompanhamento para quem convive com ansiedade excessiva, preocupação constante ou crises, com técnicas da TCC.',
  },
  {
    icon: '🧭',
    title: 'Orientação vocacional',
    desc: 'Apoio na escolha profissional ou em momentos de transição de carreira, unindo autoconhecimento e informação.',
  },
];

export default function Specialties() {
  return (
    <section id="especialidades" className="section specialties">
      <div className="container">
        <Reveal>
          <div className="section-eyebrow">Áreas de atuação</div>
          <h2 className="section-heading">Especialidades</h2>
        </Reveal>

        <div className="specialties__grid">
          {especialidades.map((e, i) => (
            <Reveal key={e.title} delay={i * 80}>
              <div className="specialty-card">
                <div className="specialty-card__icon" aria-hidden="true">
                  {e.icon}
                </div>
                <div className="specialty-card__title">{e.title}</div>
                <p className="specialty-card__desc">{e.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
