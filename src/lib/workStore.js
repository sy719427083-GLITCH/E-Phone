export const WORK_STORAGE_KEY = "ephone.work";

const WORK_TEMPLATES = [
  { title: "整理虚拟档案", place: "线上资料室", durationMinutes: 12, pay: 36, description: "把散落的角色资料按姓名、身份和标签重新归档，完成后系统会结算基础整理费。" },
  { title: "奶茶店远程排班", place: "粉桃茶铺", durationMinutes: 18, pay: 48, description: "核对今日班表和备货备注，标出时间冲突，让晚班安排看起来不再乱糟糟。" },
  { title: "便利店库存录入", place: "夜间便利站", durationMinutes: 25, pay: 66, description: "录入零食、饮料和日用品库存，把缺货项整理成一份简短补货清单。" },
  { title: "论坛内容校对", place: "微聊编辑部", durationMinutes: 15, pay: 42, description: "检查帖子标题、错字和重复内容，保留有用信息，删掉多余的格式痕迹。" },
  { title: "壁纸素材标注", place: "美化工坊", durationMinutes: 20, pay: 55, description: "给壁纸素材标注颜色、风格和用途，方便之后快速找到合适的画面。" },
  { title: "世界观条目整理", place: "设定资料库", durationMinutes: 30, pay: 82, description: "把地点、组织和重要设定整理成条目，避免以后剧情设定互相打架。" },
  { title: "订单备注核对", place: "外卖小站", durationMinutes: 16, pay: 45, description: "核对订单备注和配送时间，把容易漏看的要求单独标出来。" },
  { title: "日记云端归档", place: "私人云笔记", durationMinutes: 22, pay: 60, description: "按日期整理日记草稿，给没有标题的记录补上简短摘要。" },
];

function makeWorkId(prefix = "work") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getTodayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function pickJobs(dateKey, refreshIndex = 0) {
  const base = Array.from(dateKey).reduce((sum, char) => sum + char.charCodeAt(0), 0) + refreshIndex * 7;
  return [0, 1, 2].map((offset) => {
    const template = WORK_TEMPLATES[(base + offset * 3) % WORK_TEMPLATES.length];
    return {
      id: makeWorkId("work-job"),
      title: template.title,
      place: template.place,
      durationMinutes: template.durationMinutes,
      pay: template.pay,
      description: template.description,
      status: "idle",
      startedAt: 0,
      claimedAt: 0,
    };
  });
}

function createWorkDay(now = new Date()) {
  const dateKey = getTodayKey(now);
  return {
    dateKey,
    refreshesLeft: 3,
    refreshIndex: 0,
    jobs: pickJobs(dateKey, 0),
  };
}

function mergeJob(job = {}) {
  return {
    id: job.id || makeWorkId("work-job"),
    title: job.title || "临时工作",
    place: job.place || "线上",
    durationMinutes: Math.max(1, Number(job.durationMinutes) || 10),
    pay: Math.max(1, Number(job.pay) || 20),
    description: job.description || "完成这份线上工作后，工资会自动进入钱包账单。",
    status: ["idle", "running", "claimed"].includes(job.status) ? job.status : "idle",
    startedAt: Number(job.startedAt) || 0,
    claimedAt: Number(job.claimedAt) || 0,
  };
}

function mergeWorkDay(day = {}, now = new Date()) {
  const dateKey = day.dateKey || getTodayKey(now);
  const jobs = Array.isArray(day.jobs) ? day.jobs.map(mergeJob).slice(0, 3) : pickJobs(dateKey, 0);
  return {
    dateKey,
    refreshesLeft: Math.max(0, Math.min(3, Number(day.refreshesLeft ?? 3))),
    refreshIndex: Math.max(0, Number(day.refreshIndex) || 0),
    jobs: jobs.length === 3 ? jobs : pickJobs(dateKey, 0),
  };
}

export function getJobRemainingMs(job, now = Date.now()) {
  if (!job || job.status !== "running" || !job.startedAt) return 0;
  const durationMs = Math.max(1, Number(job.durationMinutes) || 1) * 60_000;
  return Math.max(0, Number(job.startedAt) + durationMs - Number(now));
}

export class WorkStore {
  constructor(storage = globalThis.localStorage, nowProvider = () => new Date()) {
    this.storage = storage;
    this.nowProvider = nowProvider;
    this.day = createWorkDay(this.nowProvider());
    this.load();
  }

  load() {
    try {
      const parsed = JSON.parse(this.storage?.getItem(WORK_STORAGE_KEY) || "{}");
      const todayKey = getTodayKey(this.nowProvider());
      this.day = mergeWorkDay(parsed.day, this.nowProvider());
      if (this.day.dateKey !== todayKey) this.day = createWorkDay(this.nowProvider());
    } catch {
      this.day = createWorkDay(this.nowProvider());
    }
    this.persist();
  }

  persist() {
    this.storage?.setItem(WORK_STORAGE_KEY, JSON.stringify({ day: this.day }));
  }

  snapshot() {
    this.load();
    return {
      ...this.day,
      jobs: this.day.jobs.map((job) => ({ ...job })),
    };
  }

  refreshJobs() {
    this.load();
    if (this.day.refreshesLeft <= 0) throw new Error("今天的刷新次数用完了。");
    if (this.day.jobs.some((job) => job.status !== "idle")) {
      throw new Error("已有工作开始后，今天不能再刷新。");
    }
    const nextIndex = this.day.refreshIndex + 1;
    this.day = {
      ...this.day,
      refreshesLeft: this.day.refreshesLeft - 1,
      refreshIndex: nextIndex,
      jobs: pickJobs(this.day.dateKey, nextIndex),
    };
    this.persist();
    return this.snapshot();
  }

  startJob(jobId, now = Date.now()) {
    this.load();
    if (this.day.jobs.some((job) => job.status === "running")) {
      throw new Error("当前已经有一份工作进行中。");
    }
    const job = this.day.jobs.find((item) => item.id === jobId);
    if (!job) throw new Error("工作不存在。");
    if (job.status !== "idle") throw new Error("这份工作不能重复开始。");
    job.status = "running";
    job.startedAt = Number(now) || Date.now();
    this.persist();
    return { ...job };
  }

  claimJob(jobId, now = Date.now()) {
    this.load();
    const job = this.day.jobs.find((item) => item.id === jobId);
    if (!job) throw new Error("工作不存在。");
    if (job.status === "claimed") throw new Error("这份工资已经领取过了。");
    if (job.status !== "running") throw new Error("请先开始这份工作。");
    if (getJobRemainingMs(job, now) > 0) throw new Error("工作还没完成。");
    job.status = "claimed";
    job.claimedAt = Number(now) || Date.now();
    this.persist();
    return { ...job };
  }
}
