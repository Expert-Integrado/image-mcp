// Smoke test: sobe o servidor via stdio e valida tools sem gastar API.
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(new StdioClientTransport({
  command: process.execPath,
  args: [path.join(dir, "server.js")],
  env: { ...process.env, OPENAI_API_KEY: "", GEMINI_API_KEY: "" },
}));

const { tools } = await client.listTools();
const names = tools.map((t) => t.name).sort();
assert.deepStrictEqual(names, ["convert_image", "edit_image", "generate_image", "get_image_info", "list_image_models"]);

const models = await client.callTool({ name: "list_image_models", arguments: {} });
assert.match(models.content[0].text, /gpt-image-2 .*padrão/);
assert.match(models.content[0].text, /gemini-3\.1-flash-image — Nano Banana 2/);

// sem chave: erro limpo por provedor, não crash
const gen = await client.callTool({ name: "generate_image", arguments: { prompt: "teste" } });
assert.strictEqual(gen.isError, true);
assert.match(gen.content[0].text, /OPENAI_API_KEY/);

// formato padrão aceito (passa da validação, para só na falta de chave)
const genPreset = await client.callTool({
  name: "generate_image",
  arguments: { prompt: "teste", size: "9:16" },
});
assert.match(genPreset.content[0].text, /OPENAI_API_KEY/);

// formato desconhecido: erro claro listando os padrões
const genBadSize = await client.callTool({
  name: "generate_image",
  arguments: { prompt: "teste", size: "7:3" },
});
assert.strictEqual(genBadSize.isError, true);
assert.match(genBadSize.content[0].text, /Formato não suportado.*9:16/);

const genGoogle = await client.callTool({
  name: "generate_image",
  arguments: { prompt: "teste", model: "gemini-3.1-flash-image" },
});
assert.strictEqual(genGoogle.isError, true);
assert.match(genGoogle.content[0].text, /GEMINI_API_KEY/);

// conversão local real: PNG 8x8 → webp redimensionado, sem API
const tmpPng = path.join(os.tmpdir(), "image-mcp-smoke.png");
await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toFile(tmpPng);
const conv = await client.callTool({
  name: "convert_image",
  arguments: { image: tmpPng, format: "webp", width: 4 },
});
assert.notStrictEqual(conv.isError, true, conv.content[0].text);
const outFile = conv.content[0].text.match(/salva em (.*\.webp)/)?.[1];
assert.ok(outFile && fs.existsSync(outFile), "arquivo convertido não existe");

const info = await client.callTool({ name: "get_image_info", arguments: { image: outFile } });
assert.match(info.content[0].text, /4x4 px, formato webp/);

await client.close();
for (const f of [tmpPng, outFile]) { try { fs.rmSync(f); } catch {} } // handle pode demorar a soltar no Windows
console.log("smoke OK: 5 tools, modelos OpenAI+Google, formatos padrão, conversão local webp validada");
