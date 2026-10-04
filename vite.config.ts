import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { profissional } from './src/config/profissional.ts'

// Preenche os marcadores %...% do index.html com os dados de src/config/profissional.ts.
const dadosDoSite = {
  TITULO_SITE: `${profissional.nome} | ${profissional.titulo} — ${profissional.cidadeUF}`,
  DESCRICAO_SITE: `${profissional.tituloCurto} ${profissional.nome} (${profissional.crp}) — ${profissional.descricaoSite}`,
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'dados-profissional-no-html',
      transformIndexHtml: (html) =>
        html.replace(/%(TITULO_SITE|DESCRICAO_SITE)%/g, (_, chave: keyof typeof dadosDoSite) => dadosDoSite[chave]),
    },
  ],
})
