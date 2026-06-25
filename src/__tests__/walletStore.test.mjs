import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage } from "../lib/roleStore.js";
import { WalletStore } from "../lib/walletStore.js";

test("starts wallet with a real initial balance and no bills", () => {
  const store = new WalletStore(createMemoryStorage());

  assert.equal(store.snapshot().balance, 2000);
  assert.deepEqual(store.snapshot().bills, []);
});

test("receives and sends red packets through wallet bills", () => {
  const storage = createMemoryStorage();
  const store = new WalletStore(storage);

  store.receiveRedPacket({ from: "陆清晏", amount: 18.88, messageId: "msg-in" });
  assert.equal(store.snapshot().balance, 2018.88);
  assert.equal(store.snapshot().bills[0].title, "收到红包");
  assert.equal(store.snapshot().bills[0].amount, 18.88);

  store.sendRedPacket({ to: "陆清晏", amount: 20, messageId: "msg-out" });
  assert.equal(store.snapshot().balance, 1998.88);
  assert.equal(store.snapshot().bills[0].title, "发出红包");
  assert.equal(store.snapshot().bills[0].amount, -20);
});

test("receives role transfers through wallet bills", () => {
  const store = new WalletStore(createMemoryStorage());

  store.receiveTransfer({ from: "陆清晏", amount: 52, messageId: "msg-transfer" });

  assert.equal(store.snapshot().balance, 2052);
  assert.equal(store.snapshot().bills[0].title, "收到转账");
  assert.equal(store.snapshot().bills[0].amount, 52);
});

test("receives work pay through wallet bills", () => {
  const store = new WalletStore(createMemoryStorage());

  store.receiveWorkPay({ job: "便利店晚班", amount: 36, messageId: "work-1" });

  assert.equal(store.snapshot().balance, 2036);
  assert.equal(store.snapshot().bills[0].title, "打工收入");
  assert.equal(store.snapshot().bills[0].note, "便利店晚班");
});

test("pays for work refreshes from wallet balance", () => {
  const store = new WalletStore(createMemoryStorage());

  store.payWorkRefresh({ amount: 10, messageId: "work-refresh-1" });

  const snapshot = store.snapshot();
  assert.equal(snapshot.balance, 1990);
  assert.equal(snapshot.bills[0].title, "工作刷新");
  assert.equal(snapshot.bills[0].amount, -10);
});

test("does not add money when a red packet is returned", () => {
  const store = new WalletStore(createMemoryStorage());

  store.returnRedPacket({ from: "陆清晏", amount: 66, messageId: "msg-return" });

  assert.equal(store.snapshot().balance, 2000);
  assert.deepEqual(store.snapshot().bills, []);
});

test("refunds my sent red packet when the role returns it", () => {
  const store = new WalletStore(createMemoryStorage());

  store.sendRedPacket({ to: "陆清晏", amount: 30, messageId: "msg-out" });
  assert.equal(store.snapshot().balance, 1970);

  store.refundSentRedPacket({ from: "陆清晏", amount: 30, messageId: "msg-out" });
  const snapshot = store.snapshot();

  assert.equal(snapshot.balance, 2000);
  assert.equal(snapshot.bills[0].title, "红包退回");
  assert.equal(snapshot.bills[0].amount, 30);
});

test("clears wallet bills without changing the balance", () => {
  const store = new WalletStore(createMemoryStorage());

  store.receiveRedPacket({ from: "陆清晏", amount: 18, messageId: "msg-in" });
  assert.equal(store.snapshot().balance, 2018);

  store.clearBills();
  const snapshot = store.snapshot();

  assert.equal(snapshot.balance, 2018);
  assert.deepEqual(snapshot.bills, []);
});

test("manually adjusts wallet balance and records transparent wallet bills", () => {
  const store = new WalletStore(createMemoryStorage());

  store.adjustBalance({ amount: 120, note: "手动调整", messageId: "manual-add" });
  assert.equal(store.snapshot().balance, 2120);
  assert.equal(store.snapshot().bills[0].title, "手动增加余额");
  assert.equal(store.snapshot().bills[0].amount, 120);

  store.adjustBalance({ amount: -20, note: "手动调整", messageId: "manual-subtract" });
  const snapshot = store.snapshot();

  assert.equal(snapshot.balance, 2100);
  assert.equal(snapshot.bills[0].title, "手动减少余额");
  assert.equal(snapshot.bills[0].amount, -20);
});
