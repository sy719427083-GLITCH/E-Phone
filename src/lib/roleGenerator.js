const FIELD_ALIASES = {
  name: ["name", "姓名", "名字", "角色名"],
  gender: ["gender", "性别"],
  identity: ["identity", "身份", "职业"],
  personality: ["personality", "性格"],
  appearance: ["appearance", "容貌", "外貌", "外观"],
  worldview: ["worldview", "关联世界观", "世界观"],
  persona: ["persona", "人设", "角色设定", "设定"],
};

function pickField(source, aliases) {
  for (const key of aliases) {
    const value = source?.[key];
    if (typeof value === "string") return value.trim();
  }
  return "";
}

function extractJsonCandidates(text) {
  const value = String(text || "");
  const fenced = [...value.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((match) => match[1]);
  const braced = value.match(/\{[\s\S]*\}/)?.[0];
  return [...fenced, braced, value].filter(Boolean);
}

function parseJsonObject(text) {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") return null;
    return parsed.role || parsed.character || parsed.data || parsed;
  } catch {
    return null;
  }
}

export function parseGeneratedRole(text) {
  for (const candidate of extractJsonCandidates(text)) {
    const parsed = parseJsonObject(candidate);
    if (!parsed) continue;

    const role = Object.fromEntries(
      Object.entries(FIELD_ALIASES).map(([field, aliases]) => [field, pickField(parsed, aliases)]),
    );
    if (Object.values(role).some(Boolean)) return role;
  }

  throw new Error("没有解析到角色字段，请重新生成一次。");
}
