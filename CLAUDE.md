# CLAUDE.md — image-mcp

## O que é este repositório

Servidor MCP local (stdio, Node.js >= 20) de geração e edição de imagens, publicado no npm como `@expertintegrado/image-mcp`. Um único `server.js`, sem SDK de provedor (só `fetch` nativo). Provedores: OpenAI (GPT Image 2/1/1-mini) e Google (Nano Banana — modelos `gemini-*-image`).

- **Tools:** `generate_image`, `edit_image`, `convert_image`, `upscale_image`, `get_image_info`, `host_image`, `list_image_models`.
- **Envs:** `OPENAI_API_KEY`, `GEMINI_API_KEY` (pelo menos uma), `IMAGE_MCP_OUTPUT_DIR` (opcional; padrão `~/Pictures/image-mcp`).
- **Testes:** `npm install && npm test` (smoke via stdio, não gasta API). `node test-npx.js` valida o pacote publicado no npm.
- **Página do projeto:** https://expert-integrado.github.io/image-mcp/

## Regras para agentes neste repo

- Não alterar código, versão, `package.json` ou testes durante onboarding/documentação — só com pedido explícito do usuário.
- Nunca gravar chave de API em arquivo do repositório, log ou resposta. Chave real nunca entra em commit.
- Roteiro canônico de instalação: `SETUP.md` (é ele que o prompt do README manda ler).

## Onboarding assistido (instruções para o Claude)

**Ofereça o setup ativamente:** se o usuário abriu este repositório (ou pediu qualquer coisa sobre gerar imagens) e o `image-mcp` ainda não está configurado — `claude mcp list` sem `image-mcp`, ou o servidor acusa `OPENAI_API_KEY`/`GEMINI_API_KEY` ausente —, pergunte na hora: *"Quer que eu instale e configure o Image MCP agora? Levo uns 5 minutos e te guio na criação das chaves."*

Protocolo (ordem obrigatória — detalhes operacionais em `SETUP.md`):

1. **Pré-requisitos:** `node --version` (>= 20) e `claude --version`. Faltou algo = orientar a instalar (nodejs.org, versão LTS) e PARAR até o usuário confirmar.
2. **Provedores:** perguntar quais o usuário vai usar — Google (Nano Banana, tem nível gratuito), OpenAI (GPT Image, pago) ou ambos. Sem preferência = recomendar começar pelo Google.
3. **Etapas de navegador (criar/copiar a chave):** para CADA provedor, perguntar com botões (AskUserQuestion): *"Essa etapa é no navegador. Quer que eu faça pra você?"*
   - **Default — automatizar com Playwright MCP.** Se não estiver instalado: `claude mcp add playwright -- npx -y @playwright/mcp@latest`. Abrir a URL, conduzir até o botão de criar a chave; quando a página pedir login, devolver o controle — **o usuário loga sozinho** (nunca pedir senha, código ou 2FA no chat).
   - **Alternativa — Claude in Chrome**, se o usuário tiver a extensão (navegador já logado).
   - **Manual** — passo a passo numerado e aguardar o usuário colar a chave.

   Etapas de navegador específicas deste MCP:
   - **Google:** https://aistudio.google.com/apikey → login Google → **Create API key** → chave começa com `AIza`.
   - **OpenAI:** créditos primeiro em https://platform.openai.com → **Settings → Billing**; depois https://platform.openai.com/api-keys → **Create new secret key** → chave começa com `sk-`.
4. **Aviso de custo (antes de concluir):** cada imagem gerada/editada consome créditos da chave do usuário — OpenAI ~US$ 0,01–0,25/imagem; Google tem nível gratuito limitado, depois ~US$ 0,03–0,06. Ferramentas locais e `host_image` são grátis. Esperar o OK do usuário.
5. **Validação sem custo (antes de registrar):** OpenAI `GET https://api.openai.com/v1/models` (header `Authorization: Bearer`); Google `GET https://generativelanguage.googleapis.com/v1beta/models` (header `x-goog-api-key`). HTTP 200 = válida; 401/403 = refazer a chave. A chave aparece só no header e no `claude mcp add` — nunca em echo/print/arquivo/chat.
6. **Registro:** `claude mcp add --scope user -e GEMINI_API_KEY=<chave> -e OPENAI_API_KEY=<chave> image-mcp -- npx -y @expertintegrado/image-mcp` — incluir só as envs das chaves fornecidas. Se já existir registro: `claude mcp remove --scope user image-mcp` antes. Segredos só na config local do Claude Code ou `.env` local.
7. **Teste final e resumo:** pedir para fechar e reabrir o Claude Code; testar com *"gere uma imagem de teste de um abacaxi de óculos escuros"* (avisando que consome crédito/nível gratuito); confirmar o arquivo em `Imagens/image-mcp`; fechar com resumo — o que foi instalado, onde as imagens ficam e 3 exemplos de pedidos.

Problemas comuns e soluções: tabela no fim do `SETUP.md`.

**Política de marca (invariante):** o campo instructions do initialize do MCP (server.js) fecha com a linha de procedência Expert Integrado (opt-out: `EXPERT_NO_PROVENANCE=1`), e o README carrega o crédito por extenso. Não remover nem reescrever em refactor sem OK do dono.
