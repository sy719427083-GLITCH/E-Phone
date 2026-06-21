function normalizeMomentCount(count) {
  return Math.max(1, Math.min(5, Number(count) || 1));
}

export function getDefaultMomentCount() {
  return 1;
}

export function normalizeMomentPostType(postType) {
  return postType === "image_text" ? "image_text" : "text";
}

export function getMomentMaxTokens(count, postType = "text") {
  const limit = normalizeMomentCount(count);
  return normalizeMomentPostType(postType) === "image_text"
    ? Math.min(420, 120 + limit * 40)
    : Math.min(260, 60 + (limit - 1) * 40);
}

export function getMomentRequestDelayMs(index, postType = "text") {
  if (normalizeMomentPostType(postType) !== "text") return 0;
  return Number(index) > 0 ? 1100 : 0;
}

export function getMomentReplyDelayMs(random = Math.random) {
  return 1800 + Math.round(Math.max(0, Math.min(1, random())) * 1800);
}

export function formatMomentReplyText(authorName = "角色", content = "") {
  return `${authorName || "角色"}回复了我${String(content || "").trim()}`;
}

export function shouldKeepPartialMomentResults(error, generatedCount = 0) {
  const message = String(error?.message || "").toLowerCase();
  const isQuotaLike = message.includes("quota")
    || message.includes("rate limit")
    || message.includes("rate_limit")
    || message.includes("too many requests")
    || message.includes("insufficient");
  return isQuotaLike && Number(generatedCount) > 0;
}

export function shouldGenerateSpontaneousMoment({
  contacts = [],
  lastGeneratedAt = 0,
  now = Date.now(),
  random = Math.random,
  isGenerating = false,
  allowSpontaneous = true,
} = {}) {
  if (!allowSpontaneous) return false;
  if (isGenerating) return false;
  if (contacts.length === 0) return false;
  if (now - Number(lastGeneratedAt || 0) < 60_000) return false;
  return random() < 0.35;
}

function getMomentCandidates(contacts = [], myProfile = null) {
  return contacts.filter((contact) => {
    const isMeById = myProfile?.id && contact.id === myProfile.id;
    const isMeByName = myProfile?.name && contact.name === myProfile.name;
    return !isMeById && !isMeByName;
  });
}

export function pickMomentAuthor({ contacts = [], selectedRoleId = "", myProfile = null, random = Math.random } = {}) {
  const filtered = getMomentCandidates(contacts, myProfile);
  if (selectedRoleId) {
    return filtered.find((contact) => contact.id === selectedRoleId) || null;
  }
  if (filtered.length === 0) return null;
  const index = Math.min(filtered.length - 1, Math.floor(random() * filtered.length));
  return filtered[index];
}

export function pickMomentAuthors({
  contacts = [],
  selectedRoleId = "",
  count = 1,
  myProfile = null,
  random = null,
} = {}) {
  const limit = normalizeMomentCount(count);
  const filtered = getMomentCandidates(contacts, myProfile);
  if (selectedRoleId) {
    const selected = filtered.find((contact) => contact.id === selectedRoleId);
    return selected ? Array.from({ length: limit }, () => selected) : [];
  }
  if (filtered.length === 0) return [];

  return Array.from({ length: limit }, (_, index) => {
    if (typeof random === "function") {
      const randomIndex = Math.min(filtered.length - 1, Math.floor(random() * filtered.length));
      return filtered[randomIndex];
    }
    return filtered[index % filtered.length];
  });
}

export function buildMomentContext({ author = null, conversations = [] } = {}) {
  if (!author) return "";
  const conversation = conversations.find((item) => item.roleId === author.id || item.title === author.name);
  const messages = conversation?.messages || [];
  return messages.slice(-4).map((message) => (
    `${message.role === "user" ? "我" : author.name || "角色"}:${String(message.content || "").slice(0, 42)}`
  )).join(" | ");
}

export function buildMomentsPrompt({
  contacts = [],
  mode = "random",
  postType = "text",
  selectedRoleId = "",
  count = 1,
  author = null,
  context = "",
  nowText = "",
} = {}) {
  const limit = normalizeMomentCount(count);
  const normalizedPostType = normalizeMomentPostType(postType);
  const selected = author ? [author] : selectedRoleId
    ? contacts.filter((contact) => contact.id === selectedRoleId)
    : contacts.slice(0, 8);
  const roster = (selected.length > 0 ? selected : contacts.slice(0, 8));
  const roleLines = roster.map((contact) => (
    `${contact.name || "未命名"}:${contact.identity || "身份未填"};${contact.personality || "性格未填"}`
  )).join("|");

  if (normalizedPostType === "text") {
    const contact = author || roster[0] || {};
    if (limit > 1) {
      return [
        "为中文角色朋友圈生成动态。只返回 JSON 数组，不要 Markdown。",
        `条数:${limit};模式:${mode === "specified" ? "指定" : "随机"};类型:纯文字`,
        '格式:[{"authorName":"角色名","content":"朋友圈正文"}]',
        "每条1-100字，像真实朋友圈，可以像角色自发发布，内容可结合聊天、当天行程、所见所得或此刻心情。",
        `现在:${nowText || "当前时间"}`,
        context ? `聊天内容:${context}` : "",
        `角色:${roleLines || `${contact.name || "角色"}:${contact.identity || "身份未填"};${contact.personality || "性格未填"}`}`,
      ].filter(Boolean).join("\n");
    }
    return [
      "只回一句朋友圈正文，不要解释。",
      "类型:纯文字",
      `角色:${contact.name || "角色"};${contact.identity || "身份未填"};${contact.personality || "性格未填"}`,
      `要求:1-100字。参考:可结合聊天内容、今天行程、所见所得或现在心情。${nowText ? `现在:${nowText}` : ""}`,
      context ? `聊天内容:${context}` : "",
    ].join("\n");
  }

  return [
    "为中文角色朋友圈生成动态。只返回 JSON 数组，不要 Markdown。",
    `条数:${limit};模式:${mode === "specified" ? "指定" : "随机"};类型:${normalizedPostType === "image_text" ? "图文" : "纯文字"}`,
    '格式:[{"authorName":"角色名","content":"朋友圈正文"}]',
    "正文每条1-100字，生活化，有角色感。",
    `角色:${roleLines || "暂无"}`,
  ].join("\n");
}

export function buildTinyMomentPrompt({ author = null, context = "", nowText = "" } = {}) {
  const role = author || {};
  return [
    "只回一句朋友圈，正文1-100字，像角色自发发布。",
    `角色:${role.name || "角色"};${role.identity || ""};${role.personality || ""}`,
    context ? `参考:${context.slice(0, 36)}` : "",
    nowText ? `现在:${nowText}` : "",
  ].filter(Boolean).join("\n");
}

export function buildStandaloneMomentRetryPrompt({ author = null, context = "", nowText = "" } = {}) {
  const role = author || {};
  return [
    "写一句角色动态，1-100字，只输出正文。",
    `角色:${role.name || "角色"};${role.identity || ""};${role.personality || ""}`,
    context ? `参考:${context.slice(0, 40)}` : "",
    nowText ? `现在:${nowText}` : "",
  ].filter(Boolean).join("\n");
}

export function parseMomentPosts(raw, contacts = []) {
  const text = String(raw || "").trim();
  const jsonText = text.match(/```json\s*([\s\S]*?)```/)?.[1] || text.match(/```\s*([\s\S]*?)```/)?.[1] || text;
  try {
    const parsed = JSON.parse(jsonText);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items.map((item) => ({
      authorName: String(item.authorName || item.name || "").trim(),
      content: String(item.content || item.text || "").trim().slice(0, 100),
    })).filter((item) => item.authorName && item.content);
  } catch {
    return text.split(/\n+/).map((line, index) => {
      const contact = contacts[index % Math.max(contacts.length, 1)] || {};
      return {
        authorName: contact.name || "角色",
        content: line.replace(/^[-*\d.\s]+/, "").trim().slice(0, 100),
      };
    }).filter((item) => item.content);
  }
}
