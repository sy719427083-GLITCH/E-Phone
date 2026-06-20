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
    if (index >= 0) {
      this.identities[index] = next;
    } else {
      this.identities.push(next);
    }
    this.persist();
    return next;
  }

  remove(id) {
    const originalLength = this.identities.length;
    this.identities = this.identities.filter((identity) => identity.id !== id);
    if (this.identities.length === originalLength) return false;
    this.persist();
    return true;
  }
}
