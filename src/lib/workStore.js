export const WORK_STORAGE_KEY = "ephone.work";
export const WORK_REFRESH_FREE_COUNT = 3;
export const WORK_REFRESH_COST = 10;

const MODERN_WORK_TEMPLATES = [
  { title: "便利店晚班", place: "街角便利店", durationMinutes: 18, pay: 52, description: "整理货架、补齐饮料和关东煮签子，临近下班前再核对一次收银小票。", era: "modern", workMode: "offline" },
  { title: "奶茶店帮工", place: "粉桃奶茶店", durationMinutes: 15, pay: 45, description: "擦台面、贴杯标、给外卖袋打包封口，忙完这一轮就能结今天的小费。", era: "modern", workMode: "offline" },
  { title: "书店临时店员", place: "巷口书店", durationMinutes: 22, pay: 60, description: "把新到的漫画和杂志上架，给预约客人找书，再整理收银台旁的小票。", era: "modern", workMode: "offline" },
  { title: "宠物店看护", place: "暖灯宠物店", durationMinutes: 25, pay: 72, description: "给寄养区换水、补粮、记录小动物状态，离店前把用品柜重新摆整齐。", era: "modern", workMode: "offline" },
  { title: "咖啡店早班", place: "白瓷咖啡馆", durationMinutes: 20, pay: 58, description: "磨豆、擦杯、补纸巾和糖包，帮店员把第一批外带订单交给骑手。", era: "modern", workMode: "offline" },
  { title: "花店整理", place: "雨后花店", durationMinutes: 16, pay: 48, description: "修剪花枝、换掉蔫叶，把预订花束按姓名摆在冷柜前排。", era: "modern", workMode: "offline" },
  { title: "网店客服", place: "线上客服台", durationMinutes: 14, pay: 42, description: "回复售前咨询、核对订单尺码和地址，把需要人工处理的问题标给店主。", era: "modern", workMode: "online" },
  { title: "问卷录入", place: "线上调研组", durationMinutes: 12, pay: 36, description: "把回收问卷录入表格，检查漏填项和重复手机号，完成后提交给负责人。", era: "modern", workMode: "online" },
  { title: "远程排课助理", place: "线上教务间", durationMinutes: 19, pay: 54, description: "确认老师空档、整理学生请假记录，把今晚的课程表发给教务群。", era: "modern", workMode: "online" },
  { title: "二手平台上架", place: "线上小店", durationMinutes: 17, pay: 46, description: "整理商品标题、价格和瑕疵说明，按要求把几件闲置物品重新上架。", era: "modern", workMode: "online" },
];

const ANCIENT_WORK_TEMPLATES = [
  { title: "茶肆跑堂", place: "临街茶肆", durationMinutes: 18, pay: 50, description: "添茶、送点心、收拾桌面，把客人落下的小铜钱交到账房。", era: "ancient", workMode: "offline" },
  { title: "绣坊帮工", place: "南桥绣坊", durationMinutes: 24, pay: 68, description: "分线、裁布、整理绣架，把急单用的花样提前送到绣娘手边。", era: "ancient", workMode: "offline" },
  { title: "药铺学徒", place: "青石药铺", durationMinutes: 20, pay: 56, description: "按方抓药、包纸绳、清点药柜，临走前把算盘旁的账签归好。", era: "ancient", workMode: "offline" },
  { title: "客栈杂役", place: "柳巷客栈", durationMinutes: 26, pay: 76, description: "换热水、铺被褥、擦木梯，帮掌柜把晚到客人的房牌提前备好。", era: "ancient", workMode: "offline" },
  { title: "码头搬货", place: "东门码头", durationMinutes: 30, pay: 88, description: "搬米袋、点货签、看守一小段货船卸货，完工后找管事结银。", era: "ancient", workMode: "offline" },
  { title: "灯市摊位", place: "月桥灯市", durationMinutes: 17, pay: 52, description: "挂灯笼、找零钱、补纸签，帮摊主守完一轮热闹的客流。", era: "ancient", workMode: "offline" },
  { title: "抄书短工", place: "远信书铺", durationMinutes: 16, pay: 48, description: "照着底稿誊抄短札，核对错字和落款，完工后把纸页交给掌柜。", era: "ancient", workMode: "online" },
  { title: "账房核签", place: "云笺账房", durationMinutes: 14, pay: 44, description: "隔着传书核对几张账签，把缺章和错数的地方圈出来送回账房。", era: "ancient", workMode: "online" },
  { title: "飞鸽回帖", place: "驿信小铺", durationMinutes: 12, pay: 38, description: "按客人留言写回帖、分拣信笺，把急件和普通件分别装袋。", era: "ancient", workMode: "online" },
  { title: "货单誊录", place: "商队文案处", durationMinutes: 19, pay: 58, description: "誊录布匹和茶叶货单，按管事要求把数目和目的地整理清楚。", era: "ancient", workMode: "online" },
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

export function resolveWorkEra(worldBook = null) {
  const value = typeof worldBook === "string" ? worldBook : worldBook?.era || worldBook?.timePeriod || worldBook?.period || "";
  const normalized = String(value).toLowerCase();
  if (/(古代|古风|仙侠|武侠|朝代|ancient|xianxia|wuxia|dynasty)/i.test(normalized)) return "ancient";
  return "modern";
}

function getTemplatesForEra(era) {
  return era === "ancient" ? ANCIENT_WORK_TEMPLATES : MODERN_WORK_TEMPLATES;
}

function isLegacyOnlineJob(job = {}) {
  const text = `${job.title || ""} ${job.place || ""} ${job.description || ""}`;
  return !["offline", "online"].includes(job.workMode) || /日记|世界观|虚拟|云端|壁纸|论坛/.test(text);
}

function getRefreshCost(refreshIndex = 0) {
  return refreshIndex < WORK_REFRESH_FREE_COUNT ? 0 : WORK_REFRESH_COST;
}

const WORK_OPTION_COUNT = 5;

function pickJobs(dateKey, refreshIndex = 0, era = "modern", count = WORK_OPTION_COUNT) {
  const templates = getTemplatesForEra(era);
  const base = Array.from(`${dateKey}-${era}`).reduce((sum, char) => sum + char.charCodeAt(0), 0) + refreshIndex * 5;
  return Array.from({ length: count }, (_, offset) => {
    const template = templates[(base + offset * 3) % templates.length];
    return {
      id: makeWorkId("work-job"),
      title: template.title,
      place: template.place,
      durationMinutes: template.durationMinutes,
      pay: template.pay,
      description: template.description,
      era: template.era,
      workMode: template.workMode || "offline",
      status: "idle",
      startedAt: 0,
      claimedAt: 0,
    };
  });
}

function createWorkDay(now = new Date(), era = "modern") {
  const dateKey = getTodayKey(now);
  return {
    dateKey,
    refreshIndex: 0,
    generationIndex: 0,
    worldEra: era,
    jobs: pickJobs(dateKey, 0, era),
  };
}

function mergeJob(job = {}, era = "modern") {
  const fallback = pickJobs(getTodayKey(), 0, era)[0];
  return {
    id: job.id || makeWorkId("work-job"),
    title: job.title || fallback.title,
    place: job.place || fallback.place,
    durationMinutes: Math.max(1, Number(job.durationMinutes) || fallback.durationMinutes),
    pay: Math.max(1, Number(job.pay) || fallback.pay),
    description: job.description || fallback.description,
    era: job.era || era,
    workMode: ["offline", "online"].includes(job.workMode) ? job.workMode : fallback.workMode,
    status: ["idle", "running", "claimed"].includes(job.status) ? job.status : "idle",
    startedAt: Number(job.startedAt) || 0,
    claimedAt: Number(job.claimedAt) || 0,
  };
}

function mergeWorkDay(day = {}, now = new Date(), era = "modern") {
  const dateKey = day.dateKey || getTodayKey(now);
  const refreshIndex = Math.max(0, Number(day.refreshIndex) || 0);
  const generationIndex = Math.max(0, Number(day.generationIndex ?? day.refreshIndex) || 0);
  const worldEra = day.worldEra || era;
  const incomingJobs = Array.isArray(day.jobs) ? day.jobs.slice(0, WORK_OPTION_COUNT) : [];
  const hasLegacyJobs = incomingJobs.some(isLegacyOnlineJob);
  const jobs = incomingJobs.length === WORK_OPTION_COUNT && !hasLegacyJobs
    ? incomingJobs.map((job) => mergeJob(job, worldEra)).slice(0, WORK_OPTION_COUNT)
    : pickJobs(dateKey, generationIndex, worldEra);
  return {
    dateKey,
    refreshIndex,
    generationIndex,
    worldEra,
    jobs: jobs.length === WORK_OPTION_COUNT ? jobs : pickJobs(dateKey, generationIndex, worldEra),
  };
}

function decorateSnapshot(day) {
  const freeRefreshesLeft = Math.max(0, WORK_REFRESH_FREE_COUNT - day.refreshIndex);
  return {
    ...day,
    freeRefreshesLeft,
    nextRefreshCost: getRefreshCost(day.refreshIndex),
    jobs: day.jobs.map((job) => ({ ...job })),
  };
}

export function getJobRemainingMs(job, now = Date.now()) {
  if (!job || job.status !== "running" || !job.startedAt) return 0;
  const durationMs = Math.max(1, Number(job.durationMinutes) || 1) * 60_000;
  return Math.max(0, Number(job.startedAt) + durationMs - Number(now));
}

export class WorkStore {
  constructor(storage = globalThis.localStorage, nowProvider = () => new Date(), worldBookProvider = () => null) {
    this.storage = storage;
    this.nowProvider = nowProvider;
    this.worldBookProvider = worldBookProvider;
    this.day = createWorkDay(this.nowProvider(), this.currentEra());
    this.load();
  }

  currentEra() {
    return resolveWorkEra(this.worldBookProvider?.());
  }

  load() {
    const todayKey = getTodayKey(this.nowProvider());
    const era = this.currentEra();
    try {
      const parsed = JSON.parse(this.storage?.getItem(WORK_STORAGE_KEY) || "{}");
      this.day = mergeWorkDay(parsed.day, this.nowProvider(), era);
      if (this.day.dateKey !== todayKey || this.day.worldEra !== era) {
        this.day = createWorkDay(this.nowProvider(), era);
      }
    } catch {
      this.day = createWorkDay(this.nowProvider(), era);
    }
    this.persist();
  }

  persist() {
    this.storage?.setItem(WORK_STORAGE_KEY, JSON.stringify({ day: this.day }));
  }

  snapshot() {
    this.load();
    return decorateSnapshot(this.day);
  }

  refreshJobs() {
    this.load();
    if (this.day.jobs.some((job) => job.status === "running")) {
      throw new Error("当前已有工作进行中，完成后才能刷新。");
    }
    const nextIndex = this.day.refreshIndex + 1;
    const nextGenerationIndex = this.day.generationIndex + 1;
    this.day = {
      ...this.day,
      refreshIndex: nextIndex,
      generationIndex: nextGenerationIndex,
      jobs: pickJobs(this.day.dateKey, nextGenerationIndex, this.day.worldEra),
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
    const nextGenerationIndex = this.day.generationIndex + 1;
    this.day = {
      ...this.day,
      generationIndex: nextGenerationIndex,
      jobs: pickJobs(this.day.dateKey, nextGenerationIndex, this.day.worldEra),
    };
    this.persist();
    return { ...job };
  }
}
