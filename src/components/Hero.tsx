import { Star } from './icons';

export default function Hero() {
  return (
    <section id="topo" className="hero">
      <div className="container hero__inner">
        <div>
          <div className="hero__eyebrow">Psicoterapia individual, de casal e infantil</div>
          <h1 className="hero__title">Um espaço tranquilo para você se ouvir com mais clareza.</h1>
          <p className="hero__lead">
            Atendimento psicológico com abordagem cognitivo-comportamental, em Bento Gonçalves.
            Um processo conduzido no seu ritmo, com escuta cuidadosa e embasamento técnico.
          </p>
          <div className="hero__actions">
            <a href="#agendamento" className="btn btn-primary">
              Agendar horário
            </a>
            <a href="#sobre" className="btn btn-secondary">
              Conhecer a abordagem
            </a>
          </div>
        </div>

        <div className="hero__art" aria-hidden="true">
          <svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#94b09d" />
                <stop offset="100%" stopColor="#55705f" />
              </linearGradient>
            </defs>
            <rect width="400" height="500" fill="url(#g1)" />
            <circle cx="320" cy="80" r="110" fill="#ffffff" opacity="0.07" />
            <circle cx="60" cy="420" r="150" fill="#ffffff" opacity="0.06" />
            <path
              d="M70 260 C 70 180, 150 130, 220 160 C 290 190, 300 280, 240 320 C 180 360, 90 340, 70 260 Z"
              fill="#ffffff"
              opacity="0.14"
            />
            <path
              d="M120 340 C 160 320, 220 330, 250 370 C 280 410, 250 460, 190 460 C 130 460, 90 370, 120 340 Z"
              fill="#ffffff"
              opacity="0.1"
            />
            <g opacity="0.5" stroke="#ffffff" strokeWidth="1.5" fill="none">
              <path d="M150 200 q 30 -20 60 0" />
              <path d="M150 220 q 30 -20 60 0" />
              <path d="M150 240 q 30 -20 60 0" />
            </g>
          </svg>
          <div className="hero__badge">
            <span className="hero__badge-stars" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
              ))}
            </span>
            <span className="hero__badge-text">
              <strong>5,0</strong> de avaliação no Google (33 avaliações)
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
