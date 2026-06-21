import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage } from "../lib/roleStore.js";
import {
  ChatStore,
  createChatMessage,
  createConversationDraft,
} from "../lib/chatStore.js";

const role = {
  id: "role-lu",
  avatar: "data:image/png;base64,avatar",
  name: "陆斯年",
  gender: "男",
  identity: "学生会纪律部长",
  personality: "外冷内热",
  appearance: "银框眼镜",
  worldview: "校园",
  persona: "严谨自律，说话简短。",
};

test("creates a conversation draft from a role snapshot", () => {
  const conversation = createConversationDraft(role);

  assert.equal(conversation.id, "chat-role-lu");
  assert.equal(conversation.title, "陆斯年");
  assert.equal(conversation.roleSnapshot.identity, "学生会纪律部长");
  assert.deepEqual(conversation.messages, []);
});

test("starts one conversation per role and persists messages", () => {
  const storage = createMemoryStorage();
  const store = new ChatStore(storage);
  const conversation = store.startConversation(role);
  const again = store.startConversation(role);

  assert.equal(conversation.id, again.id);
  store.addMessage(conversation.id, createChatMessage({ role: "user", content: "你好" }));
  store.addMessage(conversation.id, createChatMessage({ role: "assistant", content: "晚上好。" }));

  const restored = new ChatStore(storage);
  const [restoredConversation] = restored.list();

  assert.equal(restored.list().length, 1);
  assert.equal(restoredConversation.messages.length, 2);
  assert.equal(restoredConversation.messages[1].content, "晚上好。");
});

test("removes a conversation and its messages from storage", () => {
  const storage = createMemoryStorage();
  const store = new ChatStore(storage);
  const conversation = store.startConversation(role);
  store.addMessage(conversation.id, createChatMessage({ role: "user", content: "删除前" }));

  assert.equal(store.removeConversation(conversation.id), true);
  assert.equal(store.list().length, 0);

  const restored = new ChatStore(storage);
  assert.equal(restored.get(conversation.id), null);
});

test("keeps contacts empty until a role accepts the add request", () => {
  const storage = createMemoryStorage();
  const store = new ChatStore(storage);

  assert.deepEqual(store.listContacts(), []);

  const rejected = store.requestContact(role, () => 0.1);
  assert.equal(rejected.accepted, false);
  assert.deepEqual(store.listContacts(), []);

  const accepted = store.requestContact(role, () => 0.9);
  assert.equal(accepted.accepted, true);
  assert.equal(store.listContacts().length, 1);
  assert.equal(store.listContacts()[0].name, "陆斯年");

  const restored = new ChatStore(storage);
  assert.equal(restored.listContacts()[0].id, "role-lu");
});
