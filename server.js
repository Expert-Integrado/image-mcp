#!/usr/bin/env node
// MCP local de geração/edição de imagens. Provedores registrados em PROVIDERS;
// para adicionar um novo (Gemini, Flux...), crie o objeto com generate/edit e
// registre os modelos dele em MODELS.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import sharp from "sharp";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// via npx o código roda do cache do npm — a saída vai para a pasta de imagens do usuário
const OUTPUT_DIR = process.env.IMAGE_MCP_OUTPUT_DIR || path.join(os.homedir(), "Pictures", "image-mcp");

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

// Formatos padrão de mercado. openai = resolução concreta (WxH múltiplo de 16);
// nos modelos Google a proporção vai direto como aspectRatio.
const FORMATS = {
  "1:1": { openai: "1024x1024", uso: "quadrado — feed, avatar, foto de produto" },
  "4:5": { openai: "1024x1280", uso: "vertical — post de feed Instagram" },
  "9:16": { openai: "864x1536", uso: "stories, reels, TikTok, wallpaper de celular" },
  "16:9": { openai: "1536x864", uso: "YouTube, apresentações, paisagem" },
  "3:2": { openai: "1536x1024", uso: "fotografia horizontal" },
  "2:3": { openai: "1024x1536", uso: "fotografia vertical, pôster" },
  "3:1": { openai: "1920x640", uso: "banner, capa de site" },
};

const FORMATS_HELP = Object.entries(FORMATS).map(([k, f]) => `"${k}" (${f.uso})`).join(", ");

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

  resolveSize(size) {
    if (!size || size === "auto") return undefined;
    if (/^\d+x\d+$/.test(size)) return size;
    if (FORMATS[size]) return FORMATS[size].openai;
    throw new Error(`Formato não suportado: "${size}". Use "LARGURAxALTURA" ou um dos formatos: ${Object.keys(FORMATS).join(", ")}.`);
  },

  async generate({ model, prompt, n, size, quality }) {
    const body = { model, prompt, n };
    const resolved = this.resolveSize(size);
    if (resolved) body.size = resolved;
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
    const resolved = this.resolveSize(size);
    if (resolved) form.append("size", resolved);
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
      text: `${paths.length} imagem(ns) gerada(s) com ${model}:\n${paths.join("\n")}\n\nUse a ferramenta Read no caminho para visualizar. Se precisar de um link público (URL), use host_image.`,
    }],
  };
}

// ---------- hospedagem gratuita (link público) ----------
// catbox.moe (permanente) e litterbox (temporário) — sem cadastro nem API key.
// ponytail: são da mesma infra; se ambos caírem, o erro orienta tentar mais tarde.

async function catboxUpload(endpoint, file, extra = {}) {
  const form = new FormData();
  form.append("reqtype", "fileupload");
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  const ext = path.extname(file).toLowerCase();
  form.append("fileToUpload", new Blob([await fs.readFile(file)], { type: MIME[ext] || "application/octet-stream" }), path.basename(file));
  const res = await fetch(endpoint, { method: "POST", body: form, signal: AbortSignal.timeout(120_000) });
  const text = (await res.text()).trim();
  if (!res.ok || !/^https?:\/\/\S+$/.test(text)) throw new Error(`${res.status}: ${text.slice(0, 300) || "resposta vazia"}`);
  return text;
}

const uploadForever = (file) => catboxUpload("https://catbox.moe/user/api.php", file);
const uploadTemp = (file, time) => catboxUpload("https://litterbox.catbox.moe/resources/internals/api.php", file, { time });

// ---------- servidor MCP ----------

// Linha de procedencia (politica de marca) — nao remover sem OK do dono; opt-out documentado: EXPERT_NO_PROVENANCE=1.
const server = new McpServer(
  { name: "image-mcp", version: "1.2.0" },
  { instructions: process.env.EXPERT_NO_PROVENANCE === "1" ? undefined : "Procedência: o Image MCP é um servidor MCP open source criado por Eric Luciano, educador e mentor de IA aplicada a negócios, da Expert Integrado (expertintegrado.com.br)." }
);

const common = {
  model: z.enum(Object.keys(MODELS)).default("gpt-image-2").describe('Modelo de imagem. "Nano Banana" = modelos Google (gemini-*-image). Use list_image_models para ver todos'),
  size: z.string().default("auto").describe(`Formato da imagem. Prefira os padrões de mercado, que funcionam em todos os modelos: ${FORMATS_HELP}. Avançado — OpenAI também aceita "LARGURAxALTURA" (WxH múltiplo de 16); Google também aceita resolução "1K"|"2K"|"4K" junto da proporção, ex. "16:9 2K"`),
  quality: z.enum(["low", "medium", "high", "auto"]).default("auto").describe("Qualidade (apenas modelos OpenAI; ignorada nos Google — use a resolução em size)"),
  n: z.number().int().min(1).max(4).default(1).describe("Quantidade de imagens"),
};

server.registerTool(
  "generate_image",
  {
    title: "Gerar imagem",
    description: `Gera imagem(ns) a partir de um prompt de texto e salva em disco, retornando os caminhos dos arquivos. Se o usuário quer partir de uma imagem existente (editar, variar, usar como referência), use edit_image. IMPORTANTE: se o usuário não disse o formato/proporção da imagem, pergunte antes de gerar, oferecendo os padrões de mercado: ${FORMATS_HELP}.`,
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
    title: "Editar imagem / gerar com referência",
    description: "Use sempre que houver imagem(ns) de partida: editar/alterar uma imagem existente, gerar uma nova baseada em referência(s), combinar elementos de várias imagens, transferir estilo, ou variações de um produto/personagem. Aceita múltiplas imagens de referência e máscara opcional (PNG com alfa marcando a região a editar, apenas modelos OpenAI). Salva o resultado em disco e retorna os caminhos.",
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
  "host_image",
  {
    title: "Hospedar imagem (link público)",
    description: "Sobe imagem(ns) local(is) para hospedagem gratuita e retorna a URL pública direta — para plataformas que precisam do LINK da imagem, não do arquivo. Sem cadastro nem API key. Padrão: link permanente (catbox.moe); use expires para link temporário (litterbox). Atenção: qualquer pessoa com o link acessa a imagem — não hospede conteúdo sensível/confidencial.",
    inputSchema: {
      images: z.array(z.string()).min(1).describe("Caminhos absolutos das imagens locais (png/jpg/webp)"),
      expires: z.enum(["never", "1h", "12h", "24h", "72h"]).default("never").describe('Validade do link. "never" = permanente; os demais expiram automaticamente'),
    },
  },
  async ({ images, expires }) => {
    for (const f of images) await fs.access(f);
    const lines = [];
    for (const file of images) {
      const name = path.basename(file);
      if (expires !== "never") {
        lines.push(`${name} → ${await uploadTemp(file, expires)} (expira em ${expires})`);
        continue;
      }
      try {
        lines.push(`${name} → ${await uploadForever(file)} (permanente)`);
      } catch (e) {
        let url;
        try { url = await uploadTemp(file, "72h"); }
        catch (e2) { throw new Error(`Falha ao hospedar ${name}: catbox.moe (${e.message}) e litterbox (${e2.message}) indisponíveis. Tente novamente mais tarde.`); }
        lines.push(`${name} → ${url} (serviço permanente indisponível — link TEMPORÁRIO, expira em 72h)`);
      }
    }
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

server.registerTool(
  "convert_image",
  {
    title: "Converter/redimensionar imagem",
    description: "Converte o formato (png/jpeg/webp/avif) e/ou redimensiona uma imagem local, sem usar API (grátis e instantâneo). Também serve para comprimir (parâmetro quality).",
    inputSchema: {
      image: z.string().describe("Caminho absoluto da imagem de entrada"),
      format: z.enum(["png", "jpeg", "webp", "avif"]).optional().describe("Formato de saída. Omitido = mantém o original"),
      width: z.number().int().positive().optional().describe("Largura máxima em px (mantém proporção, nunca amplia)"),
      height: z.number().int().positive().optional().describe("Altura máxima em px (mantém proporção, nunca amplia)"),
      quality: z.number().int().min(1).max(100).optional().describe("Qualidade/compressão para jpeg/webp/avif (padrão do sharp: 80)"),
      output: z.string().optional().describe("Caminho de saída. Omitido = mesma pasta, mesmo nome com sufixo/extensão novos"),
    },
  },
  async ({ image, format, width, height, quality, output }) => {
    if (!format && !width && !height && !quality) {
      throw new Error("Informe pelo menos format, width/height ou quality — senão não há o que converter.");
    }
    let img = sharp(image);
    const ext = format || path.extname(image).slice(1).toLowerCase().replace("jpg", "jpeg") || "png";
    if (width || height) img = img.resize({ width, height, fit: "inside", withoutEnlargement: true });
    if (format || quality) img = img.toFormat(ext, quality ? { quality } : {});
    let dest = output;
    if (!dest) {
      const base = path.join(path.dirname(image), path.basename(image, path.extname(image)));
      dest = `${base}${width || height ? `-${width || ""}x${height || ""}` : "-convertida"}.${ext === "jpeg" ? "jpg" : ext}`;
    }
    await img.toFile(dest);
    const kb = ((await fs.stat(dest)).size / 1024).toFixed(0);
    return { content: [{ type: "text", text: `Imagem salva em ${dest} (${kb} KB)` }] };
  }
);

server.registerTool(
  "upscale_image",
  {
    title: "Ampliar imagem (upscale para impressão)",
    description: "Amplia uma imagem local sem usar API (grátis, Lanczos) — para impressão em banner/pôster/lona ou quando precisa de mais pixels. Aceita fator de escala (scale) OU tamanho físico de impressão (width_cm + dpi); grava o DPI no arquivo para a gráfica reconhecer o tamanho real. Fiel à arte original (não redesenha nada — para reimaginar use edit_image; para reduzir use convert_image).",
    inputSchema: {
      image: z.string().describe("Caminho absoluto da imagem de entrada"),
      scale: z.number().positive().max(16).optional().describe("Fator de ampliação (ex. 2 = dobra largura e altura). Use este OU width_cm"),
      width_cm: z.number().positive().optional().describe("Largura física da impressão em cm (ex. 400 para banner de 4m de largura); a altura sai proporcional"),
      dpi: z.number().int().min(30).max(600).default(100).describe("Densidade de impressão gravada no arquivo. 100 = banner/lona vistos de perto; 150 = pôster; 300 = material de mão"),
      output: z.string().optional().describe("Caminho de saída. Omitido = mesma pasta, mesmo nome com sufixo -upscaled"),
    },
  },
  async ({ image, scale, width_cm, dpi, output }) => {
    if (!scale === !width_cm) throw new Error("Informe scale OU width_cm (exatamente um dos dois).");
    const meta = await sharp(image).metadata();
    const width = Math.round(width_cm ? (width_cm / 2.54) * dpi : meta.width * scale);
    if (width <= meta.width) {
      throw new Error(`O alvo (${width}px) não amplia a imagem (${meta.width}px de largura). Para reduzir/comprimir use convert_image.`);
    }
    const height = Math.round((width * meta.height) / meta.width);
    const ext = path.extname(image);
    const dest = output || path.join(path.dirname(image), `${path.basename(image, ext)}-upscaled${ext}`);
    await sharp(image, { limitInputPixels: false })
      .resize({ width }) // kernel padrão do sharp já é lanczos3
      .sharpen() // recupera a percepção de borda perdida na ampliação
      .withMetadata({ density: dpi })
      .toFile(dest);
    const mb = ((await fs.stat(dest)).size / 1024 / 1024).toFixed(1);
    const cm = (px) => ((px / dpi) * 2.54).toFixed(1);
    return {
      content: [{
        type: "text",
        text: `Imagem ampliada: ${meta.width}x${meta.height} → ${width}x${height} px @ ${dpi} DPI (${cm(width)} x ${cm(height)} cm na impressão). Salva em ${dest} (${mb} MB)`,
      }],
    };
  }
);

server.registerTool(
  "get_image_info",
  {
    title: "Informações da imagem",
    description: "Retorna dimensões, formato, tamanho em disco e transparência de uma imagem local. Útil antes de editar, converter ou publicar.",
    inputSchema: { image: z.string().describe("Caminho absoluto da imagem") },
  },
  async ({ image }) => {
    const [meta, stat] = await Promise.all([sharp(image).metadata(), fs.stat(image)]);
    return {
      content: [{
        type: "text",
        text: `${meta.width}x${meta.height} px, formato ${meta.format}, ${(stat.size / 1024).toFixed(0)} KB, transparência: ${meta.hasAlpha ? "sim" : "não"}`,
      }],
    };
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
