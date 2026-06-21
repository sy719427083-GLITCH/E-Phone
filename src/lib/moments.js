function normalizeMomentCount(count) {
  return Math.max(1, Math.min(9, Number(count) || 1));
}

export function getMomentMaxTokens(count) {
  return Math.min(480, 120 + normalizeMomentCount(count) * 60);
}

export function buildMomentsPrompt({ contacts = [], mode = "random", selectedRoleId = "", count = 1 } = {}) {
  const limit = normalizeMomentCount(count);
  const selected = selectedRoleId
    ? contacts.filter((contact) => contact.id === selectedRoleId)
    : contacts.slice(0, 8);
  const roster = (selected.length > 0 ? selected : contacts.slice(0, 8));
  const roleLines = roster.map((contact) => (
    `${contact.name || "未命名"}:${contact.identity || "身份未填"};${contact.personality || "性格未填"}`
  )).join("|");

  return [
    "为中文角色朋友圈生成动态。只返回 JSON 数组，不要 Markdown。",
    `条数:${limit};模式:${mode === "specified" ? "指定" : "随机"}`,
    '格式:[{"authorName":"角色名","content":"朋友圈正文"}]',
    "正文每条1句，生活化，有角色感。",
    `角色:${roleLines || "暂无"}`,
  ].join("\n");
}

export function parseMomentPosts(raw, contacts = []) {
  const text = String(raw || "").trim();
  const jsonText = text.match(/```json\s*([\s\S]*?)```/)?.[1] || text.match(/```\s*([\s\S]*?)```/)?.[1] || text;
  try {
    const parsed = JSON.parse(jsonText);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items.map((item) => ({
      authorName: String(item.authorName || item.name || "").trim(),
      content: String(item.content || item.text || "").trim(),
    })).filter((item) => item.authorName && item.content);
  } catch {
    return text.split(/\n+/).map((line, index) => {
      const contact = contacts[index % Math.max(contacts.length, 1)] || {};
      return {
        authorName: contact.name || "角色",
        content: line.replace(/^[-*\d.\s]+/, "").trim(),
      };
    }).filter((item) => item.content);
  }
}
