import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { textos } from './src/config/profissional.ts'

// Preenche os marcadores %...% do index.html com os textos de src/config/profissional.ts.
const dadosDoSite = {
  TITULO_SITE: textos.pagina.titulo,
  DESCRICAO_SITE: textos.pagina.descricao,
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
