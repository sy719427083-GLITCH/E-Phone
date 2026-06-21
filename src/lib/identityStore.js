export const IDENTITY_STORAGE_KEY = "ephone.identities";

export function createIdentityDraft() {
  return {
    id: "draft",
    avatar: "",
    name: "",
    gender: "",
    identity: "",
    personality: "",
    appearance: "",
    worldview: "",
    persona: "",
  };
}

function makeIdentityId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `identity-${crypto.randomUUID()}`;
  }
  return `identity-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mergeIdentity(identity = {}) {
  return { ...createIdentityDraft(), ...identity };
}

function storageError(error) {
  const reason = error?.name === "QuotaExceededError"
    ? "浏览器本地存储空间不足，请换小一点的头像或删除旧数据。"
    : error?.message || "浏览器本地存储写入失败。";
  return new Error(`保存失败：${reason}`);
}

export class IdentityStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.identities = [];
    this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(this.storage?.getItem(IDENTITY_STORAGE_KEY) || "{}");
      this.identities = Array.isArray(parsed.identities) ? parsed.identities.map(mergeIdentity) : [];
    } catch {
      this.identities = [];
    }
  }

  persist() {
    this.storage?.setItem(IDENTITY_STORAGE_KEY, JSON.stringify({ identities: this.identities }));
  }

  list() {
    return [...this.identities];
  }

  save(identity) {
    const next = mergeIdentity({
      ...identity,
      id: identity.id && identity.id !== "draft" ? identity.id : makeIdentityId(),
      name: identity.name?.trim() || "未命名身份",
    });
    const index = this.identities.findIndex((item) => item.id === next.id);
    const previousIdentities = this.identities;
    const nextIdentities = [...this.identities];
    if (index >= 0) {
      nextIdentities[index] = next;
    } else {
      nextIdentities.push(next);
    }
    this.identities = nextIdentities;
    try {
      this.persist();
    } catch (error) {
      this.identities = previousIdentities;
      throw storageError(error);
    }
    return next;
  }

  remove(id) {
    const originalLength = this.identities.length;
    const nextIdentities = this.identities.filter((identity) => identity.id !== id);
    if (nextIdentities.length === originalLength) return false;
    const previousIdentities = this.identities;
    this.identities = nextIdentities;
    try {
      this.persist();
    } catch (error) {
      this.identities = previousIdentities;
      throw storageError(error);
    }
    return true;
  }
}
