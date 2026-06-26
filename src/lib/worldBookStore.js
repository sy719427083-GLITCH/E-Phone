export const WORLD_BOOK_STORAGE_KEY = "ephone.worldBooks";

export function createWorldBookDraft() {
  return {
    id: "world-page-1",
    name: "第一页",
    era: "modern",
    summary: "",
    content: "",
    updatedAt: 0,
  };
}

function mergeWorldBook(page = {}) {
  return {
    ...createWorldBookDraft(),
    ...page,
    id: page.id || "world-page-1",
    name: page.name?.trim() || "第一页",
    era: ["modern", "ancient"].includes(page.era) ? page.era : "modern",
    updatedAt: Number(page.updatedAt) || 0,
  };
}

export class WorldBookStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.pages = [];
    this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(this.storage?.getItem(WORLD_BOOK_STORAGE_KEY) || "{}");
      this.pages = Array.isArray(parsed.pages) ? parsed.pages.map(mergeWorldBook) : [];
    } catch {
      this.pages = [];
    }
  }

  persist() {
    this.storage?.setItem(WORLD_BOOK_STORAGE_KEY, JSON.stringify({ pages: this.pages }));
  }

  list() {
    return [...this.pages];
  }

  getFirstPage() {
    return this.pages[0] || createWorldBookDraft();
  }

  save(page) {
    const next = mergeWorldBook({
      ...page,
      id: "world-page-1",
      updatedAt: Date.now(),
    });
    this.pages = [next];
    this.persist();
    return next;
  }
}
