import { Star } from './icons';
import { textos } from '../config/profissional';

export default function Hero() {
  const { hero } = textos;
  return (
    <section id="topo" className="hero">
      <div className="container hero__inner">
        <div>
          <div className="hero__eyebrow">{hero.chamada}</div>
          <h1 className="hero__title">
            {hero.tituloAntes}
            <em>{hero.tituloDestaque}</em>
            {hero.tituloDepois}
          </h1>
          <p className="hero__lead">{hero.texto}</p>
          <div className="hero__actions">
            <a href="#agendamento" className="btn btn-primary">
              {hero.botaoPrincipal}
            </a>
            <a href="#sobre" className="btn btn-secondary">
              {hero.botaoSecundario}
            </a>
          </div>
        </div>

        {/* Para usar uma foto no lugar da arte: troque o <svg> por <img src="/foto.jpg" alt="" /> */}
        <div className="hero__art" aria-hidden="true">
          <svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="hero-fundo" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a3bcaa" />
                <stop offset="55%" stopColor="#7c9885" />
                <stop offset="100%" stopColor="#4d6757" />
              </linearGradient>
              <radialGradient id="hero-luz" cx="0.8" cy="0.15" r="0.7">
                <stop offset="0%" stopColor="#f8f4ec" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#f8f4ec" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="400" height="500" fill="url(#hero-fundo)" />
            <rect width="400" height="500" fill="url(#hero-luz)" />

            <path
              className="hero__blob"
              d="M60 250 C 55 170, 140 115, 220 140 C 300 165, 330 260, 270 320 C 210 380, 70 350, 60 250 Z"
              fill="#ffffff"
              opacity="0.13"
            />
            <path
              className="hero__blob hero__blob--2"
              d="M110 350 C 150 320, 230 325, 265 370 C 300 420, 260 475, 190 470 C 120 465, 75 380, 110 350 Z"
              fill="#ffffff"
              opacity="0.09"
            />
            <circle className="hero__blob hero__blob--3" cx="320" cy="90" r="95" fill="#ffffff" opacity="0.08" />

            {/* folhas */}
            <g opacity="0.55" fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round">
              <path d="M300 430 C 300 380, 320 340, 350 310" />
              <path d="M312 385 C 290 378, 280 360, 284 345 C 300 350, 312 364, 312 385 Z" fill="#ffffff" fillOpacity="0.18" />
              <path d="M325 352 C 345 340, 352 322, 346 308 C 330 315, 322 333, 325 352 Z" fill="#ffffff" fillOpacity="0.18" />
            </g>

            {/* ondas suaves: respiração */}
            <g opacity="0.5" stroke="#ffffff" strokeWidth="1.5" fill="none" strokeLinecap="round">
              <path d="M140 205 q 40 -22 80 0" />
              <path d="M140 228 q 40 -22 80 0" opacity="0.75" />
              <path d="M140 251 q 40 -22 80 0" opacity="0.5" />
            </g>
          </svg>
          <div className="hero__badge">
            <span className="hero__badge-stars" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={14} fill="currentColor" strokeWidth={0} />
              ))}
            </span>
            <span className="hero__badge-text">
              <strong>{hero.selo.nota}</strong> {hero.selo.complemento}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
