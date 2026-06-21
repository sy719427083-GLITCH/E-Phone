import assert from "node:assert/strict";
import test from "node:test";
import { buildMomentsPrompt, getMomentMaxTokens, parseMomentPosts } from "../lib/moments.js";

test("uses a compact token budget for moments generation", () => {
  assert.equal(getMomentMaxTokens(1, "text"), 110);
  assert.equal(getMomentMaxTokens(3, "text"), 170);
  assert.equal(getMomentMaxTokens(3, "image_text"), 240);
  assert.equal(getMomentMaxTokens(9, "image_text"), 420);
});

test("builds a compact moments prompt from added contacts", () => {
  const prompt = buildMomentsPrompt({
    contacts: [
      { id: "a", name: "陆斯年", identity: "学生会干部", personality: "外冷内热" },
      { id: "b", name: "沈棠", identity: "旧书店店主", personality: "温柔" },
    ],
    mode: "specified",
    postType: "text",
    selectedRoleId: "a",
    count: 3,
  });

  assert.match(prompt, /只返回 JSON 数组/);
  assert.match(prompt, /纯文字/);
  assert.match(prompt, /陆斯年/);
  assert.doesNotMatch(prompt, /沈棠/);
  assert.ok(prompt.length < 260);
});

test("builds an image text moments prompt", () => {
  const prompt = buildMomentsPrompt({
    contacts: [{ id: "a", name: "陆斯年", identity: "学生会干部", personality: "外冷内热" }],
    postType: "image_text",
    count: 1,
  });

  assert.match(prompt, /图文/);
});

test("parses generated moments from json or plain text", () => {
  const fromJson = parseMomentPosts('[{"authorName":"陆斯年","content":"今天风很轻。"}]', []);
  assert.deepEqual(fromJson, [{ authorName: "陆斯年", content: "今天风很轻。" }]);

  const fromText = parseMomentPosts("今天风很轻。", [{ name: "沈棠" }]);
  assert.deepEqual(fromText, [{ authorName: "沈棠", content: "今天风很轻。" }]);
});
