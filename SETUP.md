# SETUP.md — roteiro de instalação (para o Claude Code executar)

Você (Claude) está instalando o servidor MCP `image-mcp` para o usuário. Siga os passos na ordem. Fale com o usuário em português simples, sem jargão técnico. Muitos usuários não são programadores.

## 1. Verificar o Node.js

- Rode `node --version`. Precisa ser versão 20 ou superior.
- Se o comando falhar ou a versão for menor: peça ao usuário para instalar a versão LTS em https://nodejs.org (baixar, avançar, concluir), depois **fechar e reabrir o Claude Code** e colar o prompt de instalação novamente. Pare aqui até isso acontecer.

## 2. Instalar dependências

- Na pasta deste arquivo, rode `npm install`.

## 3. Pedir as chaves de API

- Pergunte quais provedores o usuário quer usar: **Google (Nano Banana — tem nível gratuito)**, **OpenAI (GPT Image — pago)**, ou ambos. Pelo menos um é obrigatório.
- Peça para o usuário colar a(s) chave(s) na conversa.
- **Regras de segurança:** nunca repita a chave de volta na conversa, nunca a grave em arquivos deste projeto, nunca a exiba com echo/print. Ela só pode aparecer dentro do comando `claude mcp add` do passo 4.
- Se o usuário ainda não tem chave, aponte a seção "Como criar as chaves" do [README.md](README.md) e aguarde ele voltar com a chave.

## 4. Registrar o MCP no Claude Code

- Descubra o caminho absoluto desta pasta.
- Verifique se já existe registro anterior: `claude mcp list`. Se `image-mcp` já aparecer, remova antes: `claude mcp remove --scope user image-mcp`.
- Registre incluindo **apenas** as envs das chaves que o usuário forneceu:

```
claude mcp add --scope user -e GEMINI_API_KEY=<chave-google> -e OPENAI_API_KEY=<chave-openai> image-mcp -- node "<caminho-absoluto-desta-pasta>\server.js"
```

## 5. Testar e finalizar

- Rode `npm test` — deve terminar com "smoke OK".
- Avise o usuário, nesta ordem:
  1. Feche e reabra o Claude Code (o MCP novo só carrega ao reiniciar).
  2. Teste pedindo: *"gere uma imagem de teste de um abacaxi de óculos escuros"*.
  3. As imagens ficam salvas na pasta `output/` dentro desta pasta.

## Problemas comuns

| Sintoma | Causa provável | Solução |
|---|---|---|
| `claude` não é reconhecido | Claude Code CLI fora do PATH | Reinstalar o Claude Code |
| Erro 401 ao gerar | Chave errada ou incompleta | Refazer passos 3 e 4 |
| Erro de billing (OpenAI) | Conta sem créditos | Adicionar créditos em platform.openai.com → Billing |
| Erro de quota (Google) | Limite diário do nível gratuito | Esperar o dia seguinte ou ativar billing no Google AI Studio |
