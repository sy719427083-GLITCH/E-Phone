import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

test("wires the moments clear callback through the micro chat shell", () => {
  const microChatProps = appSource.match(/function MicroChatApp\(\{([\s\S]*?)\}\) \{/);
  assert.ok(microChatProps, "MicroChatApp props should be discoverable");
  assert.match(microChatProps[1], /\bonClearMoments\b/);

  const momentsRender = appSource.match(/<MicroChatMoments[\s\S]*?generating=\{generatingMoments\}[\s\S]*?\/>/);
  assert.ok(momentsRender, "MicroChatMoments render should be discoverable");
  assert.match(momentsRender[0], /onClearMoments=\{onClearMoments\}/);

  const appRender = appSource.match(/<MicroChatApp[\s\S]*?generatingMoments=\{generatingMoments\}[\s\S]*?\/>/);
  assert.ok(appRender, "MicroChatApp render should be discoverable");
  assert.match(appRender[0], /onClearMoments=\{/);
});

test("asks for confirmation before clearing moments", () => {
  assert.match(appSource, /确认清空朋友圈/);
  assert.match(appSource, /setClearConfirmOpen\(true\)/);
});
