# Linkcard

Linkcard é um perfil pessoal tipo *link-in-bio* em página única: uma carta de perfil centralizada
sobre um vídeo de fundo escuro, com avatar, nome, badges, biografia, presença estilo Discord,
links sociais e um pequeno controle de volume no canto inferior direito.

O projeto é **puramente estático**: não existe backend, banco de dados, login, registro, comentários,
contador de visitas, roteador ou editor autenticado. Todo o conteúdo exibido na página vem de um
único arquivo editável, [`src/profile.json`](src/profile.json). O único estado que não vive nesse
arquivo é o estado transitório do player de vídeo e dos controles de áudio.

Trocar o conteúdo do perfil (nome, bio, cores, links, vídeo, badges, presença) significa editar o
JSON e recarregar a página — nenhum componente precisa ser alterado.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Build/dev server | Vite 7 |
| Linguagem | TypeScript 5.9 em modo estrito |
| UI | React 19 + `react-dom` |
| Estilos | Tailwind CSS 4 via `@tailwindcss/vite` |
| Ícones de interface | `lucide-react` |
| Classes utilitárias | `clsx` + `tailwind-merge` (função `cn()`) |
| Toaster | `sonner` (tema fixo `dark`) |
| Testes | Vitest |
| Lint/format | ESLint 9 + Prettier |

Alias de importação: `@/*` → `src/*`.

---

## Comandos

O gerenciador de pacotes usado neste ambiente é o **npm** (o Bun não está instalado na máquina
hospedeira). Os comandos equivalentes com Bun estão listados ao lado.

| Ação | npm | Bun (opcional) |
| --- | --- | --- |
| Instalar dependências | `npm install` | `bun install` |
| Servidor de desenvolvimento | `npm run dev` | `bun dev` |
| Checagem de tipos | `npx tsc -b --noEmit` | `bun tsc -b --noEmit` |
| Lint | `npm run lint` | `bun lint` |
| Testes unitários | `npm test` | `bun test` |
| Build de produção | `npm run build` | `bun run build` |
| Preview do build | `npm run preview` | `bun preview` |
| Formatação | `npm run format` | `bun run format` |

O script `build` roda `tsc -b && vite build`, ou seja, os erros de tipo impedem o build.

Os testes unitários cobrem as funções puras do projeto (`npm test`):

- [`src/lib/youtube.test.ts`](src/lib/youtube.test.ts) — extração de ID a partir de URLs do YouTube
  (`watch?v=`, `youtu.be/`, `/embed/`, `/shorts/`) e rejeição de URLs inválidas, além da montagem da
  URL de embed.
- [`src/lib/iconSource.test.ts`](src/lib/iconSource.test.ts) — resolução de ícones de link
  (URL direta, `set:name`, slug do SimpleIcons, slug bloqueado, emoji/texto e string vazia).
- [`src/lib/profile.test.ts`](src/lib/profile.test.ts) — mapeamento do `profile.json` e degradação
  segura quando o JSON está incompleto ou inválido.
- [`src/lib/utils.test.ts`](src/lib/utils.test.ts) — `cn()` e as classes customizadas que **não**
  podem ser descartadas pelo `tailwind-merge`.

---

## Estrutura de pastas

```text
index.html                              # shell HTML, fontes, manifest, #root
package.json
vite.config.ts                          # React + Tailwind v4 + alias @/ + dedupe de react
tsconfig.json / tsconfig.app.json / tsconfig.node.json
eslint.config.js
.prettierrc
.gitignore
public/
  logo.svg                              # favicon / ícone do manifest
  manifest.webmanifest                  # manifest PWA
scripts/
  build-background-video.sh             # conversor opcional de fonte -> MP4 + HLS (ver seção HLS)
src/
  main.tsx                              # entrypoint React, error boundaries, Toaster
  index.css                             # Tailwind v4, tokens escuros, animações
  profile.json                          # TODO o conteúdo editável do perfil
  vite-env.d.ts
  pages/
    Profile.tsx                         # composição da página, player de vídeo, áudio, gesto global
  components/
    profile/
      ProfileCard.tsx                   # visual da carta + catálogos de opções
      SoundDock.tsx                     # dock fixo de mute + volume
    ui/
      sonner.tsx                        # wrapper do toaster temático
  lib/
    utils.ts                            # cn()
    iconSource.ts                       # iconSource(), accessibleLinkName()
    profile.ts                          # buildProfileView(), readMedia() (validação em runtime)
    youtube.ts                          # parseYouTubeId(), buildYouTubeEmbedUrl(), postMessage helpers
    utils.test.ts
    iconSource.test.ts
    profile.test.ts
    youtube.test.ts
```

---

## Referência do `src/profile.json`

O JSON é dividido em seis blocos: `identity`, `theme`, `media`, `badges`, `links` e `presence`.
Todos os campos são opcionais na prática — valores vazios simplesmente escondem o bloco
correspondente, e valores desconhecidos caem em um padrão seguro sem quebrar a página
(`glass` / `rounded` / `circle` / `lg` / JetBrains Mono).

### `identity`

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `handle` | string | Nome de usuário **sem** `@`. A interface exibe `@handle`. |
| `uid` | number | Identificador público, mostrado como `#uid` em tooltip ao passar o mouse ou focar a identidade. |
| `title` | string | Cargo/título. Exibido em caixa alta com tracking largo. String vazia oculta o bloco. |
| `bio` | string | Biografia curta e centralizada. String vazia oculta o bloco. |

### `theme`

| Campo | Valores permitidos | Padrão | Efeito |
| --- | --- | --- | --- |
| `accent` | hexadecimal (ex. `#8ab4ff`) | `#8ab4ff` | Controla acentos, bordas, focus ring, halo e as CSS variables do card. |
| `cardStyle` | `glass`, `solid`, `outline`, `neon` | `glass` | Superfície da carta. `glass` tem fallback sólido sem `backdrop-filter`. |
| `cardShape` | `rounded`, `soft`, `square` | `rounded` | Raio dos cantos: 26px, 36px e 12px. |
| `nameEffect` | `none`, `glow`, `gradient`, `rainbow`, `shimmer`, `typewriter` | `shimmer` | Animação do nome. Com movimento reduzido o texto continua completo e legível. |
| `avatarShape` | `circle`, `squircle`, `square` | `circle` | Forma do avatar. |
| `avatarSize` | `sm`, `md`, `lg`, `xl` | `lg` | 72px, 84px, 96px e 112px. |
| `font` | `jetbrains`, `manrope`, `inter`, `jakarta`, `poppins`, `montserrat`, `oswald`, `raleway`, `rubik`, `nunito`, `grotesk`, `bebas`, `playfair` | `jetbrains` | Fonte da carta (JetBrains Mono, Manrope, Inter, Plus Jakarta Sans, Poppins, Montserrat, Oswald, Raleway, Rubik, Nunito, Space Grotesk, Bebas Neue, Playfair Display). |
| `buttonTheme` | `glass`, `solid`, `outline`, `sharp`, `pill` | `glass` | Estilo dos botões de link. |

### `media`

| Campo | Formato | Descrição |
| --- | --- | --- |
| `avatarUrl` | URL absoluta ou caminho local (`/arquivo.png`) | Imagem do avatar. O `alt` usa o nome do perfil (`handle`). |
| `bannerUrl` | URL absoluta ou caminho local | Artwork estático do topo da carta; também é usado como pôster do vídeo de fundo. |
| `backgroundVideoUrl` | URL de YouTube ou URL direta de vídeo | Fundo da página. String vazia desliga o fundo. |
| `musicUrl` | URL direta de áudio | Trilha sonora separada. String vazia desliga a música. |

### `badges`

Lista de objetos `{ "label": string, "color": string }`. Cada badge é uma cápsula pequena com a cor
configurada e texto escuro para contraste. Badges com `label` vazio são filtrados.

```json
{ "label": "Developer", "color": "#8ab4ff" }
```

### `links`

Lista de objetos `{ "label": string, "url": string, "icon": string }`.

- Links com `url` vazia são filtrados.
- Links **com** `label` ocupam cerca de metade da linha, em duas colunas.
- Links **sem** `label` viram botões compactos só de ícone, centralizados.

```json
{ "label": "", "url": "https://github.com/harryChrist", "icon": "github" }
```

### `presence`

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `username` | string | Nome exibido na caixa de presença. |
| `activity` | string | Atividade atual; texto longo é truncado com reticências. |
| `status` | `online`, `idle`, `dnd`, `offline` | Cor do ponto de status. Valor desconhecido vira `offline`. |
| `avatarUrl` | string | Avatar redondo da presença, com o ponto de status sobreposto. |

---

## Como funcionam os ícones dos links

O campo `icon` de cada link é resolvido por uma função pura, [`iconSource()`](src/lib/iconSource.ts):

| Valor de `icon` | Resultado |
| --- | --- |
| `""` (vazio) | Nenhum ícone. |
| `https://exemplo.com/icone.svg` | Carrega a imagem fornecida. |
| `set:name` (ex. `mdi:web`, `mdi:book-open-variant`) | Ícone do Iconify: `https://api.iconify.design/{set}/{name}.svg?color=%23ffffff`. |
| Slug simples (ex. `github`, `instagram`, `discord`) | SimpleIcons CDN (`https://cdn.simpleicons.org/{slug}/ffffff`), com fallback automático para Iconify. |
| `linkedin` | Slug bloqueado no CDN do SimpleIcons — usa Iconify diretamente. |
| Qualquer outra string (emoji, símbolo) | Renderizada como texto. |

Todos os ícones são monocromáticos (branco) e os links têm `aria-label` adequado. Links sem label
derivam o nome acessível do slug ou da URL. Links externos usam `target="_blank"` com
`rel="noopener noreferrer"`. Se uma imagem falhar, o componente troca **uma única vez** para o
fallback, sem criar ciclo de `onError`.

---

## Imagens locais

1. Copie o arquivo para `public/` (ex.: `public/avatar.png`).
2. Referencie com caminho absoluto no JSON: `"avatarUrl": "/avatar.png"`.

Tudo que está em `public/` é copiado **sem alteração** para o deploy, então mantenha apenas
arquivos pequenos e realmente publicados.

---

## Vídeo de fundo

O campo `media.backgroundVideoUrl` aceita:

- **URL do YouTube** — `watch?v=`, `youtu.be/`, `/embed/` ou `/shorts/`. O vídeo é embutido via
  `youtube-nocookie.com/embed/{id}` com autoplay, mute, loop, sem controles, `playsinline` e
  controles de som por `postMessage` (a URL é normalizada por `buildYouTubeEmbedUrl()`).
- **Sem legendas:** o embed vai com `cc_load_policy=0` e, assim que o canal de comandos do player
  responde, os módulos `captions`/`cc` são descarregados (`postYouTubeUnloadModules()`), para nenhuma
  faixa de legenda ser desenhada sobre o vídeo de fundo.
- **Retomada no breakpoint:** como os comandos enviados logo após o `load` do iframe podem ser
  ignorados, o estado só é aplicado quando o player envia o primeiro `infoDelivery` (prova de que o
  canal está vivo). O seek é repetido até 4 vezes caso o player reinicie, e a posição compartilhada
  não é sobrescrita pelo `currentTime: 0` que o iframe novo reporta na primeira mensagem.
- **URL direta de arquivo de vídeo** (ex. `/videos/background.mp4`) — tocado como
  `<video autoPlay muted loop playsInline>` com `object-cover`. A razão de aspecto real
  (`videoWidth`/`videoHeight`) é lida em `loadedmetadata` e comunicada ao card.
- **String vazia** — desliga o fundo.

---

## Áudio e o sound dock

- O áudio **começa mutado**, porque os navegadores bloqueiam autoplay com som.
- O **sound dock** fixo no canto inferior direito tem um botão mute/unmute
  (`Enable sound` / `Mute sound`, com ícones `VolumeX`/`Volume2`) e um slider de **0 a 100**
  (step 1, volume padrão **70**).
- Arrastar o slider para um valor maior que zero habilita o som automaticamente.
- O **primeiro gesto global** (`pointerdown`, `touchstart` ou `keydown`) fora do dock também
  habilita o som. Cliques dentro do dock são ignorados por esse listener (o dock é marcado com
  `data-sound-dock`), então clicar no dock não é imediatamente desfeito.
- Quando existe `musicUrl`, a trilha separada é quem recebe o som e o vídeo de fundo permanece
  mutado, para os dois áudios não se sobreporem.

---

## Vídeo de fundo e responsividade

O vídeo vive em **um único lugar**: o papel de parede da página. Ele é `fixed inset-0`, cobre a
tela atrás da carta em qualquer largura de viewport (com camadas escuras e vinheta para
legibilidade), e existe **uma única instância de player montada por vez**. O banner da carta é
sempre a imagem estática de `media.bannerUrl` — o vídeo não é duplicado dentro da carta.

Como o elemento nunca é remontado por causa de um resize, redimensionar não interrompe a
reprodução. Ainda assim o estado é preservado entre remontagens (StrictMode em dev, troca de
`backgroundVideoUrl`): o `currentTime` fica numa ref compartilhada em
[`Profile.tsx`](src/pages/Profile.tsx), atualizada a cada `timeupdate` (vídeo direto) e pelas
mensagens do player (YouTube). Na remontagem, o valor é reaplicado com proteção contra `NaN`,
`Infinity`, duração desconhecida e seek anterior ao `loadedmetadata`, e o mute/volume é restaurado.
Para o YouTube, o estado só é aplicado quando o player envia o primeiro `infoDelivery` (prova de
que o canal de comandos está vivo), com até 4 tentativas de `seekTo` — inclusive porque o iframe
novo reporta `currentTime: 0` na primeira mensagem.

`ProfileCard` mantém as props opcionais `bannerVideo`/`bannerAspectRatio` e a classe
`.layer-iframe-cover--zoomed` para quem quiser um vídeo no cabeçalho da carta; esta página não as
usa.

---

## Limites de vídeo, espaço e Git

1. **Nunca coloque o vídeo-fonte grande dentro de `public/`** nem no Git. Arquivos públicos são
   copiados sem alteração para o deploy e incham o pacote.
2. **O GitHub rejeita blobs acima de 100 MiB.** Um master de ~150 MB não pode entrar no commit nem
   no histórico. Prefira YouTube/embed ou um serviço externo para originais grandes.
3. Para hospedagem local, use apenas um MP4 otimizado pequeno e **meça os bytes de todos os arquivos
   publicados** (assets + bundle), cumprindo o limite da plataforma com folga. Reduza resolução e
   bitrate se necessário em vez de assumir que o total cabe.
4. O `.gitignore` **só impede inclusão futura**. Ele **não limpa o histórico**: se um arquivo grande
   já foi commitado, removê-lo do histórico é uma operação separada e deve ser feita por quem
   controla o repositório. Ignorar um arquivo não conserta um push que já contém o blob.

---

### Extensão opcional: HLS (não ativa neste build)

Existe o script [`scripts/build-background-video.sh`](scripts/build-background-video.sh), que
converte uma fonte de vídeo em um fallback MP4 (H.264/AAC, faststart) mais uma playlist HLS
(`master.m3u8` + segmentos `.ts`), com codificação em blocos retomáveis e validação de
manifest/segmentos.

**Importante:** nesta build o player **não** está ligado a HLS. Não há `hls.js` instalado nem campo
`backgroundHlsUrl` no JSON; `Profile.tsx` suporta apenas YouTube iframe ou URL direta de vídeo. O
script está disponível para quem quiser evoluir nessa direção, mas seu output não é consumido por
nenhum código hoje.

O script foi executado em um fonte de teste real: produziu o MP4 com `+faststart`, um `master.m3u8`
VOD com `#EXT-X-ENDLIST`, validou todos os segmentos referenciados e imprimiu o resumo de bytes. Ele
exige `--input` apontando para uma fonte fora do repositório, escreve tudo como `.partial` e só
promove com `mv` depois de validar.

Para ativar HLS no futuro, seria necessário: instalar `hls.js`; adicionar `backgroundHlsUrl` ao
`profile.json`; dar prioridade a HLS sobre MP4, usando HLS nativo no Safari
(`canPlayType('application/vnd.apple.mpegurl')`) e `hls.js` nos demais navegadores; cair uma única
vez para o MP4 otimizado em erro fatal; e destruir a instância de `Hls` no cleanup sem perder o
`currentTime`. Além disso, o servidor precisa entregar os MIME types corretos para `.m3u8` e `.ts`
(muitos dev servers não entregam), então valide no host final ou use um CDN/objeto de armazenamento.
A fonte de conversão deve ficar **fora** de `public/` e fora do repositório.

---

## Acessibilidade e movimento reduzido

- Semântica com `<main>` e `<section>`, um único `<h1>`, links com nomes acessíveis, botão de mute e
  slider ambos nomeados.
- Alt do avatar usa o nome do perfil; imagens decorativas/banner usam `alt=""`.
- Foco de teclado tem ring visível e contrastante.
- `prefers-reduced-motion` é respeitado: as animações (entrada da carta, shimmer do nome, reflexo
  dos links, pulse do mute) são desligadas ou reduzidas, e **nenhum conteúdo depende de animação
  para aparecer**. O nome com efeito `typewriter` mantém o texto completo no DOM, então continua
  legível.
- Falhas de rede em avatar, ícone ou vídeo não derrubam o app: o ícone tem fallback único e erros de
  autoplay são capturados com `.catch`, mantendo o vídeo mudo como caminho inicial.
- Sem overflow horizontal; textos longos quebram e a presença trunca.
