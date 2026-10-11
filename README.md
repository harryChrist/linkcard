# Linkcard

Perfil pessoal *link-in-bio* em página única: uma carta centralizada sobre um vídeo de fundo escuro,
com avatar, nome, badges, bio, presença estilo Discord, links sociais e um controle de volume.

Página **estática**: sem backend, login, banco de dados ou roteador. Todo o conteúdo vem de
[`src/profile.json`](src/profile.json) — trocar cor, fonte, links, badges, vídeo, título da aba ou favicon
é editar o JSON, sem tocar em componente nenhum. O único estado fora dele é o player e o áudio.

## Stack

React 19 · Vite 7 · TypeScript 5.9 (estrito) · Tailwind CSS 4 (`@tailwindcss/vite`) · `lucide-react` ·
`clsx` + `tailwind-merge` (`cn()`) · `sonner` · Vitest · ESLint + Prettier. Alias `@/*` → `src/*`.

## Comandos

| Ação | Comando |
| --- | --- |
| Instalar | `npm install` |
| Servidor de desenvolvimento | `npm run dev` |
| Checar tipos | `npx tsc -b --noEmit` |
| Lint | `npm run lint` |
| Testes | `npm test` |
| Build / preview do build | `npm run build` · `npm run preview` |

O script `build` roda `tsc -b && vite build`, então erro de tipo impede o build.

## `src/profile.json`

```json
{
  "identity": { "handle": "HarryChrist", "uid": 1, "title": "FullStack Developer", "bio": "…" },
  "seo": {
    "title": "LinkCard - HarryChrist",
    "description": "…",
    "url": "https://card.hchrist.com",
    "image": "",
    "icon": "",
    "themeColor": "#08090c",
    "lang": "pt-BR"
  },
  "theme": {
    "accent": "#8ab4ff",
    "cardStyle": "glass",
    "cardShape": "rounded",
    "nameEffect": "shimmer",
    "avatarShape": "circle",
    "avatarSize": "lg",
    "font": "jetbrains",
    "buttonTheme": "glass"
  },
  "media": {
    "avatarUrl": "…",
    "bannerUrl": "…",
    "backgroundVideoUrl": "https://www.youtube.com/watch?v=…",
    "musicUrl": ""
  },
  "badges": [{ "label": "Developer", "color": "#8ab4ff" }],
  "links": [{ "label": "", "url": "https://github.com/harryChrist", "icon": "github" }],
  "presence": { "username": "Chomusuke", "activity": "…", "status": "online", "avatarUrl": "…" }
}
```

Valores aceitos em `theme` (qualquer coisa fora da lista cai no padrão sem quebrar a página):

| Campo | Valores |
| --- | --- |
| `accent` | hexadecimal, controla acentos, bordas, focus ring e halo |
| `cardStyle` | `glass` · `solid` · `outline` · `neon` |
| `cardShape` | `rounded` 26px · `soft` 36px · `square` 12px |
| `nameEffect` | `none` · `glow` · `gradient` · `rainbow` · `shimmer` · `typewriter` |
| `avatarShape` | `circle` · `squircle` · `square` |
| `avatarSize` | `sm` 72 · `md` 84 · `lg` 96 · `xl` 112 (px) |
| `font` | `jetbrains` · `manrope` · `inter` · `jakarta` · `poppins` · `montserrat` · `oswald` · `raleway` · `rubik` · `nunito` · `grotesk` · `bebas` · `playfair` |
| `buttonTheme` | `glass` · `solid` · `outline` · `sharp` · `pill` |

Outras regras: `title`/`bio` vazios escondem o bloco; badge com `label` vazio e link com `url` vazia
são filtrados; link **sem** `label` vira botão só de ícone; `presence.status` aceita `online` · `idle` ·
`dnd` · `offline` (desconhecido vira `offline`).

### Nome, SEO e ícone

`seo` é opcional; vazio, cada campo cai em algo derivado do resto do JSON — título `<handle> - LinkCard`,
descrição vinda da `bio`, imagem social do `bannerUrl` (e depois do `avatarUrl`) e ícone `/logo.svg`.

| Campo | Vai para |
| --- | --- |
| `title` | título da aba, `og:title`, `twitter:title` |
| `description` | `<meta name="description">`, `og:description`, `twitter:description` |
| `url` | `canonical` e `og:url`; é a base para tornar caminhos relativos absolutos |
| `image` | `og:image` e `twitter:image` |
| `icon` | favicon (SVG, PNG, ICO…; o `type` sai da extensão) |
| `themeColor` | cor da barra do navegador no celular |
| `lang` | `lang` do `<html>` e `og:locale` |

O bloco é gravado **no `index.html` durante o build** a partir do JSON — é o que o Discord, o Slack e os
buscadores leem, porque nenhum deles executa o JavaScript — e reaplicado no DOM em tempo de execução. Junto
vai um JSON-LD `Person` com nome, cargo, bio, avatar e `sameAs` dos links. `keywords` ficou de fora de
propósito (buscadores ignoram) e o `public/manifest.webmanifest` da instalação como app é estático à parte.

### Ícones dos links

| Valor de `icon` | Resultado |
| --- | --- |
| `""` | sem ícone |
| `https://exemplo.com/icone.svg` | a imagem informada |
| `set:name` (ex.: `mdi:web`) | Iconify |
| slug (ex.: `github`, `instagram`) | SimpleIcons CDN, com fallback automático para Iconify |
| `linkedin` | Iconify direto (o slug é bloqueado no CDN) |
| qualquer outra string (emoji) | desenhada como texto |

Ao falhar, a imagem troca **uma única vez** para o fallback — sem ciclo de `onError`.

## Vídeo, áudio e responsividade

- O vídeo vive **só no papel de parede da página** (`fixed inset-0`); o banner da carta é sempre a
  imagem estática de `media.bannerUrl`. Existe **uma única instância** de player.
- `backgroundVideoUrl` aceita URL do YouTube (`watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`) ou URL
  direta de vídeo. String vazia desliga o fundo.
- As legendas automáticas do YouTube são desligadas: `cc_load_policy=0` **não** basta (o player
  escolhe o track ASR sozinho), então o app descarrega os módulos de caption e limpa o track
  selecionado pelo canal de comandos do player, reenviando enquanto a reprodução começa.
- Redimensionar não reinicia nem remonta o player. O `currentTime` fica numa ref compartilhada e é
  reaplicado em caso de remontagem (StrictMode, troca de fonte), com mute/volume restaurados.
-O áudio **começa mutado** (política de autoplay). O sound dock tem mute/unmute, slider 0–100 (padrão 70) e a
porcentagem ao lado, em largura fixa para o dock não se mexer; arrastar acima de zero liga o som e o primeiro gesto **fora** do dock também (cliques
  dentro do dock são ignorados por esse listener). Com `musicUrl` preenchido, a trilha separada toca
  e o vídeo permanece mutado.

## Imagens locais

Copie o arquivo para `public/` e referencie com caminho absoluto (`"avatarUrl": "/avatar.png"`).

## Tamanho e Git

- **Nunca** versione nem coloque masters grandes em `public/`: tudo lá é copiado para o deploy e o
  GitHub rejeita blobs acima de 100 MiB. Prefira YouTube ou um vídeo pequeno.
- `.gitignore` só evita inclusão futura — ele **não** limpa o histórico, que é outra operação.
- [`scripts/build-background-video.sh`](scripts/build-background-video.sh) converte um master externo em
  MP4 otimizado + HLS VOD (`--input` obrigatório, escrita em `.partial`, validação do manifest). É
  **opcional e não está ligado ao player**: hoje o fundo é YouTube ou vídeo direto (não há `hls.js`).

## Estrutura

```text
index.html                  shell + bloco SEO gerado do profile.json
public/                     logo.svg, manifest.webmanifest
scripts/                    build-background-video.sh (opcional)
src/
  main.tsx                  entrypoint, error boundary, Toaster
  index.css                 Tailwind v4, tokens escuros, animações
  profile.json              TODO o conteúdo editável
  pages/Profile.tsx         composição da página, player, áudio, som
  components/profile/       ProfileCard.tsx (carta + catálogos), SoundDock.tsx
  components/ui/sonner.tsx  toaster
  lib/                      profile.ts + profileTypes.ts (validação), seo.ts + seoDom.ts
                            (título, meta tags, JSON-LD), youtube.ts, iconSource.ts, utils.ts
```

Testes unitários das funções puras: `src/lib/*.test.ts` (`npm test`).

## Acessibilidade

`<main>` + um `<h1>`, links com nome acessível e `rel="noopener noreferrer"`, botão de mute e slider
nomeados, foco visível, imagens decorativas com `alt=""` e avatar com o nome do perfil. Em
`prefers-reduced-motion` as animações param e **nenhum conteúdo depende delas** para aparecer (o nome
com gradiente cai para texto sólido e o `typewriter` já entra revelado). Falha de rede em avatar,
ícone ou vídeo não derruba a página.
