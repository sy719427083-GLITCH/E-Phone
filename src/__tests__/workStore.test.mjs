import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage } from "../lib/roleStore.js";
import { WalletStore } from "../lib/walletStore.js";
import { getJobRemainingMs, WorkStore } from "../lib/workStore.js";

const morning = new Date("2026-06-23T09:00:00+08:00");

test("creates five real work options with free refresh allowance", () => {
  const store = new WorkStore(createMemoryStorage(), () => morning);
  const day = store.snapshot();

  assert.equal(day.jobs.length, 5);
  assert.equal(day.freeRefreshesLeft, 3);
  assert.equal(day.nextRefreshCost, 0);
  assert.equal(day.worldEra, "modern");
  assert.ok(day.jobs.every((job) => job.status === "idle"));
  assert.ok(day.jobs.every((job) => ["offline", "online"].includes(job.workMode)));
  assert.ok(day.jobs.every((job) => job.description.length > 10));
  assert.ok(day.jobs.some((job) => job.workMode === "offline"));
  assert.ok(day.jobs.some((job) => job.workMode === "online"));
  assert.doesNotMatch(day.jobs.map((job) => job.title).join(","), /日记|世界观|虚拟|云端|壁纸|论坛/);
});

test("refreshes five jobs without a hard limit and charges after three free refreshes", () => {
  const store = new WorkStore(createMemoryStorage(), () => morning);
  const wallet = new WalletStore(createMemoryStorage());
  const firstTitles = store.snapshot().jobs.map((job) => job.title).join(",");

  store.refreshJobs();
  store.refreshJobs();
  const refreshed = store.refreshJobs();

  assert.equal(refreshed.freeRefreshesLeft, 0);
  assert.equal(refreshed.nextRefreshCost, 10);
  assert.equal(refreshed.jobs.length, 5);
  assert.notEqual(refreshed.jobs.map((job) => job.title).join(","), firstTitles);

  wallet.payWorkRefresh({ amount: refreshed.nextRefreshCost, messageId: "refresh-4" });
  const paidRefresh = store.refreshJobs();

  assert.equal(paidRefresh.refreshIndex, 4);
  assert.equal(wallet.snapshot().balance, 1990);
  assert.equal(wallet.snapshot().bills[0].title, "工作刷新");
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

test("automatically refreshes a new set of five jobs after claiming pay", () => {
  const store = new WorkStore(createMemoryStorage(), () => morning);
  const before = store.snapshot();
  const job = before.jobs[0];
  const start = morning.getTime();

  store.startJob(job.id, start);
  const claimed = store.claimJob(job.id, start + job.durationMinutes * 60_000);
  const after = store.snapshot();

  assert.equal(claimed.id, job.id);
  assert.equal(after.jobs.length, 5);
  assert.equal(after.freeRefreshesLeft, 3);
  assert.equal(after.nextRefreshCost, 0);
  assert.ok(after.jobs.every((item) => item.status === "idle"));
  assert.notEqual(after.jobs.map((item) => item.title).join(","), before.jobs.map((item) => item.title).join(","));
});

test("selects ancient offline work when a world book era is available", () => {
  const store = new WorkStore(createMemoryStorage(), () => morning, () => ({ era: "ancient" }));
  const day = store.snapshot();

  assert.equal(day.worldEra, "ancient");
  assert.equal(day.jobs.length, 5);
  assert.ok(day.jobs.every((job) => job.era === "ancient"));
  assert.ok(day.jobs.every((job) => ["offline", "online"].includes(job.workMode)));
});

test("migrates old online jobs into the offline work pool", () => {
  const storage = createMemoryStorage();
  storage.setItem("ephone.work", JSON.stringify({
    day: {
      dateKey: "2026-06-23",
      refreshIndex: 0,
      jobs: [{
        id: "old",
        title: "日记云端归档",
        place: "私人云笔记",
        durationMinutes: 22,
        pay: 60,
        description: "按日期整理日记草稿。",
        status: "running",
        startedAt: morning.getTime(),
      }],
    },
  }));

  const store = new WorkStore(storage, () => morning);
  const day = store.snapshot();

  assert.equal(day.jobs.length, 5);
  assert.ok(day.jobs.every((job) => job.status === "idle"));
  assert.doesNotMatch(day.jobs.map((job) => job.title).join(","), /日记|世界观|虚拟|云端|壁纸|论坛/);
});
