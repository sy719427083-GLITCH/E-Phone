import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage } from "../lib/roleStore.js";
import { WalletStore } from "../lib/walletStore.js";
import { getJobRemainingMs, WorkStore } from "../lib/workStore.js";

const morning = new Date("2026-06-23T09:00:00+08:00");

test("creates three daily jobs with three refresh chances", () => {
  const store = new WorkStore(createMemoryStorage(), () => morning);
  const day = store.snapshot();

  assert.equal(day.jobs.length, 3);
  assert.equal(day.refreshesLeft, 3);
  assert.ok(day.jobs.every((job) => job.status === "idle"));
});

test("refreshes jobs up to three times before any job starts", () => {
  const store = new WorkStore(createMemoryStorage(), () => morning);
  const firstTitles = store.snapshot().jobs.map((job) => job.title).join(",");

  store.refreshJobs();
  store.refreshJobs();
  const refreshed = store.refreshJobs();

  assert.equal(refreshed.refreshesLeft, 0);
  assert.notEqual(refreshed.jobs.map((job) => job.title).join(","), firstTitles);
  assert.throws(() => store.refreshJobs(), /刷新次数/);
});

test("uses real elapsed time before a work job can be claimed", () => {
  const store = new WorkStore(createMemoryStorage(), () => morning);
  const job = store.snapshot().jobs[0];
  const start = morning.getTime();

  const started = store.startJob(job.id, start);
  assert.equal(started.status, "running");
  assert.ok(getJobRemainingMs(started, start + 1000) > 0);
  assert.throws(() => store.claimJob(job.id, start + 1000), /还没完成/);

  const claimed = store.claimJob(job.id, start + job.durationMinutes * 60_000);
  assert.equal(claimed.status, "claimed");
});

test("deposits claimed work pay into the wallet", () => {
  const wallet = new WalletStore(createMemoryStorage());
  const store = new WorkStore(createMemoryStorage(), () => morning);
  const job = store.snapshot().jobs[0];
  const start = morning.getTime();

  store.startJob(job.id, start);
  const claimed = store.claimJob(job.id, start + job.durationMinutes * 60_000);
  wallet.receiveWorkPay({ job: claimed.title, amount: claimed.pay, messageId: `work-${claimed.id}` });

  const snapshot = wallet.snapshot();
  assert.equal(snapshot.balance, 2000 + claimed.pay);
  assert.equal(snapshot.bills[0].title, "打工收入");
  assert.equal(snapshot.bills[0].note, claimed.title);
});
