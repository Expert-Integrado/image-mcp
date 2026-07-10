// Verificação one-off: conecta no pacote PUBLICADO via npx, como o aluno usará.
import assert from "node:assert";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "npx-check", version: "1.0.0" });
await client.connect(new StdioClientTransport({
  command: "cmd",
  args: ["/c", "npx", "-y", "@expertintegrado/image-mcp"],
  cwd: (await import("node:os")).default.tmpdir(), // fora da pasta do pacote, senão o npx resolve para o projeto local
  env: { ...process.env, OPENAI_API_KEY: "", GEMINI_API_KEY: "" },
}));

const { tools } = await client.listTools();
assert.strictEqual(tools.length, 7);
assert.ok(tools.some((t) => t.name === "upscale_image"), "upscale_image ausente no pacote publicado");
const models = await client.callTool({ name: "list_image_models", arguments: {} });
assert.match(models.content[0].text, /gpt-image-2/);
await client.close();
console.log("npx OK: pacote publicado sobe e responde com 7 tools (incl. upscale_image)");
