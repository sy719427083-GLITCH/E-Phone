export const STORAGE_KEY = "ephone.api.configs";

export const DEFAULT_CONFIG = {
  id: "draft",
  name: "未命名配置",
  primary: {
    name: "",
    apiUrl: "",
    apiKey: "",
    model: "",
    temperature: 0.7,
  },
  secondary: {
    apiUrl: "",
    apiKey: "",
    model: "",
    temperature: 0.45,
    purpose: "总结记忆",
  },
  retryCount: 2,
  fallbackToSecondary: true,
  secondaryConfigId: "",
  secondaryEnabled: true,
};

export function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function mergeConfig(config = {}) {
  return {
    ...DEFAULT_CONFIG,
    ...config,
    primary: { ...DEFAULT_CONFIG.primary, ...(config.primary || {}) },
    secondary: { ...DEFAULT_CONFIG.secondary, ...(config.secondary || {}) },
  };
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `api-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function apiSignature(api = {}) {
  return [api.apiUrl, api.apiKey, api.model].map((value) => String(value || "").trim()).join("\n");
}

function hasRunnableApi(api = {}) {
  return Boolean(api.apiUrl?.trim() && api.apiKey?.trim() && api.model?.trim());
}

function isQuotaOrRateLimitError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("quota")
    || message.includes("rate limit")
    || message.includes("rate_limit")
    || message.includes("too many requests")
    || message.includes("insufficient");
}

export function resolveApiSelection(config, primaryConfig, secondaryConfig = null) {
  const normalized = mergeConfig(config);
  const selectedPrimary = mergeConfig(primaryConfig || normalized);
  const secondaryEnabled = normalized.secondaryEnabled !== false;
  const selectedSecondary = secondaryEnabled && secondaryConfig && secondaryConfig.id !== selectedPrimary.id
    ? mergeConfig(secondaryConfig)
    : null;
  const primary = { ...DEFAULT_CONFIG.primary, ...selectedPrimary.primary };
  const secondarySource = selectedSecondary?.primary || primary;

  return mergeConfig({
    ...selectedPrimary,
    primary,
    secondary: {
      ...DEFAULT_CONFIG.secondary,
      ...secondarySource,
      purpose: normalized.secondary.purpose,
    },
    secondaryConfigId: selectedSecondary?.id || "",
    secondaryEnabled,
    fallbackToSecondary: Boolean(secondaryEnabled && selectedSecondary && normalized.fallbackToSecondary),
  });
}

export class ApiConfigStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.configs = [];
    this.selectedId = null;
    this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(this.storage?.getItem(STORAGE_KEY) || "{}");
      this.configs = Array.isArray(parsed.configs) ? parsed.configs.map(mergeConfig) : [];
      this.selectedId = parsed.selectedId || this.configs.at(-1)?.id || null;
    } catch {
      this.configs = [];
      this.selectedId = null;
    }
  }

  persist() {
    this.storage?.setItem(
      STORAGE_KEY,
      JSON.stringify({ configs: this.configs, selectedId: this.selectedId }),
    );
  }

  list() {
    return [...this.configs];
  }

  get(id) {
    return this.configs.find((config) => config.id === id) || null;
  }

  getSelected() {
    return this.get(this.selectedId) || mergeConfig();
  }

  select(id) {
    if (this.get(id)) {
      this.selectedId = id;
      this.persist();
    }
    return this.getSelected();
  }

  save(config) {
    const next = mergeConfig({
      ...config,
      id: config.id && config.id !== "draft" ? config.id : makeId(),
      name: config.name?.trim() || DEFAULT_CONFIG.name,
    });
    const index = this.configs.findIndex((item) => item.id === next.id);
    if (index >= 0) {
      this.configs[index] = next;
    } else {
      this.configs.push(next);
    }
    this.selectedId = next.id;
    this.persist();
    return next;
  }

  remove(id) {
    this.configs = this.configs.filter((config) => config.id !== id);
    if (this.selectedId === id) {
      this.selectedId = this.configs.at(-1)?.id || null;
    }
    this.persist();
  }
}

export async function callWithRetryAndFallback(config, requestFn) {
  const normalized = mergeConfig(config);
  const primaryAttempts = Math.max(1, Number(normalized.retryCount) || 1);
  const canFallbackToSecondary = Boolean(
    normalized.secondaryEnabled !== false
      && normalized.fallbackToSecondary
      && hasRunnableApi(normalized.secondary)
      && apiSignature(normalized.primary) !== apiSignature(normalized.secondary),
  );

  for (let attempt = 1; attempt <= primaryAttempts; attempt += 1) {
    try {
      return await requestFn({
        role: "primary",
        attempt,
        model: normalized.primary.model,
        api: normalized.primary,
      });
    } catch (error) {
      if (isQuotaOrRateLimitError(error)) {
        if (!canFallbackToSecondary) throw error;
        break;
      }
      if (attempt === primaryAttempts && !canFallbackToSecondary) {
        throw error;
      }
    }
  }

  if (!canFallbackToSecondary) {
    throw new Error("Primary API failed");
  }

  return requestFn({
    role: "secondary",
    attempt: 1,
    model: normalized.secondary.model,
    api: normalized.secondary,
  });
}

export function buildApiUrl(api, endpoint) {
  const base = api?.apiUrl?.trim();
  if (!base) {
    throw new Error("请先填写 API 地址。");
  }

  const cleanEndpoint = endpoint.replace(/^\/+/, "");
  if (base.endsWith(`/${cleanEndpoint}`)) return base;
  return `${base.replace(/\/+$/, "")}/${cleanEndpoint}`;
}

export function validateApi(api) {
  if (!api?.apiUrl?.trim()) throw new Error("请填写 API 地址。");
  if (!api?.apiKey?.trim()) throw new Error("请填写 API Key。");
  if (!api?.model?.trim()) throw new Error("请选择或填写模型。");
}

function extractContentText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "string") return part;
      return part?.text || part?.content || "";
    }).join("");
  }
  return "";
}

function extractCompletionText(payload = {}) {
  const choice = payload?.choices?.[0] || {};
  return extractContentText(choice.message?.content)
    || extractContentText(choice.delta?.content)
    || extractContentText(choice.text)
    || extractContentText(payload.output_text)
    || extractContentText(payload.content);
}

export async function requestChatCompletion(api, prompt, fetcher = fetch, options = {}) {
  validateApi(api);
  const response = await fetcher(buildApiUrl(api, "chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${api.apiKey.trim()}`,
    },
    body: JSON.stringify({
      model: api.model.trim(),
      messages: [{ role: "user", content: prompt }],
      temperature: Number(api.temperature) || 0.7,
      max_tokens: options.maxTokens || 24,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    const status = response.status ? `HTTP ${response.status}` : "HTTP error";
    const model = api.model?.trim() ? `模型：${api.model.trim()}` : "模型未知";
    throw new Error(`API返回：${detail}（${model}，${status}）`);
  }

  return extractCompletionText(payload) || "连接正常";
}

export async function fetchModelList(api, fetcher = fetch) {
  if (!api?.apiUrl?.trim()) throw new Error("请先填写 API 地址。");
  if (!api?.apiKey?.trim()) throw new Error("请先填写 API Key。");

  const response = await fetcher(buildApiUrl(api, "models"), {
    headers: {
      Authorization: `Bearer ${api.apiKey.trim()}`,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || payload?.message || `HTTP ${response.status}`;
    throw new Error(detail);
  }

  return Array.isArray(payload?.data)
    ? payload.data.map((item) => item.id).filter(Boolean)
    : [];
}
