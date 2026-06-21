import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage } from "../lib/roleStore.js";
import {
  createIdentityDraft,
  IdentityStore,
} from "../lib/identityStore.js";

test("creates a blank identity draft with the same profile fields", () => {
  const draft = createIdentityDraft();

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
});

test("saves and restores identities independently", () => {
  const storage = createMemoryStorage();
  const store = new IdentityStore(storage);
  const saved = store.save({
    ...createIdentityDraft(),
    avatar: "data:image/png;base64,avatar",
    name: "玩家本人",
    gender: "女",
    identity: "穿书者",
    personality: "冷静、敏锐",
    appearance: "银灰长发，常穿浅粉外套",
    persona: "她会以自己的身份进入剧情世界，推动关系与事件发展。",
  });

  const restored = new IdentityStore(storage);

  assert.equal(saved.id.startsWith("identity-"), true);
  assert.equal(restored.list().length, 1);
  assert.equal(restored.list()[0].name, "玩家本人");
  assert.equal(restored.list()[0].avatar, "data:image/png;base64,avatar");
});

test("deletes a saved identity and persists the list", () => {
  const storage = createMemoryStorage();
  const store = new IdentityStore(storage);
  const first = store.save({ ...createIdentityDraft(), name: "玩家本人" });
  const second = store.save({ ...createIdentityDraft(), name: "剧情分身" });

  assert.equal(store.remove(first.id), true);
  assert.equal(store.remove("missing-identity"), false);

  const restored = new IdentityStore(storage);

  assert.deepEqual(restored.list().map((identity) => identity.id), [second.id]);
  assert.equal(restored.list()[0].name, "剧情分身");
});

test("rolls back identity saves when browser storage is full", () => {
  const storage = createMemoryStorage();
  const store = new IdentityStore(storage);
  const saved = store.save({ ...createIdentityDraft(), name: "玩家本人" });
  storage.setItem = () => {
    const error = new Error("full");
    error.name = "QuotaExceededError";
    throw error;
  };

  assert.throws(
    () => store.save({ ...saved, name: "玩家本人改" }),
    /本地存储空间不足/,
  );

  assert.equal(store.list()[0].name, "玩家本人");
});
