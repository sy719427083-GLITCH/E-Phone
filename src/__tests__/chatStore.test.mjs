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

test("stores the selected identity snapshot on conversations", () => {
  const identity = {
    id: "identity-me",
    name: "苏夜",
    gender: "女",
    identity: "转学生",
    personality: "敏感但直接",
    appearance: "黑发短发",
    worldview: "校园",
    persona: "不喜欢被敷衍。",
  };
  const conversation = createConversationDraft(role, identity);

  assert.equal(conversation.userSnapshot.name, "苏夜");
  assert.equal(conversation.userSnapshot.identity, "转学生");
});

test("updates an existing conversation with the current identity", () => {
  const storage = createMemoryStorage();
  const store = new ChatStore(storage);
  const conversation = store.startConversation(role);

  store.bindConversationUser(conversation.id, {
    name: "苏夜",
    identity: "转学生",
    persona: "不喜欢被敷衍。",
  });

  const restored = new ChatStore(storage).get(conversation.id);
  assert.equal(restored.userSnapshot.name, "苏夜");
  assert.equal(restored.userSnapshot.persona, "不喜欢被敷衍。");
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

test("records contact request history", () => {
  const storage = createMemoryStorage();
  const store = new ChatStore(storage);

  store.requestContact(role, () => 0.1);
  store.requestContact({ ...role, id: "role-accepted", name: "林以" }, () => 0.9);

  const requests = store.listContactRequests();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].status, "accepted");
  assert.equal(requests[1].status, "rejected");

  const restored = new ChatStore(storage);
  assert.equal(restored.listContactRequests()[0].roleName, "林以");
});

test("saves generated moments posts", () => {
  const storage = createMemoryStorage();
  const store = new ChatStore(storage);

  const post = store.addMomentPost({
    authorName: "陆斯年",
    avatar: "data:image/png;base64,avatar",
    content: "今天的风很轻。",
    image: "data:image/png;base64,moment",
    postType: "image_text",
  });

  assert.equal(store.listMomentPosts().length, 1);
  assert.equal(post.content, "今天的风很轻。");
  assert.equal(post.image, "data:image/png;base64,moment");
  assert.equal(post.postType, "image_text");

  const restored = new ChatStore(storage);
  assert.equal(restored.listMomentPosts()[0].authorName, "陆斯年");
  assert.equal(restored.listMomentPosts()[0].image, "data:image/png;base64,moment");
});

test("stores moment likes, comments, and role replies", () => {
  const storage = createMemoryStorage();
  const store = new ChatStore(storage);
  const post = store.addMomentPost({
    authorName: "陆斯年",
    avatar: "data:image/png;base64,avatar",
    content: "今天的风很轻。",
  });

  const liked = store.toggleMomentLike(post.id, { id: "me", name: "我" });
  assert.equal(liked.likes.length, 1);
  assert.equal(liked.likes[0].name, "我");

  const unliked = store.toggleMomentLike(post.id, { id: "me", name: "我" });
  assert.equal(unliked.likes.length, 0);

  const comment = store.addMomentComment(post.id, { authorName: "我", content: "像你会说的话。" });
  assert.equal(comment.content, "像你会说的话。");

  const reply = store.addMomentReply(post.id, comment.id, { authorName: "陆斯年", content: "只是实话。" });
  assert.equal(reply.content, "只是实话。");

  const restoredPost = new ChatStore(storage).listMomentPosts()[0];
  assert.equal(restoredPost.comments.length, 1);
  assert.equal(restoredPost.comments[0].replies[0].authorName, "陆斯年");
});
