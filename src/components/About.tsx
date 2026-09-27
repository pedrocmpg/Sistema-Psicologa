import Reveal from './Reveal';
import { Compass, Users, GraduationCap, UserRound, BadgeCheck, Building, Clock } from './icons';

const dados = [
  { Icon: UserRound, rotulo: 'Profissional', valor: 'Daniele Walczak' },
  { Icon: BadgeCheck, rotulo: 'Registro', valor: 'CRP 07/36785' },
  { Icon: Building, rotulo: 'Atendimento', valor: 'Presencial' },
  { Icon: Users, rotulo: 'Público', valor: 'Adulto, infantil e casal' },
  { Icon: Clock, rotulo: 'Horário', valor: 'Seg. a sex., 9h–19h30' },
];

const pontos = [
  {
    Icon: Compass,
    title: 'Abordagem cognitivo-comportamental (TCC)',
    desc: 'Terapia estruturada, com objetivos claros e técnicas baseadas em evidências para lidar com pensamentos, emoções e comportamentos.',
  },
  {
    Icon: Users,
    title: 'Adultos, crianças e casais',
    desc: 'Atendimento individual para adultos e crianças, além de psicoterapia de casal, com linguagem e recursos adequados a cada fase da vida.',
  },
  {
    Icon: GraduationCap,
    title: 'Formação e atualização contínua',
    desc: 'Psicóloga clínica (CRP 07/36785), com formação em Terapia Cognitivo-Comportamental e atualização constante na área.',
  },
];

export default function About() {
  return (
    <section id="sobre" className="section about">
      <div className="container">
        <Reveal>
          <div className="section-eyebrow">Sobre o atendimento</div>
          <h2 className="section-heading">Um cuidado próximo, técnico e sem julgamentos.</h2>
          <p className="section-subheading">
            Cada pessoa chega com uma história diferente. O trabalho aqui é construir, junto, um
            espaço seguro para entender o que está sendo vivido — no tempo de cada um.
          </p>
        </Reveal>

        <div className="about__grid">
          <Reveal>
            <ul className="about__list">
              {pontos.map((p) => (
                <li key={p.title}>
                  <span className="about__list-icon" aria-hidden="true">
                    <p.Icon size={20} strokeWidth={1.8} />
                  </span>
                  <div>
                    <div className="about__list-title">{p.title}</div>
                    <div className="about__list-desc">{p.desc}</div>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <div className="about__card">
              <dl>
                {dados.map((d) => (
                  <div className="about__card-row" key={d.rotulo}>
                    <dt>
                      <d.Icon size={16} strokeWidth={2} aria-hidden="true" />
                      {d.rotulo}
                    </dt>
                    <dd>{d.valor}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
