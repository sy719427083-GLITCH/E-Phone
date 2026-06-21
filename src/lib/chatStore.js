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

export class ChatStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.conversations = [];
    this.contacts = [];
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
    } catch {
      this.conversations = [];
      this.contacts = [];
    }
  }

  persist() {
    this.storage?.setItem(
      CHAT_STORAGE_KEY,
      JSON.stringify({ conversations: this.conversations, contacts: this.contacts }),
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
    this.conversations.push(next);
    this.persist();
    return next;
  }

  addMessage(conversationId, message) {
    const conversation = this.get(conversationId);
    if (!conversation) return null;

    const nextMessage = mergeMessage(message);
    conversation.messages = [...conversation.messages, nextMessage];
    conversation.updatedAt = nextMessage.createdAt;
    this.persist();
    return nextMessage;
  }

  markRead(conversationId) {
    const conversation = this.get(conversationId);
    if (!conversation) return null;
    conversation.unread = 0;
    this.persist();
    return conversation;
  }

  listContacts() {
    return [...this.contacts].sort((a, b) => b.addedAt - a.addedAt);
  }

  requestContact(role, random = Math.random) {
    const id = role?.id || "";
    const existing = id ? this.contacts.find((contact) => contact.id === id) : null;
    if (existing) return { accepted: true, contact: existing, alreadyAdded: true };

    const accepted = random() >= 0.3;
    if (!accepted) return { accepted: false, contact: null, reason: `${role?.name || "对方"}拒绝了你的添加请求。` };

    const contact = createContactDraft(role);
    this.contacts.push(contact);
    this.persist();
    return { accepted: true, contact, alreadyAdded: false };
  }
}
