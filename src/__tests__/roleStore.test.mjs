import assert from "node:assert/strict";
import test from "node:test";
import {
  createMemoryStorage,
  createRoleDraft,
  RoleStore,
} from "../lib/roleStore.js";

test("creates a blank role draft with the expected fields", () => {
  const draft = createRoleDraft();

  assert.deepEqual(Object.keys(draft), [
    "id",
    "avatar",
    "name",
    "gender",
    "identity",
    "personality",
    "appearance",
    "worldview",
    "persona",
  ]);
  assert.equal(draft.name, "");
  assert.equal(draft.gender, "");
  assert.equal(draft.worldview, "");
});

test("saves a new role and restores it from storage", () => {
  const storage = createMemoryStorage();
  const store = new RoleStore(storage);
  const saved = store.save({
    ...createRoleDraft(),
    avatar: "data:image/png;base64,avatar",
    name: "林月",
    gender: "女",
    identity: "花店老板",
    personality: "温柔、敏锐",
    appearance: "栗色短发，常穿浅色针织衫",
    persona: "她经营一家街角花店，擅长用花语回应顾客的心事。",
  });

  const restored = new RoleStore(storage);

  assert.equal(saved.id.startsWith("role-"), true);
  assert.equal(restored.list().length, 1);
  assert.equal(restored.list()[0].name, "林月");
  assert.equal(restored.list()[0].avatar, "data:image/png;base64,avatar");
});

test("deletes a saved role and persists the list", () => {
  const storage = createMemoryStorage();
  const store = new RoleStore(storage);
  const first = store.save({ ...createRoleDraft(), name: "林月" });
  const second = store.save({ ...createRoleDraft(), name: "陆斯年" });

  assert.equal(store.remove(first.id), true);
  assert.equal(store.remove("missing-role"), false);

  const restored = new RoleStore(storage);

  assert.deepEqual(restored.list().map((role) => role.id), [second.id]);
  assert.equal(restored.list()[0].name, "陆斯年");
});
