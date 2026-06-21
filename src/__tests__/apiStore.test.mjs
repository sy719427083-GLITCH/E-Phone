import assert from "node:assert/strict";
import test from "node:test";
import {
  ApiConfigStore,
  DEFAULT_CONFIG,
  buildApiUrl,
  callWithRetryAndFallback,
  createMemoryStorage,
  describeApiUsage,
  fetchModelList,
  isQuotaOrRateLimitError,
  requestChatCompletion,
  resolveApiSelection,
} from "../lib/apiStore.js";

test("saves multiple API configs and restores the selected config", () => {
  const storage = createMemoryStorage();
  const store = new ApiConfigStore(storage);

  const savedOne = store.save({
    name: "主线",
    primary: { apiUrl: "https://main.example/v1", apiKey: "main-key", model: "gpt-main" },
    secondary: { apiUrl: "https://sub.example/v1", apiKey: "sub-key", model: "gpt-sub" },
    retryCount: 4,
    fallbackToSecondary: true,
  });
  const savedTwo = store.save({ name: "备用", primary: { model: "gpt-backup" } });

  const restored = new ApiConfigStore(storage);

  assert.equal(restored.list().length, 2);
  assert.equal(restored.selectedId, savedTwo.id);
  assert.equal(restored.getSelected().name, "备用");
  assert.equal(restored.get(savedOne.id).primary.apiUrl, "https://main.example/v1");
  assert.equal(restored.get(savedOne.id).secondary.model, "gpt-sub");
  assert.equal(restored.get(savedOne.id).retryCount, 4);
});

test("deletes a config and falls back to a default editable config", () => {
  const store = new ApiConfigStore(createMemoryStorage());
  const saved = store.save({ name: "临时配置" });

  store.remove(saved.id);

  assert.equal(store.list().length, 0);
  assert.equal(store.getSelected().name, DEFAULT_CONFIG.name);
});

test("describes selected API without leaking the key", () => {
  const description = describeApiUsage({
    name: "主线",
    primary: {
      apiUrl: "https://api.example.com/v1",
      apiKey: "secret-key",
      model: "gpt-main",
    },
  });

  assert.match(description, /主线/);
  assert.match(description, /gpt-main/);
  assert.match(description, /api.example.com/);
  assert.doesNotMatch(description, /secret-key/);
});

test("retries the primary API and switches to secondary when enabled", async () => {
  const attempts = [];
  const config = {
    ...DEFAULT_CONFIG,
    retryCount: 2,
    fallbackToSecondary: true,
    primary: { ...DEFAULT_CONFIG.primary, apiUrl: "primary", apiKey: "main-key", model: "main" },
    secondary: { ...DEFAULT_CONFIG.secondary, apiUrl: "secondary", apiKey: "secondary-key", model: "summary" },
  };

  const result = await callWithRetryAndFallback(config, async ({ role, attempt, model }) => {
    attempts.push(`${role}:${attempt}:${model}`);
    if (role === "primary") throw new Error("primary failed");
    return { ok: true, role, model };
  });

  assert.deepEqual(attempts, ["primary:1:main", "primary:2:main", "secondary:1:summary"]);
  assert.deepEqual(result, { ok: true, role: "secondary", model: "summary" });
});

test("does not fallback when secondary resolves to the same API", async () => {
  const attempts = [];
  const config = {
    ...DEFAULT_CONFIG,
    retryCount: 2,
    fallbackToSecondary: true,
    primary: { ...DEFAULT_CONFIG.primary, apiUrl: "same", apiKey: "key", model: "main" },
    secondary: { ...DEFAULT_CONFIG.secondary, apiUrl: "same", apiKey: "key", model: "main" },
  };

  await assert.rejects(
    () => callWithRetryAndFallback(config, async ({ role, attempt }) => {
      attempts.push(`${role}:${attempt}`);
      throw new Error("primary failed");
    }),
    /primary failed/,
  );

  assert.deepEqual(attempts, ["primary:1", "primary:2"]);
});

test("does not fallback when secondary API is disabled", async () => {
  const attempts = [];
  const config = {
    ...DEFAULT_CONFIG,
    retryCount: 2,
    secondaryEnabled: false,
    fallbackToSecondary: true,
    primary: { ...DEFAULT_CONFIG.primary, apiUrl: "primary", model: "main" },
    secondary: { ...DEFAULT_CONFIG.secondary, apiUrl: "secondary", model: "backup" },
  };

  await assert.rejects(
    () => callWithRetryAndFallback(config, async ({ role, attempt }) => {
      attempts.push(`${role}:${attempt}`);
      throw new Error("primary failed");
    }),
    /primary failed/,
  );

  assert.deepEqual(attempts, ["primary:1", "primary:2"]);
});

test("does not fallback to an incomplete secondary API", async () => {
  const attempts = [];
  const config = {
    ...DEFAULT_CONFIG,
    retryCount: 1,
    fallbackToSecondary: true,
    primary: { ...DEFAULT_CONFIG.primary, apiUrl: "primary", apiKey: "main-key", model: "main" },
    secondary: { ...DEFAULT_CONFIG.secondary },
  };

  await assert.rejects(
    () => callWithRetryAndFallback(config, async ({ role }) => {
      attempts.push(role);
      throw new Error(`${role} failed`);
    }),
    /primary failed/,
  );

  assert.deepEqual(attempts, ["primary"]);
});

test("does not retry quota errors on the same API", async () => {
  const attempts = [];
  const config = {
    ...DEFAULT_CONFIG,
    retryCount: 3,
    fallbackToSecondary: false,
    primary: { ...DEFAULT_CONFIG.primary, apiUrl: "primary", apiKey: "main-key", model: "main" },
  };

  await assert.rejects(
    () => callWithRetryAndFallback(config, async ({ role, attempt }) => {
      attempts.push(`${role}:${attempt}`);
      throw new Error("The quota has been exceeded.");
    }),
    /quota.*主API.*main/,
  );

  assert.deepEqual(attempts, ["primary:1"]);
});

test("detects provider quota and rate limit errors", () => {
  assert.equal(isQuotaOrRateLimitError(new Error("The quota has been exceeded.")), true);
  assert.equal(isQuotaOrRateLimitError(new Error("rate_limit_exceeded")), true);
  assert.equal(isQuotaOrRateLimitError(new Error("model unavailable")), false);
});

test("falls back immediately when primary returns a quota error", async () => {
  const attempts = [];
  const config = {
    ...DEFAULT_CONFIG,
    retryCount: 3,
    fallbackToSecondary: true,
    primary: { ...DEFAULT_CONFIG.primary, apiUrl: "primary", apiKey: "main-key", model: "main" },
    secondary: { ...DEFAULT_CONFIG.secondary, apiUrl: "secondary", apiKey: "secondary-key", model: "backup" },
  };

  const result = await callWithRetryAndFallback(config, async ({ role, attempt }) => {
    attempts.push(`${role}:${attempt}`);
    if (role === "primary") throw new Error("The quota has been exceeded.");
    return "secondary ok";
  });

  assert.equal(result, "secondary ok");
  assert.deepEqual(attempts, ["primary:1", "secondary:1"]);
});

test("resolves empty or same secondary selection as one global API", () => {
  const primaryConfig = {
    ...DEFAULT_CONFIG,
    id: "main-id",
    name: "主线",
    primary: {
      ...DEFAULT_CONFIG.primary,
      apiUrl: "https://main.example/v1",
      apiKey: "main-key",
      model: "gpt-main",
      temperature: 0.8,
    },
  };

  const resolvedEmpty = resolveApiSelection(
    { ...primaryConfig, fallbackToSecondary: true },
    primaryConfig,
    null,
  );
  const resolvedSame = resolveApiSelection(
    { ...primaryConfig, fallbackToSecondary: true },
    primaryConfig,
    primaryConfig,
  );

  assert.equal(resolvedEmpty.secondaryConfigId, "");
  assert.equal(resolvedEmpty.fallbackToSecondary, false);
  assert.equal(resolvedEmpty.secondary.apiUrl, primaryConfig.primary.apiUrl);
  assert.equal(resolvedEmpty.secondary.model, primaryConfig.primary.model);
  assert.equal(resolvedSame.secondaryConfigId, "");
  assert.equal(resolvedSame.fallbackToSecondary, false);
});

test("resolves disabled secondary selection as one global API", () => {
  const primaryConfig = {
    ...DEFAULT_CONFIG,
    id: "main-id",
    name: "主线",
    primary: { ...DEFAULT_CONFIG.primary, apiUrl: "main", apiKey: "main-key", model: "gpt-main" },
  };
  const secondaryConfig = {
    ...DEFAULT_CONFIG,
    id: "backup-id",
    name: "备用",
    primary: { ...DEFAULT_CONFIG.primary, apiUrl: "backup", apiKey: "backup-key", model: "gpt-backup" },
  };

  const resolved = resolveApiSelection(
    { ...primaryConfig, secondaryEnabled: false, fallbackToSecondary: true },
    primaryConfig,
    secondaryConfig,
  );

  assert.equal(resolved.secondaryEnabled, false);
  assert.equal(resolved.secondaryConfigId, "");
  assert.equal(resolved.fallbackToSecondary, false);
  assert.equal(resolved.secondary.apiUrl, "main");
});

test("resolves a different secondary selection as fallback API", () => {
  const primaryConfig = {
    ...DEFAULT_CONFIG,
    id: "main-id",
    name: "主线",
    primary: { ...DEFAULT_CONFIG.primary, apiUrl: "main", apiKey: "main-key", model: "gpt-main" },
  };
  const secondaryConfig = {
    ...DEFAULT_CONFIG,
    id: "backup-id",
    name: "备用",
    primary: { ...DEFAULT_CONFIG.primary, apiUrl: "backup", apiKey: "backup-key", model: "gpt-backup" },
  };

  const resolved = resolveApiSelection(
    { ...primaryConfig, fallbackToSecondary: true },
    primaryConfig,
    secondaryConfig,
  );

  assert.equal(resolved.secondaryConfigId, "backup-id");
  assert.equal(resolved.fallbackToSecondary, true);
  assert.equal(resolved.secondary.apiUrl, "backup");
  assert.equal(resolved.secondary.model, "gpt-backup");
});

test("builds compatible API endpoints from base or full URLs", () => {
  assert.equal(buildApiUrl({ apiUrl: "https://api.example/v1" }, "chat/completions"), "https://api.example/v1/chat/completions");
  assert.equal(buildApiUrl({ apiUrl: "https://api.example/v1/chat/completions" }, "chat/completions"), "https://api.example/v1/chat/completions");
});

test("requests a real chat completion payload", async () => {
  let request;
  const content = await requestChatCompletion(
    {
      apiUrl: "https://api.example/v1",
      apiKey: "secret",
      model: "gpt-real",
      temperature: 0.3,
    },
    "ping",
    async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "pong" } }] }),
      };
    },
  );

  assert.equal(content, "pong");
  assert.equal(request.url, "https://api.example/v1/chat/completions");
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.headers.Authorization, "Bearer secret");
  assert.equal(JSON.parse(request.options.body).model, "gpt-real");
});

test("disables thinking mode for DeepSeek chat completions", async () => {
  let body;
  const content = await requestChatCompletion(
    {
      apiUrl: "https://api.deepseek.com",
      apiKey: "secret",
      model: "deepseek-v4-pro",
      temperature: 0.3,
    },
    "ping",
    async (url, options) => {
      assert.equal(url, "https://api.deepseek.com/chat/completions");
      body = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "pong" } }] }),
      };
    },
  );

  assert.equal(content, "pong");
  assert.deepEqual(body.thinking, { type: "disabled" });
});

test("does not add DeepSeek-only thinking options to generic APIs", async () => {
  let body;
  await requestChatCompletion(
    {
      apiUrl: "https://api.example/v1",
      apiKey: "secret",
      model: "gpt-real",
    },
    "ping",
    async (url, options) => {
      body = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "pong" } }] }),
      };
    },
  );

  assert.equal(Object.hasOwn(body, "thinking"), false);
});

test("reads compatible completion text formats", async () => {
  const api = {
    apiUrl: "https://api.example/v1",
    apiKey: "secret",
    model: "gpt-real",
  };

  const fromText = await requestChatCompletion(api, "ping", async () => ({
    ok: true,
    json: async () => ({ choices: [{ text: "plain text reply" }] }),
  }));
  const fromOutputText = await requestChatCompletion(api, "ping", async () => ({
    ok: true,
    json: async () => ({ output_text: "output text reply" }),
  }));
  const fromContentParts = await requestChatCompletion(api, "ping", async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: [{ type: "text", text: "part reply" }] } }],
    }),
  }));

  assert.equal(fromText, "plain text reply");
  assert.equal(fromOutputText, "output text reply");
  assert.equal(fromContentParts, "part reply");
});

test("throws when completion has no usable text", async () => {
  await assert.rejects(
    () => requestChatCompletion(
      {
        apiUrl: "https://api.example/v1",
        apiKey: "secret",
        model: "gpt-real",
      },
      "ping",
      async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "" } }] }),
      }),
    ),
    /没有返回内容/,
  );
});

test("includes model and status in API error messages", async () => {
  await assert.rejects(
    () => requestChatCompletion(
      {
        apiUrl: "https://api.example/v1",
        apiKey: "secret",
        model: "gpt-real",
      },
      "ping",
      async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "The quota has been exceeded." } }),
      }),
    ),
    /gpt-real.*HTTP 429/,
  );
});

test("fetches model ids from an API provider", async () => {
  const models = await fetchModelList(
    { apiUrl: "https://api.example/v1", apiKey: "secret" },
    async (url, options) => {
      assert.equal(url, "https://api.example/v1/models");
      assert.equal(options.headers.Authorization, "Bearer secret");
      return {
        ok: true,
        json: async () => ({ data: [{ id: "gpt-a" }, { id: "gpt-b" }] }),
      };
    },
  );

  assert.deepEqual(models, ["gpt-a", "gpt-b"]);
});
