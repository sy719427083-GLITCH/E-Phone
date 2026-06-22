function normalizeMomentCount(count) {
  return Math.max(1, Math.min(5, Number(count) || 1));
}

export const SPONTANEOUS_MOMENT_MIN_INTERVAL_MS = 25 * 60_000;

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
    : 700;
}

export function getMomentRequestDelayMs(index, postType = "text") {
  if (normalizeMomentPostType(postType) !== "text") return 0;
  return Number(index) > 0 ? 1100 : 0;
}

export function getMomentReplyDelayMs(random = Math.random) {
  return 8000 + Math.round(Math.max(0, Math.min(1, random())) * 10000);
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
  recentPostAt = 0,
  now = Date.now(),
  random = Math.random,
  isGenerating = false,
  allowSpontaneous = true,
} = {}) {
  if (!allowSpontaneous) return false;
  if (isGenerating) return false;
  if (contacts.length === 0) return false;
  const lastActivityAt = Math.max(Number(lastGeneratedAt || 0), Number(recentPostAt || 0));
  if (now - lastActivityAt < SPONTANEOUS_MOMENT_MIN_INTERVAL_MS) return false;
  return random() < 0.28;
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
        "为中文角色生成日常动态短句。只返回 JSON 数组，不要 Markdown。",
        `条数:${limit};模式:${mode === "specified" ? "指定" : "随机"};类型:纯文字`,
        '格式:[{"authorName":"角色名","content":"动态正文"}]',
        "每条1-100字，像真实社交平台短动态，可以像角色自发发布，内容可结合聊天、当天行程、所见所得或此刻心情。",
        "不要写动作、手势、姿势、舞台指令或括号描写，例如不要写“将三枚铜钱收入袖中”。",
        `现在:${nowText || "当前时间"}`,
        context ? `聊天内容:${context}` : "",
        `角色:${roleLines || `${contact.name || "角色"}:${contact.identity || "身份未填"};${contact.personality || "性格未填"}`}`,
      ].filter(Boolean).join("\n");
    }
    return [
      "只回一句角色动态正文，不要解释。",
      "类型:纯文字",
      `角色:${contact.name || "角色"};${contact.identity || "身份未填"};${contact.personality || "性格未填"}`,
      `要求:1-100字，像真实社交平台短动态；不要写动作、手势、姿势、舞台指令或括号描写。参考:可结合聊天内容、今天行程、所见所得或现在心情。${nowText ? `现在:${nowText}` : ""}`,
      context ? `聊天内容:${context}` : "",
    ].join("\n");
  }

  return [
    "为中文角色生成日常动态短句。只返回 JSON 数组，不要 Markdown。",
    `条数:${limit};模式:${mode === "specified" ? "指定" : "随机"};类型:${normalizedPostType === "image_text" ? "图文" : "纯文字"}`,
    '格式:[{"authorName":"角色名","content":"动态正文"}]',
    "正文每条1-100字，像真实社交平台短动态，有角色感。不要写动作、手势、姿势、舞台指令或括号描写。",
    `角色:${roleLines || "暂无"}`,
  ].join("\n");
}

export function buildTinyMomentPrompt({ author = null, context = "", nowText = "" } = {}) {
  const role = author || {};
  return [
    "只回一句角色日常动态，正文1-100字，像真实社交平台短动态。",
    "不要写动作、手势、姿势、舞台指令或括号描写。",
    `角色:${role.name || "角色"};${role.identity || ""};${role.personality || ""}`,
    context ? `参考:${context.slice(0, 36)}` : "",
    nowText ? `现在:${nowText}` : "",
  ].filter(Boolean).join("\n");
}

export function cleanMomentContent(content = "") {
  return String(content || "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/(?:将|把|伸手|抬手|低头|转身|握住|收起|收入|举起|放下|靠在|站在|坐在|走到|拿起|抬眼|垂眸)[^，。！？；、,.!?;]*/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([，。！？；、,.!?;])\s*/g, "$1")
    .replace(/^[，。！？；、,.!?;]+/, "")
    .replace(/[，,]{2,}/g, "，")
    .trim();
}

export function formatMomentTime(timestamp, now = Date.now()) {
  const time = Number(timestamp) || now;
  const diff = Math.max(0, Number(now) - time);
  if (diff < 60_000) return "刚刚";
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}分钟前`;

  const date = new Date(time);
  const current = new Date(now);
  const sameDay = date.toDateString() === current.toDateString();
  const timeText = date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (sameDay) return timeText;

  const yesterday = new Date(current);
  yesterday.setDate(current.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `昨天 ${timeText}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${timeText}`;
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
