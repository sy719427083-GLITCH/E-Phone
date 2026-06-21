export const ROLE_STORAGE_KEY = "ephone.roles";

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

export function createRoleDraft() {
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

function makeRoleId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `role-${crypto.randomUUID()}`;
  }
  return `role-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mergeRole(role = {}) {
  return { ...createRoleDraft(), ...role };
}

export class RoleStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.roles = [];
    this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(this.storage?.getItem(ROLE_STORAGE_KEY) || "{}");
      this.roles = Array.isArray(parsed.roles) ? parsed.roles.map(mergeRole) : [];
    } catch {
      this.roles = [];
    }
  }

  persist() {
    this.storage?.setItem(ROLE_STORAGE_KEY, JSON.stringify({ roles: this.roles }));
  }

  list() {
    return [...this.roles];
  }

  save(role) {
    const next = mergeRole({
      ...role,
      id: role.id && role.id !== "draft" ? role.id : makeRoleId(),
      name: role.name?.trim() || "未命名角色",
    });
    const index = this.roles.findIndex((item) => item.id === next.id);
    if (index >= 0) {
      this.roles[index] = next;
    } else {
      this.roles.push(next);
    }
    this.persist();
    return next;
  }

  remove(id) {
    const originalLength = this.roles.length;
    this.roles = this.roles.filter((role) => role.id !== id);
    if (this.roles.length === originalLength) return false;
    this.persist();
    return true;
  }
}
