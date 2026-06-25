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

test("renders a real wallet app instead of the placeholder pane", () => {
  assert.match(appSource, /function WalletApp\(/);
  assert.match(appSource, /我的余额/);
  assert.match(appSource, /我的账单/);
  assert.match(appSource, /appPage\?\.key === "wallet"/);
  assert.match(appSource, /<WalletApp wallet=\{wallet\} \/>/);
  assert.match(appSource, /还没有账单/);
  assert.match(appSource, /walletStore\.receiveRedPacket/);
  assert.match(appSource, /walletStore\.receiveTransfer/);
  assert.match(appSource, /parseAssistantReplyEvents/);
  assert.match(appSource, /walletStore\.sendRedPacket/);
  assert.match(appSource, /walletStore\.refundSentRedPacket/);
  assert.match(appSource, /onAcceptRedPacket/);
  assert.match(appSource, /onReturnRedPacket/);
  assert.match(appSource, /accepted_by_role/);
  assert.match(appSource, /redPacketAcceptedReplies/);
  assert.match(appSource, /getChatReplyDelayMs/);
  assert.match(appSource, /微信转账/);
  assert.match(appSource, /chat-input-area/);
  assert.match(appSource, /chat-more-panel/);
  assert.match(appSource, /chat-red-packet-modal/);
  assert.match(appSource, /pendingPacket/);
  assert.match(appSource, /packet-open-dialog/);
  assert.match(appSource, /RedPacketLineIcon/);
  assert.match(appSource, /LocationLineIcon/);
  assert.match(appSource, /ImageLineIcon/);
  assert.doesNotMatch(appSource, /拍一拍功能稍后开放/);
  assert.doesNotMatch(appSource, /领取了你的红包/);
});

test("wires a real work app to the home screen and wallet", () => {
  assert.match(appSource, /key: "work", label: "工作"/);
  assert.match(appSource, /assets\/app-icons\/work\.png/);
  assert.match(appSource, /function WorkApp\(/);
  assert.match(appSource, /appPage\?\.key === "work"/);
  assert.match(appSource, /workStore\.refreshJobs/);
  assert.match(appSource, /workStore\.startJob/);
  assert.match(appSource, /workStore\.claimJob/);
  assert.match(appSource, /walletStore\.receiveWorkPay/);
  assert.match(appSource, /work-progress-cat\.png/);
  assert.match(appSource, /job.description/);
  assert.match(appSource, /工作目录/);
  assert.doesNotMatch(appSource, /5 个备选/);
  assert.doesNotMatch(appSource, /可选线上或线下/);
});
