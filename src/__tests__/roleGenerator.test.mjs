import assert from "node:assert/strict";
import test from "node:test";
import { parseGeneratedRole } from "../lib/roleGenerator.js";

test("parses generated role JSON from markdown and Chinese field names", () => {
  const parsed = parseGeneratedRole(`好的，角色如下：
\`\`\`json
{
  "姓名": "沈棠",
  "性别": "女",
  "身份": "旧书店店主",
  "性格": "温柔但有边界感",
  "容貌": "黑色长发，常穿米白色针织衫。",
  "关联世界观": "",
  "人设": "她经营一家只在雨天营业的旧书店。"
}
\`\`\``);

  assert.deepEqual(parsed, {
    name: "沈棠",
    gender: "女",
    identity: "旧书店店主",
    personality: "温柔但有边界感",
    appearance: "黑色长发，常穿米白色针织衫。",
    worldview: "",
    persona: "她经营一家只在雨天营业的旧书店。",
  });
});

test("throws when generated content has no usable role fields", () => {
  assert.throws(
    () => parseGeneratedRole("我需要更多信息才能生成角色。"),
    /没有解析到角色字段/,
  );
});
