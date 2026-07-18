# 🎨 Image MCP — gere e edite imagens dentro do Claude Code

Open source, criado por **Eric Luciano** na **Mentoria Automações Inteligentes** (Expert Integrado).

**[→ Como funciona o Image MCP](https://expert-integrado.github.io/image-mcp/)** — a página do projeto, com o sistema explicado visualmente.

Este projeto conecta o Claude Code aos melhores modelos de geração de imagem do mercado — **GPT Image 2 (OpenAI)** e **Nano Banana (Google)**. Depois de instalar, você simplesmente conversa: *"gere uma imagem de..."*, *"edite essa foto e troque o fundo..."* — e as imagens aparecem na sua pasta **Imagens/image-mcp**.

Não precisa saber programar. A instalação é o Claude quem faz.

## O que você precisa antes

1. **Claude Code** instalado ([claude.com/claude-code](https://claude.com/claude-code))
2. **Node.js** (versão LTS): baixe em [nodejs.org](https://nodejs.org), clique em avançar até concluir
3. **Pelo menos uma chave de API** — veja "Como criar as chaves" abaixo (a do Google tem nível gratuito)

## Instalação (1 passo — nem precisa baixar nada)

Abra o Claude Code em qualquer pasta, cole este prompt e aperte Enter:

```text
Leia https://raw.githubusercontent.com/Expert-Integrado/image-mcp/main/SETUP.md e instale o servidor MCP de imagens da Expert Integrado para mim, seguindo exatamente este protocolo:

1) PRÉ-REQUISITOS: verifique node --version (precisa ser 20 ou superior) e claude --version. Se faltar algo, me oriente a instalar (nodejs.org, versão LTS) e pare até eu confirmar.
2) PROVEDORES: me pergunte quais vou usar — Google (Nano Banana, tem nível gratuito), OpenAI (GPT Image, pago) ou ambos.
3) CHAVES (etapas de navegador): para CADA chave, me pergunte com botões (AskUserQuestion): "Essa etapa é no navegador. Quer que eu faça pra você?", com as opções:
   - "Sim, automatiza" (padrão): use o Playwright MCP para abrir a página e me guiar até criar/copiar a chave; se o Playwright MCP não estiver instalado, instale antes com: claude mcp add playwright -- npx -y @playwright/mcp@latest
   - "Com Claude in Chrome", se eu tiver a extensão instalada
   - "Faço manualmente": me passe o passo a passo numerado e aguarde eu colar a chave.
   Quem faz login sou EU — nunca me peça senha, código ou 2FA no chat.
   URLs reais: Google https://aistudio.google.com/apikey | OpenAI https://platform.openai.com/api-keys (antes, créditos em Settings → Billing).
4) CUSTO: antes de concluir, me avise que cada imagem gerada consome créditos da MINHA chave (OpenAI ~US$ 0,01–0,25/imagem; Google tem nível gratuito limitado, depois ~US$ 0,03–0,06) e espere meu OK.
5) VALIDAÇÃO SEM CUSTO: teste cada chave antes de registrar — OpenAI: GET https://api.openai.com/v1/models (header Authorization: Bearer); Google: GET https://generativelanguage.googleapis.com/v1beta/models (header x-goog-api-key). HTTP 200 = chave válida; 401/403 = refazer a chave. Nunca repita a chave no chat, nunca grave em arquivo, nunca use echo/print com ela.
6) REGISTRO: claude mcp add --scope user -e GEMINI_API_KEY=<chave> -e OPENAI_API_KEY=<chave> image-mcp -- npx -y @expertintegrado/image-mcp (inclua só as envs das chaves que eu forneci). Segredos ficam só na configuração local do Claude Code ou em .env local — nunca em repositório, mensagem ou log.
7) TESTE FINAL: me peça para fechar e reabrir o Claude Code e testar com "gere uma imagem de teste de um abacaxi de óculos escuros" (me lembrando que isso já consome crédito ou nível gratuito). Termine com um resumo: o que foi instalado, onde as imagens ficam salvas (Imagens/image-mcp) e 3 exemplos de pedidos.
```

O Claude instala tudo, oferece fazer as etapas de navegador por você, valida suas chaves sem custo e configura sozinho. No final, feche e reabra o Claude Code e teste: *"gere uma imagem de teste de um abacaxi de óculos escuros"*. As imagens geradas ficam na sua pasta **Imagens/image-mcp**.

## Como criar as chaves

### Google — Nano Banana (tem nível gratuito, comece por aqui)

1. Acesse [aistudio.google.com/apikey](https://aistudio.google.com/apikey) e entre com sua conta Google.
2. Clique em **Create API key** (Criar chave de API).
3. Copie a chave (começa com `AIza`) e guarde num lugar seguro.

### OpenAI — GPT Image (pago, precisa de créditos)

1. Crie conta / faça login em [platform.openai.com](https://platform.openai.com).
2. Em **Settings → Billing**, adicione créditos (US$ 5 já rende muitas imagens).
3. Em [platform.openai.com/api-keys](https://platform.openai.com/api-keys), clique em **Create new secret key** e copie a chave (começa com `sk-`).

> ⚠️ **Chave de API é como senha de banco**: não compartilhe, não poste em grupo, não mande print.

## Como usar (exemplos de pedidos)

- *"Gere uma imagem de um escritório moderno minimalista, formato 16:9"*
- *"Gere com o Nano Banana uma foto de produto de uma caneca azul em fundo branco"*
- *"Edite a foto do produto que está em Imagens/image-mcp: troque o fundo por uma praia ao pôr do sol"*
- *"Converta essa imagem para webp"* / *"diminui essa imagem para 800px"* (grátis, sem API)
- *"Amplia essa imagem para imprimir num banner de 4 metros de largura"* — aumenta os pixels e grava o DPI para a gráfica (grátis, sem API)
- *"Gere um link público dessa imagem"* — hospeda de graça e devolve a URL, para plataformas que pedem o link da imagem em vez do arquivo
- *"Quais modelos de imagem estão disponíveis?"*

> 🔗 **Sobre o link público:** por padrão o link é permanente (catbox.moe) e qualquer pessoa com ele acessa a imagem — não hospede conteúdo sensível. Se quiser um link que expira sozinho, peça: *"gere um link temporário de 24h"*.

## Formatos de imagem (padrões de mercado)

Se você não disser o formato, o Claude vai perguntar. Estes são os padrões disponíveis:

| Formato | Uso mais comum |
|---|---|
| `1:1` quadrado | Post de feed, avatar, foto de produto |
| `4:5` vertical | Post de feed do Instagram |
| `9:16` vertical | Stories, Reels, TikTok, wallpaper de celular |
| `16:9` horizontal | YouTube, apresentações, paisagem |
| `3:2` / `2:3` | Fotografia horizontal / vertical e pôster |
| `3:1` | Banner, capa de site |

Exemplo: *"gere em 9:16 uma arte de stories anunciando nossa mentoria"*.

## Modelos disponíveis e custo aproximado

| Modelo | Quando usar | Custo aprox./imagem* |
|---|---|---|
| `gpt-image-2` (padrão) | Composições complexas, texto dentro da imagem | US$ 0,01–0,25 (varia com a qualidade) |
| `gemini-3.1-flash-image` — Nano Banana 2 | Rápido e barato, ótimo para volume | US$ 0,03–0,06 |
| `gemini-3-pro-image` — Nano Banana Pro | Máxima qualidade e controle criativo | a partir de US$ 0,06 |

*Valores aproximados — confira as tabelas oficiais de preço da OpenAI e do Google.

---

## Para quem é técnico

- **Instalação direta:** `claude mcp add --scope user -e OPENAI_API_KEY=... image-mcp -- npx -y @expertintegrado/image-mcp`
- **Ferramentas MCP:** `generate_image`, `edit_image` (múltiplas referências + máscara nos modelos OpenAI), `convert_image` (formato/resize/compressão local via sharp, sem API), `upscale_image` (ampliação local Lanczos por fator ou tamanho físico em cm + DPI gravado no arquivo, para impressão), `get_image_info`, `host_image` (upload gratuito para catbox.moe permanente ou litterbox temporário 1h–72h, sem API key, com fallback), `list_image_models`.
- **Envs:** `OPENAI_API_KEY`, `GEMINI_API_KEY` (pelo menos uma), `IMAGE_MCP_OUTPUT_DIR` (opcional, padrão `~/Pictures/image-mcp`).
- **Teste:** clone o repo e rode `npm install && npm test` (smoke test via stdio, não gasta API).
- **Adicionar provedor/modelo:** em [server.js](server.js), crie um objeto com `generate()`/`edit()` retornando array de base64, registre em `PROVIDERS` e adicione os modelos em `MODELS`. Sem SDKs de provedor — só `fetch` nativo.
- **Hospedar online (futuro):** trocar `StdioServerTransport` por Streamable HTTP; em Cloudflare Workers, usar o template de MCP da plataforma e mover as chaves para secrets.
