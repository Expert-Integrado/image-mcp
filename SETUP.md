# SETUP.md — roteiro de instalação (para o Claude Code executar)

Você (Claude) está instalando o servidor MCP `image-mcp` da Expert Integrado para o usuário. Siga os passos na ordem. Fale com o usuário em português simples, sem jargão técnico. Muitos usuários não são programadores — este é um onboarding assistido: você faz o máximo possível e oferece automatizar o que acontece no navegador.

**Regras de segurança (valem o roteiro inteiro):**

- Nunca repita uma chave de API de volta na conversa, nunca a grave em arquivo, nunca a exiba com echo/print/log.
- A chave só pode aparecer em dois lugares: no header da requisição de validação (passo 4) e dentro do comando `claude mcp add` (passo 5).
- Login é sempre o usuário quem faz: nunca peça senha, código de verificação ou 2FA no chat.
- Segredos moram só na configuração local do Claude Code (ou `.env` local) — nunca em repositório, mensagem ou log.

## 1. Verificar pré-requisitos

- Rode `node --version`. Precisa ser versão 20 ou superior.
- Se o comando falhar ou a versão for menor: peça ao usuário para instalar a versão LTS em https://nodejs.org (baixar, avançar, concluir), depois **fechar e reabrir o Claude Code** e colar o prompt de instalação novamente. Pare aqui até isso acontecer.

## 2. Escolher provedores e obter as chaves (etapas de navegador — ofereça automatizar)

- Pergunte quais provedores o usuário quer usar: **Google (Nano Banana — tem nível gratuito)**, **OpenAI (GPT Image — pago)**, ou ambos. Pelo menos um é obrigatório. Se o usuário não sabe, recomende começar pelo Google (dá para testar sem pagar).
- Criar/copiar a chave acontece **no navegador**. Para CADA provedor escolhido, pergunte com botões (ferramenta AskUserQuestion): **"Essa etapa é no navegador. Quer que eu faça pra você?"**, com estas opções:
  1. **"Sim, automatiza" (padrão)** — use o **Playwright MCP** para abrir a página e conduzir o usuário até criar e copiar a chave. Se o Playwright MCP não estiver disponível, instale antes: `claude mcp add playwright -- npx -y @playwright/mcp@latest` (e avise que pode ser preciso reiniciar o Claude Code para ele carregar). Quando a página pedir login, devolva o controle: o usuário loga sozinho e avisa quando terminar.
  2. **"Com Claude in Chrome"** — se o usuário tiver a extensão, conduza pelo Chrome dele (já logado).
  3. **"Faço manualmente"** — passe o passo a passo numerado abaixo e aguarde o usuário colar a chave.
- Roteiro por provedor:
  - **Google (Nano Banana):** abrir https://aistudio.google.com/apikey → entrar com a conta Google → botão **Create API key** → copiar a chave (começa com `AIza`).
  - **OpenAI (GPT Image):** garantir créditos primeiro em https://platform.openai.com → **Settings → Billing** (US$ 5 já rende muitas imagens); depois abrir https://platform.openai.com/api-keys → **Create new secret key** → copiar a chave (começa com `sk-`).
- Receba a(s) chave(s) na conversa e siga imediatamente para a validação — sem repeti-las de volta.

## 3. Avisar o custo (antes de concluir qualquer configuração)

Diga ao usuário, com clareza, e aguarde o OK dele antes de seguir:

- Cada imagem **gerada ou editada** consome créditos da chave DELE: OpenAI ~US$ 0,01–0,25 por imagem (varia com qualidade/tamanho); Google tem **nível gratuito limitado por dia** e depois ~US$ 0,03–0,06 por imagem (valores aproximados — as tabelas oficiais dos provedores mandam).
- As ferramentas locais (`convert_image`, `get_image_info`, `list_image_models`) e o link público (`host_image`) **não custam nada**.

## 4. Validar as chaves SEM custo

Antes de registrar, valide cada chave fornecida com uma chamada gratuita (lista de modelos — não gera imagem, não gasta crédito):

- **OpenAI:** `GET https://api.openai.com/v1/models` com header `Authorization: Bearer <chave>` → HTTP 200 = chave válida.
- **Google:** `GET https://generativelanguage.googleapis.com/v1beta/models` com header `x-goog-api-key: <chave>` → HTTP 200 = chave válida.
- 401/403 = chave errada ou incompleta: volte ao passo 2 para refazer. Não prossiga com chave inválida.
- Use a chave só no header da requisição — não a deixe em arquivo nem a imprima na saída.

## 5. Registrar o MCP no Claude Code

- Verifique se já existe registro anterior: `claude mcp list`. Se `image-mcp` já aparecer, remova antes: `claude mcp remove --scope user image-mcp`.
- Registre incluindo **apenas** as envs das chaves que o usuário forneceu:

```text
claude mcp add --scope user -e GEMINI_API_KEY=<chave-google> -e OPENAI_API_KEY=<chave-openai> image-mcp -- npx -y @expertintegrado/image-mcp
```

- Atenção (Windows/PowerShell): se o comando falhar com "missing required argument 'name'", rode-o pelo cmd (`cmd /c "claude mcp add ..."`) ou defina as chaves com `setx` e registre sem `-e`.

## 6. Testar e finalizar

- Avise o usuário, nesta ordem:
  1. Feche e reabra o Claude Code (o MCP novo só carrega ao reiniciar).
  2. Teste pedindo: *"gere uma imagem de teste de um abacaxi de óculos escuros"* — lembrando que essa imagem já consome crédito (ou o nível gratuito do Google).
  3. As imagens ficam salvas na pasta **Imagens/image-mcp** (Pictures) do usuário.
- Feche com um resumo: quais provedores foram configurados, onde as imagens ficam salvas, e 3 exemplos de pedidos (gerar, editar com referência, converter/hospedar — os dois últimos sem custo).

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `claude` não é reconhecido | Claude Code CLI fora do PATH | Reinstalar o Claude Code |
| Erro 401 ao gerar | Chave errada ou incompleta | Refazer passos 2 e 4 |
| Erro de billing (OpenAI) | Conta sem créditos | Adicionar créditos em platform.openai.com → Billing |
| Erro de quota (Google) | Limite diário do nível gratuito | Esperar o dia seguinte ou ativar billing no Google AI Studio |
| Primeira geração demora | `npx` baixando o pacote na primeira execução | Normal, só na primeira vez |
