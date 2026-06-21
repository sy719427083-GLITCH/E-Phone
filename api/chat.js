const ALLOWED_ORIGINS = new Set([
  "https://sy719427083-glitch.github.io",
  "https://e-phone-tf8s.vercel.app",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-EPhone-Request-Id");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function buildApiUrl(apiUrl, path) {
  const base = String(apiUrl || "").trim().replace(/\/+$/, "");
  if (!base) throw new Error("API 地址不能为空。");
  if (!/^https:\/\//i.test(base)) throw new Error("API 地址必须使用 HTTPS。");
  if (base.endsWith(`/${path}`)) return base;
  return `${base}/${path}`;
}

function buildBody(api, prompt, options = {}) {
  const body = {
    model: String(api.model || "").trim(),
    messages: [{ role: "user", content: String(prompt || "") }],
    temperature: Number.isFinite(Number(api.temperature)) ? Number(api.temperature) : 0.7,
  };
  if (Number.isFinite(Number(options.maxTokens)) && Number(options.maxTokens) > 0) {
    body.max_tokens = Math.round(Number(options.maxTokens));
  }
  if (String(api.apiUrl || "").toLowerCase().includes("deepseek")) {
    body.thinking = { type: "disabled" };
  }
  return body;
}

function extractCompletionText(payload) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  const choice = payload?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : part?.text || ""))
      .join("");
  }
  if (typeof choice?.text === "string") return choice.text;
  return "";
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const payload = await readBody(req);
    const api = payload?.api || {};
    const prompt = payload?.prompt || "";
    const options = payload?.options || {};
    const apiKey = String(api.apiKey || "").trim();
    const model = String(api.model || "").trim();

    if (!apiKey) throw new Error("API Key 不能为空。");
    if (!model) throw new Error("模型不能为空。");
    if (!String(prompt).trim()) throw new Error("提示词不能为空。");

    const upstream = await fetch(buildApiUrl(api.apiUrl, "chat/completions"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(buildBody(api, prompt, options)),
    });
    const upstreamPayload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const detail = upstreamPayload?.error?.message || upstreamPayload?.message || `HTTP ${upstream.status}`;
      res.status(upstream.status).json({ error: detail });
      return;
    }

    const content = extractCompletionText(upstreamPayload).trim();
    if (!content) {
      res.status(502).json({ error: "API 没有返回内容。" });
      return;
    }

    res.status(200).json({ content });
  } catch (error) {
    res.status(400).json({ error: error?.message || "请求失败。" });
  }
}
