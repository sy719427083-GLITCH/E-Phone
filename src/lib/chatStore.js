export const CHAT_STORAGE_KEY = "ephone.microchat";

export function createChatMessage({ role = "user", content = "", status = "sent" } = {}) {
  return {
    id: makeChatId("msg"),
    role,
    content: String(content || ""),
    status,
    createdAt: Date.now(),
  };
}

export function createConversationDraft(role) {
  return {
    id: role?.id ? `chat-${role.id}` : makeChatId("chat"),
    roleId: role?.id || "",
    title: role?.name || "未命名角色",
    avatar: role?.avatar || "",
    roleSnapshot: {
      name: role?.name || "",
      gender: role?.gender || "",
      identity: role?.identity || "",
      personality: role?.personality || "",
      appearance: role?.appearance || "",
      worldview: role?.worldview || "",
      persona: role?.persona || "",
    },
    messages: [],
    unread: 0,
    updatedAt: Date.now(),
  };
}

export function createContactDraft(role) {
  return {
    id: role?.id || makeChatId("contact"),
    name: role?.name || "未命名角色",
    avatar: role?.avatar || "",
    identity: role?.identity || "",
    personality: role?.personality || "",
    addedAt: Date.now(),
  };
}

export function createContactRequest(role, { direction = "outgoing", status = "pending" } = {}) {
  return {
    id: makeChatId("request"),
    roleId: role?.id || "",
    roleName: role?.name || "未命名角色",
    avatar: role?.avatar || "",
    identity: role?.identity || "",
    personality: role?.personality || "",
    direction,
    status,
    createdAt: Date.now(),
  };
}

export function createMomentPost({ authorName = "", avatar = "", content = "", image = "", postType = "text" } = {}) {
  return {
    id: makeChatId("moment"),
    authorName: authorName || "未命名角色",
    avatar: avatar || "",
    content: String(content || ""),
    image: image || "",
    postType: postType === "image_text" ? "image_text" : "text",
    createdAt: Date.now(),
  };
}

function makeChatId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mergeConversation(conversation = {}) {
  const draft = createConversationDraft();
  return {
    ...draft,
    ...conversation,
    roleSnapshot: {
      ...draft.roleSnapshot,
      ...(conversation.roleSnapshot || {}),
    },
    messages: Array.isArray(conversation.messages) ? conversation.messages.map(mergeMessage) : [],
  };
}

function mergeMessage(message = {}) {
  return {
    id: message.id || makeChatId("msg"),
    role: message.role || "user",
    content: String(message.content || ""),
    status: message.status || "sent",
    createdAt: Number(message.createdAt) || Date.now(),
  };
}

function mergeContact(contact = {}) {
  const draft = createContactDraft();
  return {
    ...draft,
    ...contact,
    name: contact.name || draft.name,
    addedAt: Number(contact.addedAt) || Date.now(),
  };
}

function mergeContactRequest(request = {}) {
  const draft = createContactRequest();
  return {
    ...draft,
    ...request,
    roleName: request.roleName || request.name || draft.roleName,
    createdAt: Number(request.createdAt) || Date.now(),
  };
}

function mergeMomentPost(post = {}) {
  const draft = createMomentPost();
  return {
    ...draft,
    ...post,
    authorName: post.authorName || draft.authorName,
    content: String(post.content || ""),
    image: post.image || "",
    postType: post.postType === "image_text" ? "image_text" : "text",
    createdAt: Number(post.createdAt) || Date.now(),
  };
}

function storageError(error) {
  const reason = error?.name === "QuotaExceededError"
    ? "浏览器本地存储空间不足，请换小一点的头像或删除旧聊天/朋友圈数据。"
    : error?.message || "浏览器本地存储写入失败。";
  return new Error(`保存失败：${reason}`);
}

export class ChatStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.conversations = [];
    this.contacts = [];
    this.contactRequests = [];
    this.momentPosts = [];
    this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(this.storage?.getItem(CHAT_STORAGE_KEY) || "{}");
      this.conversations = Array.isArray(parsed.conversations)
        ? parsed.conversations.map(mergeConversation)
        : [];
      this.contacts = Array.isArray(parsed.contacts)
        ? parsed.contacts.map(mergeContact)
        : [];
      this.contactRequests = Array.isArray(parsed.contactRequests)
        ? parsed.contactRequests.map(mergeContactRequest)
        : [];
      this.momentPosts = Array.isArray(parsed.momentPosts)
        ? parsed.momentPosts.map(mergeMomentPost)
        : [];
    } catch {
      this.conversations = [];
      this.contacts = [];
      this.contactRequests = [];
      this.momentPosts = [];
    }
  }

  persist() {
    this.storage?.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({
        conversations: this.conversations,
        contacts: this.contacts,
        contactRequests: this.contactRequests,
        momentPosts: this.momentPosts,
      }),
    );
  }

  list() {
    return [...this.conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  get(id) {
    return this.conversations.find((conversation) => conversation.id === id) || null;
  }

  startConversation(role) {
    const id = role?.id ? `chat-${role.id}` : "";
    const existing = id ? this.get(id) : null;
    if (existing) return existing;

    const next = createConversationDraft(role);
    const previousConversations = this.conversations;
    this.conversations = [...this.conversations, next];
    try {
      this.persist();
    } catch (error) {
      this.conversations = previousConversations;
      throw storageError(error);
    }
    return next;
  }

  addMessage(conversationId, message) {
    const index = this.conversations.findIndex((conversation) => conversation.id === conversationId);
    const conversation = index >= 0 ? this.conversations[index] : null;
    if (!conversation) return null;

    const nextMessage = mergeMessage(message);
    const nextConversation = {
      ...conversation,
      messages: [...conversation.messages, nextMessage],
      updatedAt: nextMessage.createdAt,
    };
    const previousConversations = this.conversations;
    this.conversations = [
      ...this.conversations.slice(0, index),
      nextConversation,
      ...this.conversations.slice(index + 1),
    ];
    try {
      this.persist();
    } catch (error) {
      this.conversations = previousConversations;
      throw storageError(error);
    }
    return nextMessage;
  }

  markRead(conversationId) {
    const index = this.conversations.findIndex((conversation) => conversation.id === conversationId);
    const conversation = index >= 0 ? this.conversations[index] : null;
    if (!conversation) return null;
    const nextConversation = { ...conversation, unread: 0 };
    const previousConversations = this.conversations;
    this.conversations = [
      ...this.conversations.slice(0, index),
      nextConversation,
      ...this.conversations.slice(index + 1),
    ];
    try {
      this.persist();
    } catch (error) {
      this.conversations = previousConversations;
      throw storageError(error);
    }
    return conversation;
  }

  removeConversation(conversationId) {
    const before = this.conversations.length;
    const nextConversations = this.conversations.filter((conversation) => conversation.id !== conversationId);
    if (nextConversations.length === before) return false;
    const previousConversations = this.conversations;
    this.conversations = nextConversations;
    try {
      this.persist();
    } catch (error) {
      this.conversations = previousConversations;
      throw storageError(error);
    }
    return true;
  }

  listContacts() {
    return [...this.contacts].sort((a, b) => b.addedAt - a.addedAt);
  }

  listContactRequests() {
    return this.contactRequests
      .map((request, index) => ({ request, index }))
      .sort((a, b) => (b.request.createdAt - a.request.createdAt) || (b.index - a.index))
      .map(({ request }) => request);
  }

  recordContactRequest(role, options) {
    const request = createContactRequest(role, options);
    const previousRequests = this.contactRequests;
    this.contactRequests = [...this.contactRequests, request];
    try {
      this.persist();
    } catch (error) {
      this.contactRequests = previousRequests;
      throw storageError(error);
    }
    return request;
  }

  requestContact(role, random = Math.random) {
    const id = role?.id || "";
    const existing = id ? this.contacts.find((contact) => contact.id === id) : null;
    if (existing) return { accepted: true, contact: existing, alreadyAdded: true };

    const accepted = random() >= 0.3;
    if (!accepted) {
      const request = this.recordContactRequest(role, { direction: "outgoing", status: "rejected" });
      return { accepted: false, contact: null, request, reason: `${role?.name || "对方"}拒绝了你的添加请求。` };
    }

    const contact = createContactDraft(role);
    const request = createContactRequest(role, { direction: "outgoing", status: "accepted" });
    const previousContacts = this.contacts;
    const previousRequests = this.contactRequests;
    this.contacts = [...this.contacts, contact];
    this.contactRequests = [...this.contactRequests, request];
    try {
      this.persist();
    } catch (error) {
      this.contacts = previousContacts;
      this.contactRequests = previousRequests;
      throw storageError(error);
    }
    return { accepted: true, contact, request, alreadyAdded: false };
  }

  listMomentPosts() {
    return this.momentPosts
      .map((post, index) => ({ post, index }))
      .sort((a, b) => (b.post.createdAt - a.post.createdAt) || (b.index - a.index))
      .map(({ post }) => post);
  }

  addMomentPost(post) {
    const next = createMomentPost(post);
    const previousPosts = this.momentPosts;
    this.momentPosts = [...this.momentPosts, next];
    try {
      this.persist();
    } catch (error) {
      this.momentPosts = previousPosts;
      throw storageError(error);
    }
    return next;
  }
}
