export const CHAT_STORAGE_KEY = "ephone.microchat";

export function createChatMessage({ role = "user", content = "", status = "sent", type = "text", meta = {} } = {}) {
  return {
    id: makeChatId("msg"),
    role,
    type,
    content: String(content || ""),
    meta: meta && typeof meta === "object" ? { ...meta } : {},
    status,
    createdAt: Date.now(),
  };
}

const proactiveTexts = [
  "刚看到一件事，想起你了。",
  "现在方便说话吗？",
  "路过你之前提过的地方。",
  "今天有点安静。",
  "突然想问问你在不在。",
];

export function createProactiveChatMessage(conversation = {}, random = Math.random) {
  const title = conversation.title || conversation.roleSnapshot?.name || "对方";
  const roll = Math.max(0, Math.min(0.999, Number(random()) || 0));
  if (roll < 0.2) {
    return createChatMessage({
      role: "assistant",
      type: "recall",
      content: `${title}撤回了一条消息`,
    });
  }
  if (roll < 0.4) {
    return createChatMessage({
      role: "assistant",
      type: "transfer",
      content: "转账",
      meta: {
        title: "转账给你",
        subtitle: `${title}发起的转账`,
        amount: 52,
        status: "pending",
      },
    });
  }
  if (roll < 0.6) {
    return createChatMessage({
      role: "assistant",
      type: "pat",
      content: `${title}拍了拍我`,
    });
  }
  if (roll < 0.8) {
    return createChatMessage({
      role: "assistant",
      type: "location",
      content: "分享位置",
      meta: {
        title: "位置",
        subtitle: "对方分享了一个坐标",
      },
    });
  }

  const index = Math.min(proactiveTexts.length - 1, Math.floor((roll - 0.8) / 0.2 * proactiveTexts.length));
  return createChatMessage({
    role: "assistant",
    type: "text",
    content: proactiveTexts[index] || proactiveTexts[0],
  });
}

function cleanAssistantReply(content = "") {
  return String(content || "")
    .replace(/^["'“”‘’\[\],\s]+|["'“”‘’\[\],\s]+$/g, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/(?:将|把|伸手|抬手|低头|转身|握住|收起|收入|举起|放下|靠在|站在|坐在|走到|走近|靠近|拿起|拿出|递给|递过|塞给|交到|放进|看着|抬眼|垂眸)[^，。！？；、,.!?;\n]*/g, "")
    .replace(/(?:我)?(?:给你转|转给你|给你发|发给你)[^，。！？；、,.!?;\n]*\d+(?:\.\d+)?[^，。！？；、,.!?;\n]*/g, "我发了，点收款。")
    .replace(/\s+/g, " ")
    .replace(/\s*([，。！？；、,.!?;])\s*/g, "$1")
    .replace(/([。！？；,.!?]){2,}/g, "$1")
    .replace(/^[，。！？；、,.!?;]+/, "")
    .trim();
}

export function isPromptLeakReply(content = "") {
  const text = String(content || "").trim();
  if (!text) return true;
  return /改写说明|调整对话|保持原有|提示词|回复要求|输出要求|格式说明|JSON|Markdown|字符串数组|数组长度|不要解释|不要旁白|\*\*/i.test(text)
    || /^[\[\]{}]+$/.test(text);
}

function parseReplyItemsFromJson(text) {
  const candidates = [text];
  const bracketed = text.match(/\[[\s\S]*?\]/)?.[0];
  if (bracketed && bracketed !== text) candidates.push(bracketed);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      const items = Array.isArray(parsed) ? parsed : parsed?.messages || parsed?.replies || null;
      if (Array.isArray(items)) return items;
    } catch {
      // Try the next shape.
    }
  }

  return null;
}

export function parseAssistantReplies(raw, limit = 3) {
  const text = String(raw || "").trim();
  if (!text) return [];
  const jsonText = text.match(/```json\s*([\s\S]*?)```/)?.[1] || text.match(/```\s*([\s\S]*?)```/)?.[1] || text;
  const items = parseReplyItemsFromJson(jsonText);
  const quotedItems = !Array.isArray(items) && jsonText.includes("[")
    ? Array.from(jsonText.matchAll(/"([^"\n]{1,160})"/g)).map((match) => match[1])
    : null;
  const source = Array.isArray(items)
    ? items.map((item) => (typeof item === "string" ? item : item?.content || item?.text || ""))
    : quotedItems?.length
      ? quotedItems
    : text.split(/\n+/).map((line) => line.replace(/^[-*\d.、\s]+/, ""));
  const cleaned = source.map(cleanAssistantReply).filter((reply) => reply && !isPromptLeakReply(reply));
  return cleaned.slice(0, Math.max(1, Math.min(3, Number(limit) || 3)));
}

function createProfileSnapshot(profile = {}) {
  return {
    name: profile?.name || "",
    gender: profile?.gender || "",
    identity: profile?.identity || "",
    personality: profile?.personality || "",
    appearance: profile?.appearance || "",
    worldview: profile?.worldview || "",
    persona: profile?.persona || "",
  };
}

export function createConversationDraft(role, userProfile) {
  return {
    id: role?.id ? `chat-${role.id}` : makeChatId("chat"),
    roleId: role?.id || "",
    title: role?.name || "未命名角色",
    avatar: role?.avatar || "",
    roleSnapshot: createProfileSnapshot(role),
    userSnapshot: createProfileSnapshot(userProfile),
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

export function createMomentPost({
  authorName = "",
  avatar = "",
  content = "",
  image = "",
  postType = "text",
  likes = [],
  comments = [],
  createdAt = Date.now(),
} = {}) {
  return {
    id: makeChatId("moment"),
    authorName: authorName || "未命名角色",
    avatar: avatar || "",
    content: String(content || ""),
    image: image || "",
    postType: postType === "image_text" ? "image_text" : "text",
    likes: Array.isArray(likes) ? likes.map(mergeMomentLike) : [],
    comments: Array.isArray(comments) ? comments.map(mergeMomentComment) : [],
    createdAt: Number(createdAt) || Date.now(),
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
    userSnapshot: {
      ...draft.userSnapshot,
      ...(conversation.userSnapshot || {}),
    },
    messages: Array.isArray(conversation.messages) ? conversation.messages.map(mergeMessage) : [],
  };
}

function mergeMessage(message = {}) {
  return {
    id: message.id || makeChatId("msg"),
    role: message.role || "user",
    type: message.type || "text",
    content: String(message.content || ""),
    meta: message.meta && typeof message.meta === "object" ? { ...message.meta } : {},
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
    likes: Array.isArray(post.likes) ? post.likes.map(mergeMomentLike) : [],
    comments: Array.isArray(post.comments) ? post.comments.map(mergeMomentComment) : [],
    createdAt: Number(post.createdAt) || Date.now(),
  };
}

function mergeMomentLike(like = {}) {
  return {
    id: like.id || like.name || makeChatId("like"),
    name: like.name || "我",
    createdAt: Number(like.createdAt) || Date.now(),
  };
}

function mergeMomentComment(comment = {}) {
  return {
    id: comment.id || makeChatId("comment"),
    authorName: comment.authorName || "我",
    content: String(comment.content || ""),
    replies: Array.isArray(comment.replies) ? comment.replies.map(mergeMomentReply) : [],
    createdAt: Number(comment.createdAt) || Date.now(),
  };
}

function mergeMomentReply(reply = {}) {
  return {
    id: reply.id || makeChatId("reply"),
    authorName: reply.authorName || "角色",
    replyToName: reply.replyToName || "",
    content: String(reply.content || ""),
    createdAt: Number(reply.createdAt) || Date.now(),
  };
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

  startConversation(role, userProfile) {
    const id = role?.id ? `chat-${role.id}` : "";
    const existing = id ? this.get(id) : null;
    if (existing) {
      this.bindConversationUser(existing.id, userProfile || existing.userSnapshot);
      return existing;
    }

    const next = createConversationDraft(role, userProfile);
    this.conversations.push(next);
    this.persist();
    return next;
  }

  bindConversationUser(conversationId, userProfile) {
    const conversation = this.get(conversationId);
    if (!conversation) return null;
    conversation.userSnapshot = createProfileSnapshot(userProfile || conversation.userSnapshot);
    this.persist();
    return conversation;
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

  updateMessageMeta(conversationId, messageId, meta = {}) {
    const conversation = this.get(conversationId);
    if (!conversation) return null;
    const message = conversation.messages.find((item) => item.id === messageId);
    if (!message) return null;
    message.meta = {
      ...(message.meta || {}),
      ...meta,
    };
    conversation.updatedAt = Date.now();
    this.persist();
    return message;
  }

  markRead(conversationId) {
    const conversation = this.get(conversationId);
    if (!conversation) return null;
    conversation.unread = 0;
    this.persist();
    return conversation;
  }

  removeConversation(conversationId) {
    const before = this.conversations.length;
    this.conversations = this.conversations.filter((conversation) => conversation.id !== conversationId);
    if (this.conversations.length === before) return false;
    this.persist();
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
    this.contactRequests.push(request);
    this.persist();
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
    this.contacts.push(contact);
    const request = createContactRequest(role, { direction: "outgoing", status: "accepted" });
    this.contactRequests.push(request);
    this.persist();
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
    this.momentPosts.push(next);
    this.persist();
    return next;
  }

  clearMomentPosts() {
    this.momentPosts = [];
    this.persist();
  }

  getMomentPost(postId) {
    return this.momentPosts.find((post) => post.id === postId) || null;
  }

  toggleMomentLike(postId, user = {}) {
    const post = this.getMomentPost(postId);
    if (!post) return null;
    const likeId = user.id || user.name || "me";
    const existing = post.likes.find((like) => like.id === likeId);
    post.likes = existing
      ? post.likes.filter((like) => like.id !== likeId)
      : [...post.likes, mergeMomentLike({ id: likeId, name: user.name || "我" })];
    this.persist();
    return post;
  }

  addMomentComment(postId, comment = {}) {
    const post = this.getMomentPost(postId);
    if (!post) return null;
    const nextComment = mergeMomentComment(comment);
    post.comments = [...post.comments, nextComment];
    this.persist();
    return nextComment;
  }

  addMomentReply(postId, commentId, reply = {}) {
    const post = this.getMomentPost(postId);
    if (!post) return null;
    const comment = post.comments.find((item) => item.id === commentId);
    if (!comment) return null;
    const nextReply = mergeMomentReply(reply);
    comment.replies = [...comment.replies, nextReply];
    this.persist();
    return nextReply;
  }
}
