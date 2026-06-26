import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage } from "../lib/roleStore.js";
import { createWorldBookDraft, WorldBookStore } from "../lib/worldBookStore.js";

test("creates a first world book page draft", () => {
  const draft = createWorldBookDraft();

  assert.equal(draft.id, "world-page-1");
  assert.equal(draft.name, "第一页");
  assert.equal(draft.era, "modern");
  assert.equal(draft.content, "");
});

test("saves and restores the first world book page", () => {
  const storage = createMemoryStorage();
  const store = new WorldBookStore(storage);

  const saved = store.save({
    ...createWorldBookDraft(),
    name: "北辰学园",
    era: "ancient",
    summary: "架空古风学院。",
    content: "世界以灵契与门阀为主线。",
  });

  const restored = new WorldBookStore(storage);

  assert.equal(saved.id, "world-page-1");
  assert.equal(restored.list().length, 1);
  assert.equal(restored.getFirstPage().name, "北辰学园");
  assert.equal(restored.getFirstPage().era, "ancient");
  assert.equal(restored.getFirstPage().content, "世界以灵契与门阀为主线。");
});
