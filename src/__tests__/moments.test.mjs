import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMomentContext,
  buildMomentsPrompt,
  buildTinyMomentPrompt,
  getMomentMaxTokens,
  parseMomentPosts,
  pickMomentAuthor,
  pickMomentAuthors,
  shouldGenerateSpontaneousMoment,
} from "../lib/moments.js";

test("uses a compact token budget for moments generation", () => {
  assert.equal(getMomentMaxTokens(1, "text"), 60);
  assert.equal(getMomentMaxTokens(3, "text"), 140);
  assert.equal(getMomentMaxTokens(3, "image_text"), 240);
  assert.equal(getMomentMaxTokens(9, "image_text"), 320);
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
    count: 1,
    context: "昨天聊到天台和钢琴。",
    nowText: "6月21日 17:30",
  });

  assert.match(prompt, /只回一句朋友圈正文/);
  assert.doesNotMatch(prompt, /JSON/);
  assert.match(prompt, /纯文字/);
  assert.match(prompt, /陆斯年/);
  assert.match(prompt, /聊天内容|今天|现在/);
  assert.match(prompt, /昨天聊到天台和钢琴/);
  assert.doesNotMatch(prompt, /沈棠/);
  assert.ok(prompt.length < 360);
});

test("builds a multi-post text prompt when more than one moment is requested", () => {
  const prompt = buildMomentsPrompt({
    contacts: [
      { id: "a", name: "陆斯年", identity: "学生会干部", personality: "外冷内热" },
      { id: "b", name: "沈棠", identity: "旧书店店主", personality: "温柔" },
    ],
    mode: "random",
    postType: "text",
    count: 3,
    nowText: "6月21日 20:30",
  });

  assert.match(prompt, /只返回 JSON 数组/);
  assert.match(prompt, /条数:3/);
  assert.match(prompt, /1-100字/);
  assert.match(prompt, /纯文字/);
  assert.match(prompt, /陆斯年/);
  assert.match(prompt, /沈棠/);
  assert.match(prompt, /可以像角色自发发布/);
});

test("builds an ultra tiny fallback prompt for text moments", () => {
  const prompt = buildTinyMomentPrompt({
    author: { name: "陆斯年", identity: "学生会干部", personality: "外冷内热" },
    context: "我:今天去天台了吗？ | 陆斯年:去了，风很轻。",
    nowText: "6月21日 18:00",
  });

  assert.match(prompt, /1-100字/);
  assert.match(prompt, /陆斯年/);
  assert.ok(prompt.length < 120);
});

test("picks a moment author from roles without using my profile", () => {
  const author = pickMomentAuthor({
    contacts: [
      { id: "me", name: "我" },
      { id: "a", name: "陆斯年" },
    ],
    selectedRoleId: "",
    myProfile: { id: "me", name: "我" },
    random: () => 0,
  });

  assert.equal(author.name, "陆斯年");
});

test("picks multiple moment authors from added roles without my profile", () => {
  const authors = pickMomentAuthors({
    contacts: [
      { id: "me", name: "我" },
      { id: "a", name: "陆斯年" },
      { id: "b", name: "沈棠" },
    ],
    count: 3,
    myProfile: { id: "me", name: "我" },
  });

  assert.deepEqual(authors.map((author) => author.name), ["陆斯年", "沈棠", "陆斯年"]);

  const capped = pickMomentAuthors({
    contacts: [{ id: "a", name: "陆斯年" }],
    count: 9,
  });

  assert.equal(capped.length, 5);
});

test("decides when a role may spontaneously post a moment", () => {
  assert.equal(shouldGenerateSpontaneousMoment({
    contacts: [{ id: "a" }],
    lastGeneratedAt: 1_000,
    now: 80_000,
    random: () => 0.2,
  }), true);
  assert.equal(shouldGenerateSpontaneousMoment({
    contacts: [{ id: "a" }],
    lastGeneratedAt: 78_000,
    now: 80_000,
    random: () => 0.2,
  }), false);
  assert.equal(shouldGenerateSpontaneousMoment({
    contacts: [],
    lastGeneratedAt: 1_000,
    now: 80_000,
    random: () => 0,
  }), false);
});

test("builds moment context from role conversation", () => {
  const context = buildMomentContext({
    author: { id: "a" },
    conversations: [{
      roleId: "a",
      messages: [
        { role: "user", content: "今天去天台了吗？" },
        { role: "assistant", content: "去了，风很轻。" },
      ],
    }],
  });

  assert.match(context, /今天去天台/);
  assert.match(context, /风很轻/);
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

  const longText = "很".repeat(120);
  const capped = parseMomentPosts(`[{"authorName":"陆斯年","content":"${longText}"}]`, []);
  assert.equal(capped[0].content.length, 100);
});
