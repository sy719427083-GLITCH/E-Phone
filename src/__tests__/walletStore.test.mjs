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

test("does not add money when a red packet is returned", () => {
  const store = new WalletStore(createMemoryStorage());

  store.returnRedPacket({ from: "陆清晏", amount: 66, messageId: "msg-return" });

  assert.equal(store.snapshot().balance, 2000);
  assert.deepEqual(store.snapshot().bills, []);
});
