#!/usr/bin/env node
// MCP local de geração/edição de imagens. Provedores registrados em PROVIDERS;
// para adicionar um novo (Gemini, Flux...), crie o objeto com generate/edit e
// registre os modelos dele em MODELS.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.IMAGE_MCP_OUTPUT_DIR || path.join(SERVER_DIR, "output");

// ---------- registro de modelos/provedores ----------

const MODELS = {
  "gpt-image-2": { provider: "openai", edit: true, label: "GPT Image 2 (OpenAI)", default: true },
  "gpt-image-1": { provider: "openai", edit: true, label: "GPT Image 1 (OpenAI)" },
  "gpt-image-1-mini": { provider: "openai", edit: true, label: "GPT Image 1 mini (OpenAI)" },
  "gemini-3.1-flash-image": { provider: "google", edit: true, label: "Nano Banana 2 (Google)" },
  "gemini-3-pro-image": { provider: "google", edit: true, label: "Nano Banana Pro (Google)" },
  "gemini-2.5-flash-image": { provider: "google", edit: true, label: "Nano Banana 1 (Google, legado)" },
};

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

const openai = {
  apiKey: () => {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY não configurada no ambiente do servidor MCP.");
    return key;
  },

  async request(url, init) {
    const res = await fetch(url, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${body?.error?.message || JSON.stringify(body)}`);
    return body;
  },

  async generate({ model, prompt, n, size, quality }) {
    const body = { model, prompt, n };
    if (size !== "auto") body.size = size;
    if (quality !== "auto") body.quality = quality;
    const data = await this.request("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return data.data.map((d) => d.b64_json);
  },

  async edit({ model, prompt, images, mask, n, size, quality }) {
    const form = new FormData();
    form.append("model", model);
    form.append("prompt", prompt);
    form.append("n", String(n));
    if (size !== "auto") form.append("size", size);
    if (quality !== "auto") form.append("quality", quality);
    for (const file of images) {
      const ext = path.extname(file).toLowerCase();
      const blob = new Blob([await fs.readFile(file)], { type: MIME[ext] || "image/png" });
      form.append("image[]", blob, path.basename(file));
    }
    if (mask) {
      form.append("mask", new Blob([await fs.readFile(mask)], { type: "image/png" }), path.basename(mask));
    }
    const data = await this.request("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey()}` },
      body: form,
    });
    return data.data.map((d) => d.b64_json);
  },
};

const google = {
  apiKey: () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY não configurada no ambiente do servidor MCP.");
    return key;
  },

  // size nos modelos Google: proporção ("16:9") e/ou resolução ("1K"|"2K"|"4K"), ex.: "16:9 2K"
  imageConfig(size) {
    if (!size || size === "auto") return undefined;
    const cfg = {};
    for (const tok of size.split(/[\s@,]+/)) {
      if (tok.includes(":")) cfg.aspectRatio = tok;
      else if (/^(0\.5|1|2|4)k$/i.test(tok)) cfg.imageSize = tok.toUpperCase();
      else throw new Error(`size inválido para modelos Google: "${size}". Use proporção ("16:9") e/ou resolução ("1K", "2K", "4K"), ex.: "16:9 2K".`);
    }
    return cfg;
  },

  async call(model, parts, size) {
    const generationConfig = { responseModalities: ["TEXT", "IMAGE"] };
    const imageConfig = this.imageConfig(size);
    if (imageConfig) generationConfig.imageConfig = imageConfig;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": this.apiKey(), "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Google ${res.status}: ${body?.error?.message || JSON.stringify(body)}`);
    const outParts = body?.candidates?.[0]?.content?.parts || [];
    const images = outParts.filter((p) => p.inlineData?.data).map((p) => p.inlineData.data);
    if (!images.length) {
      const text = outParts.find((p) => p.text)?.text || body?.promptFeedback?.blockReason || "resposta sem imagem";
      throw new Error(`Google não retornou imagem: ${text}`);
    }
    return images;
  },

  async generate({ model, prompt, n, size }) {
    const out = []; // ponytail: n>1 = n chamadas; a API retorna 1 imagem por requisição
    while (out.length < n) out.push(...(await this.call(model, [{ text: prompt }], size)));
    return out.slice(0, n);
  },

  async edit({ model, prompt, images, mask, n, size }) {
    if (mask) throw new Error("Máscara só é suportada nos modelos OpenAI; nos modelos Google, descreva a região a editar no próprio prompt.");
    const parts = [{ text: prompt }];
    for (const file of images) {
      const ext = path.extname(file).toLowerCase();
      parts.push({ inlineData: { mimeType: MIME[ext] || "image/png", data: (await fs.readFile(file)).toString("base64") } });
    }
    const out = [];
    while (out.length < n) out.push(...(await this.call(model, parts, size)));
    return out.slice(0, n);
  },
};

const PROVIDERS = { openai, google };

function resolve(model) {
  const entry = MODELS[model];
  if (!entry) {
    throw new Error(`Modelo desconhecido: ${model}. Disponíveis: ${Object.keys(MODELS).join(", ")}`);
  }
  return { entry, provider: PROVIDERS[entry.provider] };
}

async function saveImages(b64Images, label) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "image";
  const paths = [];
  for (let i = 0; i < b64Images.length; i++) {
    const file = path.join(OUTPUT_DIR, `${stamp}-${slug}${b64Images.length > 1 ? `-${i + 1}` : ""}.png`);
    await fs.writeFile(file, Buffer.from(b64Images[i], "base64"));
    paths.push(file);
  }
  return paths;
}

function ok(paths, model) {
  return {
    content: [{
      type: "text",
      text: `${paths.length} imagem(ns) gerada(s) com ${model}:\n${paths.join("\n")}\n\nUse a ferramenta Read no caminho para visualizar.`,
    }],
  };
}

// ---------- servidor MCP ----------

const server = new McpServer({ name: "image-mcp", version: "1.0.0" });

const common = {
  model: z.enum(Object.keys(MODELS)).default("gpt-image-2").describe('Modelo de imagem. "Nano Banana" = modelos Google (gemini-*-image). Use list_image_models para ver todos'),
  size: z.string().default("auto").describe('Modelos OpenAI: "LARGURAxALTURA", ex. "1024x1024", "1536x1024" (gpt-image-2 aceita qualquer WxH múltiplo de 16, aspecto 1:3 a 3:1). Modelos Google: proporção e/ou resolução, ex. "16:9", "2K", "16:9 2K". "auto" = padrão do modelo'),
  quality: z.enum(["low", "medium", "high", "auto"]).default("auto").describe("Qualidade (apenas modelos OpenAI; ignorada nos Google — use a resolução em size)"),
  n: z.number().int().min(1).max(4).default(1).describe("Quantidade de imagens"),
};

server.registerTool(
  "generate_image",
  {
    title: "Gerar imagem",
    description: "Gera imagem(ns) a partir de um prompt de texto e salva em disco, retornando os caminhos dos arquivos.",
    inputSchema: {
      prompt: z.string().min(1).describe("Descrição da imagem desejada"),
      ...common,
    },
  },
  async ({ prompt, model, size, quality, n }) => {
    const { provider } = resolve(model);
    const b64 = await provider.generate({ model, prompt, n, size, quality });
    return ok(await saveImages(b64, prompt), model);
  }
);

server.registerTool(
  "edit_image",
  {
    title: "Editar imagem",
    description: "Edita imagem(ns) existente(s) a partir de um prompt. Aceita múltiplas imagens de referência e máscara opcional (PNG com alfa marcando a região a editar). Salva o resultado em disco e retorna os caminhos.",
    inputSchema: {
      prompt: z.string().min(1).describe("Descrição da edição desejada"),
      images: z.array(z.string()).min(1).describe("Caminhos absolutos das imagens de entrada (png/jpg/webp)"),
      mask: z.string().optional().describe("Caminho de PNG com canal alfa indicando a área a editar"),
      ...common,
    },
  },
  async ({ prompt, images, mask, model, size, quality, n }) => {
    const { entry, provider } = resolve(model);
    if (!entry.edit) throw new Error(`O modelo ${model} não suporta edição.`);
    for (const f of [...images, ...(mask ? [mask] : [])]) await fs.access(f);
    const b64 = await provider.edit({ model, prompt, images, mask, n, size, quality });
    return ok(await saveImages(b64, prompt), model);
  }
);

server.registerTool(
  "list_image_models",
  {
    title: "Listar modelos de imagem",
    description: "Lista os modelos de geração de imagem disponíveis neste servidor e suas capacidades.",
    inputSchema: {},
  },
  async () => ({
    content: [{
      type: "text",
      text: Object.entries(MODELS)
        .map(([id, m]) => `${id} — ${m.label} (edição: ${m.edit ? "sim" : "não"}${m.default ? ", padrão" : ""})`)
        .join("\n"),
    }],
  })
);

await server.connect(new StdioServerTransport());
