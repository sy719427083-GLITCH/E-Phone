import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiConfigStore,
  callWithRetryAndFallback,
  DEFAULT_CONFIG,
  describeApiUsage,
  fetchModelList,
  isQuotaOrRateLimitError,
  requestChatCompletion,
  resolveApiSelection,
} from "./lib/apiStore.js";
import {
  ChatStore,
  createChatMessage,
  createProactiveChatMessage,
  isPromptLeakReply,
  parseAssistantReplyEvents,
  parseAssistantReplies,
} from "./lib/chatStore.js";
import { createIdentityDraft, IdentityStore } from "./lib/identityStore.js";
import {
  buildMomentContext,
  buildMomentsPrompt,
  buildTinyMomentPrompt,
  cleanMomentContent,
  formatMyMomentReplyText,
  formatMomentReplyText,
  formatMomentTime,
  getDefaultMomentCount,
  getMomentMaxTokens,
  getMomentReplyDelayMs,
  getMomentRequestDelayMs,
  normalizeMomentPostType,
  parseMomentPosts,
  pickMomentAuthor,
  pickMomentAuthors,
  shouldKeepPartialMomentResults,
  shouldGenerateSpontaneousMoment,
} from "./lib/moments.js";
import { parseGeneratedRole } from "./lib/roleGenerator.js";
import { createRoleDraft, RoleStore } from "./lib/roleStore.js";
import { APP_VERSION } from "./lib/appVersion.js";
import { WalletStore } from "./lib/walletStore.js";
import { getJobRemainingMs, WorkStore } from "./lib/workStore.js";

const assetPath = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function isStandalonePwa() {
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)")?.matches
      || window.navigator?.standalone,
  );
}

function describeAppRuntime() {
  return `版本:${APP_VERSION}，运行:${isStandalonePwa() ? "桌面PWA" : "浏览器"}`;
}

function withMomentDiagnostics(error, requestLabel = "朋友圈") {
  const message = error?.message || "请检查 API 设置。";
  const requestInfo = message.includes("请求:") ? "" : `；请求:${requestLabel}`;
  const runtimeInfo = message.includes("版本:") ? "" : `；${describeAppRuntime()}`;
  return `${message}${requestInfo}${runtimeInfo}`;
}

function withApiDiagnostics(error, config, requestLabel = "朋友圈") {
  const message = error?.message || "生成失败";
  const apiInfo = message.includes("配置:") ? "" : `；${describeApiUsage(config)}`;
  const requestInfo = message.includes("请求:") ? "" : `；请求:${requestLabel}`;
  const runtimeInfo = message.includes("版本:") ? "" : `；${describeAppRuntime()}`;
  return `${message}${apiInfo}${requestInfo}${runtimeInfo}`;
}

function MomentReplyText({ authorName, replyToName, content, myName = "我" }) {
  const isMine = (authorName || "我") === myName || (authorName || "") === "我";
  const text = isMine
    ? formatMyMomentReplyText(replyToName || "角色", content)
    : formatMomentReplyText(authorName || "角色", content);
  const colonIndex = text.indexOf("：");
  const beforeColon = colonIndex >= 0 ? text.slice(0, colonIndex) : text;
  const afterColon = colonIndex >= 0 ? text.slice(colonIndex + 1) : "";
  const nameMatch = isMine
    ? beforeColon.match(/^我回复了(.+)$/)
    : beforeColon.match(/^(.+)回复了我$/);

  if (!nameMatch) return text;

  return isMine ? [
    <span key="me">我</span>,
    "回复了",
    <span key="target">{nameMatch[1]}</span>,
    `：${afterColon}`,
  ] : [
    <span key="author">{nameMatch[1]}</span>,
    "回复了",
    <span key="me">我</span>,
    `：${afterColon}`,
  ];
}

const appItems = [
  { key: "chat", label: "微聊", icon: assetPath("assets/app-icons/chat.png") },
  { key: "forum", label: "论坛", icon: assetPath("assets/app-icons/forum.png") },
  { key: "rednote", label: "小红书", icon: assetPath("assets/app-icons/rednote.png") },
  { key: "wallet", label: "钱包", icon: assetPath("assets/app-icons/wallet.png") },
  { key: "game", label: "游戏", icon: assetPath("assets/app-icons/game.png") },
  { key: "beauty", label: "美化", icon: assetPath("assets/app-icons/beauty.png") },
  { key: "world", label: "世界观", icon: assetPath("assets/app-icons/world.png") },
  { key: "preset", label: "预设", icon: assetPath("assets/app-icons/preset.png") },
  { key: "food", label: "外卖", icon: assetPath("assets/app-icons/food.png") },
  { key: "outing", label: "外出", icon: assetPath("assets/app-icons/outing.png") },
  { key: "diary", label: "日记", icon: assetPath("assets/app-icons/diary.png") },
  { key: "couple", label: "情侣空间", icon: assetPath("assets/app-icons/couple.png") },
  { key: "work", label: "工作", icon: assetPath("assets/app-icons/work.png") },
];

const settingsItems = [
  ["api", "API设置", "接口、模型、测试", assetPath("assets/settings-icons/api.png")],
  ["sound", "声音设置", "音色、提示音、静音", assetPath("assets/settings-icons/sound.png")],
  ["image", "画面生图", "画面模型与质量", assetPath("assets/settings-icons/image.png")],
  ["appearance", "外观设置", "壁纸、屏保、图标", assetPath("assets/settings-icons/appearance.png")],
  ["time", "时间设置", "日期与剧情时间", assetPath("assets/settings-icons/time.png")],
  ["notice", "通知开关", "消息与提醒", assetPath("assets/settings-icons/notice.png")],
  ["data", "数据管理", "导入、备份、清理", assetPath("assets/settings-icons/data.png")],
  ["system", "系统设置", "PWA与缓存", assetPath("assets/settings-icons/system.png")],
];

const tabItems = [
  { key: "home", label: "主页", icon: "home" },
  { key: "roles", label: "角色档案", icon: "roles" },
  { key: "me", label: "身份", icon: "profile" },
  { key: "settings", label: "设置", icon: "sliders" },
];

function Icon({ name }) {
  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.5 11.2 12 5l7.5 6.2v7.3a1.5 1.5 0 0 1-1.5 1.5h-3.5v-5h-5v5H6a1.5 1.5 0 0 1-1.5-1.5z" />
      </svg>
    );
  }
  if (name === "roles") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.8 14.2 9l5.4 1.3-4.1 3.6.4 5.6L12 16.6l-3.9 2.9.4-5.6-4.1-3.6L9.8 9z" />
      </svg>
    );
  }
  if (name === "profile") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 11.4a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4z" />
        <path d="M5.8 19.5c.7-3.6 2.9-5.4 6.2-5.4s5.5 1.8 6.2 5.4" />
      </svg>
    );
  }
  if (name === "sliders") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.2 8h7.2" />
        <path d="M16.3 8h2.5" />
        <path d="M14.4 6.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z" />
        <path d="M5.2 16h2.5" />
        <path d="M11.6 16h7.2" />
        <path d="M9.6 14.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.6 4h2.8l.7 2.2 2.1.9 2.1-1.1 2 2-1.1 2.1.9 2.1 2.2.7v2.8l-2.2.7-.9 2.1 1.1 2.1-2 2-2.1-1.1-2.1.9-.7 2.2h-2.8l-.7-2.2-2.1-.9-2.1 1.1-2-2 1.1-2.1-.9-2.1-2.2-.7v-2.8l2.2-.7.9-2.1L3.7 8l2-2 2.1 1.1 2.1-.9z" />
      <path d="M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z" />
    </svg>
  );
}

function nowParts() {
  const date = new Date();
  const day = date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  const weekday = date.toLocaleDateString("zh-CN", { weekday: "long" });
  return {
    time: date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }),
    date: `${day} ${weekday}`,
  };
}

function useClock() {
  const [clock, setClock] = useState(nowParts);

  useEffect(() => {
    const timer = setInterval(() => setClock(nowParts()), 1000);
    return () => clearInterval(timer);
  }, []);

  return clock;
}

function LockScreen({ onUnlock }) {
  const clock = useClock();

  return (
    <section className="screen lock-screen" onWheel={onUnlock}>
      <div className="lock-time">
        <p>{clock.date}</p>
        <strong>{clock.time}</strong>
      </div>
      <button className="unlock-handle" onClick={onUnlock} aria-label="点击解锁">
        <span />
        <small>点击解锁</small>
      </button>
    </section>
  );
}

function HomeScreen({ clock, openApp }) {
  return (
    <section className="page home-page">
      <div className="home-widget" aria-label="主页小组件">
        <div className="widget-clock">
          <b>{clock.time}</b>
          <span>{clock.date}</span>
        </div>
      </div>
      <div className="home-grid" aria-label="主页应用">
        {appItems.map((item) => (
          <button
            className="app-hit"
            key={item.key}
            onClick={() => openApp(item)}
          >
            <img src={item.icon} alt="" draggable="false" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SimplePane({ title }) {
  return (
    <section className="page soft-page">
      <Header title={title} />
      <div className="empty-state">
        <div className="mini-mark" />
        <h2>{title}</h2>
        <p>这里会承载对应的 AI 聊天扮演功能页面。</p>
      </div>
    </section>
  );
}

function formatMoney(amount) {
  const value = Math.abs(Number(amount) || 0);
  return `${amount < 0 ? "-" : "+"}¥${value.toFixed(2)}`;
}

function WalletApp({ wallet }) {
  const bills = wallet?.bills || [];
  const balance = Number(wallet?.balance ?? 2000);
  const income = bills
    .filter((bill) => bill.amount > 0)
    .reduce((total, bill) => total + bill.amount, 0);
  const expense = bills
    .filter((bill) => bill.amount < 0)
    .reduce((total, bill) => total + Math.abs(bill.amount), 0);

  return (
    <section className="page soft-page wallet-page">
      <Header title="钱包" />
      <div className="wallet-balance-card">
        <span>我的余额</span>
        <strong>¥{balance.toFixed(2)}</strong>
        <div>
          <small>本月收入 ¥{income.toFixed(2)}</small>
          <small>本月支出 ¥{expense.toFixed(2)}</small>
        </div>
      </div>
      <section className="wallet-bills">
        <div className="wallet-section-title">
          <b>我的账单</b>
          <span>{bills.length} 笔</span>
        </div>
        {bills.length === 0 ? (
          <div className="wallet-empty-bills">还没有账单</div>
        ) : (
          <div className="wallet-bill-list">
            {bills.map((bill) => (
            <article className="wallet-bill-row" key={bill.id}>
              <span className={`wallet-bill-icon ${bill.type}`}>
                {bill.amount > 0 ? "入" : "支"}
              </span>
              <div>
                <b>{bill.title}</b>
                <small>{bill.note} · {bill.time}</small>
              </div>
              <strong className={bill.amount > 0 ? "income" : "expense"}>
                {formatMoney(bill.amount)}
              </strong>
            </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function formatWorkDuration(minutes) {
  const value = Math.max(1, Number(minutes) || 1);
  return value >= 60 ? `${Math.floor(value / 60)}小时${value % 60 ? `${value % 60}分钟` : ""}` : `${value}分钟`;
}

function formatRemaining(ms) {
  const totalSeconds = Math.ceil(Math.max(0, Number(ms) || 0) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function WorkApp({ workDay, onRefreshJobs, onStartJob, onClaimJob, message }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const runningJob = workDay.jobs.find((job) => job.status === "running") || null;

  return (
    <section className="page soft-page work-page">
      <Header title="工作" />
      <section className="work-summary">
        <span>今日工作</span>
        <strong>3 个任务</strong>
        <small>刷新机会 {workDay.refreshesLeft}/3</small>
      </section>
      <div className="work-actions">
        <button
          type="button"
          onClick={onRefreshJobs}
          disabled={workDay.refreshesLeft <= 0 || workDay.jobs.some((job) => job.status !== "idle")}
        >
          刷新工作
        </button>
        <span>{runningJob ? `进行中：${runningJob.title}` : "按现实时间完成后领取工资"}</span>
      </div>
      {message ? <p className="work-message">{message}</p> : null}
      <div className="work-list">
        {workDay.jobs.map((job) => {
          const remaining = getJobRemainingMs(job, now);
          const durationMs = Math.max(1, Number(job.durationMinutes) || 1) * 60_000;
          const elapsedMs = job.status === "running" ? durationMs - remaining : job.status === "claimed" ? durationMs : 0;
          const progress = Math.max(0, Math.min(1, elapsedMs / durationMs));
          const catY = 15 - Math.sin(progress * Math.PI) * 14;
          const progressPercent = `${progress * 100}%`;
          const canClaim = job.status === "running" && remaining <= 0;
          return (
            <article
              className={`work-card ${job.status}`}
              key={job.id}
              style={{ "--work-progress-percent": progressPercent, "--work-cat-y": `${catY}px` }}
            >
              <div className="work-card-head">
                <div>
                  <span>{job.place}</span>
                  <b>{job.title}</b>
                  <small>{formatWorkDuration(job.durationMinutes)} · ¥{job.pay.toFixed(2)}</small>
                </div>
                {job.status === "idle" ? (
                  <button type="button" onClick={() => onStartJob(job.id)}>
                    开始打工
                  </button>
                ) : null}
                {job.status === "running" ? (
                  <button type="button" onClick={() => onClaimJob(job.id)} disabled={!canClaim}>
                    {canClaim ? "领取工资" : formatRemaining(remaining)}
                  </button>
                ) : null}
                {job.status === "claimed" ? <em>已入账</em> : null}
              </div>
              <p>{job.description}</p>
              <div className="work-progress" aria-label={`工作进度 ${Math.round(progress * 100)}%`}>
                <svg viewBox="0 0 240 42" aria-hidden="true">
                  <path className="work-progress-track" d="M8 28 C54 2 92 42 132 21 S198 11 232 25" pathLength="100" />
                  <path
                    className="work-progress-fill"
                    d="M8 28 C54 2 92 42 132 21 S198 11 232 25"
                    pathLength="100"
                    style={{ strokeDasharray: `${progress * 100} 100` }}
                  />
                </svg>
                <img src={assetPath("assets/work-progress-cat.png")} alt="" draggable="false" />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function formatChatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function getChatReplyDelayMs(index) {
  return 850 + Math.min(1100, index * 260) + Math.floor(Math.random() * 520);
}

const redPacketAcceptedReplies = [
  "收到了。",
  "谢谢。",
  "我先收下。",
  "看到了，已收。",
];

const redPacketReturnedReplies = [
  "不用了，你留着。",
  "这次先不收。",
  "心意到了。",
  "先退给你。",
];

function pickShortReply(items) {
  return items[Math.floor(Math.random() * items.length)] || items[0] || "嗯。";
}

function buildRoleReplyPrompt(conversation, userText) {
  const role = conversation.roleSnapshot || {};
  const user = conversation.userSnapshot || {};
  const recentMessages = conversation.messages
    .filter((message) => message.role === "user" || !isPromptLeakReply(message.content))
    .slice(-8)
    .map((message) => (
      `${message.role === "user" ? user.name || "用户" : role.name || "角色"}：${message.content}`
    )).join("\n");

  return [
    "你正在一个中文角色扮演手机聊天软件里回复用户。只输出角色发出的聊天消息，不要解释，不要 Markdown。",
    `角色姓名：${role.name || conversation.title || "未命名角色"}`,
    `性别：${role.gender || "未填写"}`,
    `身份：${role.identity || "未填写"}`,
    `性格：${role.personality || "未填写"}`,
    `容貌：${role.appearance || "未填写"}`,
    `世界观：${role.worldview || "暂无"}`,
    `人设：${role.persona || "未填写"}`,
    `用户姓名：${user.name || "我"}`,
    `用户性别：${user.gender || "未填写"}`,
    `用户身份：${user.identity || "未填写"}`,
    `用户性格：${user.personality || "未填写"}`,
    `用户人设：${user.persona || "未填写"}`,
    "回复要求：像真实线上手机聊天一样自然；你和用户不在同一个现实空间，永远只通过手机屏幕聊天；输出1-3条，每条单独一行，短一点，像连续聊天气泡；一句完整短话不要硬拆开。",
    "每条只写气泡正文，绝对不要在正文前加角色名、昵称、冒号或“角色：”。",
    "禁止输出 JSON、数组、引号、改写说明、分析、提示词、格式说明或 Markdown。",
    "不要写动作、手势、姿势、舞台指令或括号描写，不要旁白。",
    "禁止任何线下/见面情节：不要写见面、碰面、当面、坐下、一起喝茶吃饭、来找我、我去找你、靠近、抬手、递给、看着、低头、拿出、放到你手里等同处一地的场景。只能写隔着屏幕能发生的文字聊天、转账、红包、位置分享或图片。",
    "任何转账、打钱、给钱、发钱、补偿、还钱、借钱、付款行为，都必须由系统转账卡片表达；普通文字里绝对不要说“我给你转了/发了/打了多少钱”。如果需要转账，只输出一句包含金额的简短意图，系统会自动转成转账卡片。",
    recentMessages ? `最近聊天：\n${recentMessages}` : "",
    `用户新消息：${userText}`,
  ].filter(Boolean).join("\n");
}

function buildMomentReplyPrompt(post, commentText) {
  return [
    "你正在中文朋友圈评论区回复用户。只输出角色回复内容，不要解释，不要 Markdown。",
    `发朋友圈的人：${post.authorName || "角色"}`,
    `朋友圈内容：${post.content || ""}`,
    `用户评论：${commentText}`,
    "要求：像真实朋友圈评论区回复，1-40字，自然、有角色感；不要像私聊对话，不要问候式聊天，不要动作、手势、姿势或括号描写。",
  ].join("\n");
}

function MicroChatApp({
  roles,
  contacts,
  contactRequests,
  myProfile,
  momentPosts,
  conversations,
  selectedChatId,
  onBack,
  onStartChat,
  onAddContact,
  onRecordContactRequest,
  onOpenChat,
  onDeleteChat,
  onCloseChat,
  onSendMessage,
  onSendRedPacket,
  onAcceptRedPacket,
  onReturnRedPacket,
  onGenerateMoments,
  onToggleMomentLike,
  onAddMomentComment,
  onClearMoments,
  onProactiveChatEvent,
  sendingChatId,
  generatingMoments,
}) {
  const [chatTab, setChatTab] = useState("chats");
  const [contactPage, setContactPage] = useState(null);
  const lastSpontaneousMomentAt = useRef(0);
  const generateMomentsRef = useRef(onGenerateMoments);
  const generatingMomentsRef = useRef(generatingMoments);
  const momentPostsRef = useRef(momentPosts);
  const allowSpontaneousMoments = true;
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedChatId) || null;

  useEffect(() => {
    generateMomentsRef.current = onGenerateMoments;
  }, [onGenerateMoments]);

  useEffect(() => {
    generatingMomentsRef.current = generatingMoments;
  }, [generatingMoments]);

  useEffect(() => {
    momentPostsRef.current = momentPosts;
  }, [momentPosts]);

  useEffect(() => {
    if (conversations.length === 0) return undefined;
    let cancelled = false;
    const sendProactive = () => {
      if (cancelled || conversations.length === 0) return;
      if (Math.random() > 0.42) return;
      const index = Math.min(conversations.length - 1, Math.floor(Math.random() * conversations.length));
      const conversation = conversations[index];
      if (conversation?.id) onProactiveChatEvent(conversation.id, Math.random);
    };
    const firstTimer = window.setTimeout(sendProactive, 38_000);
    const interval = window.setInterval(sendProactive, 4 * 60_000);
    return () => {
      cancelled = true;
      window.clearTimeout(firstTimer);
      window.clearInterval(interval);
    };
  }, [conversations, onProactiveChatEvent]);

  useEffect(() => {
    if (contacts.length === 0) return undefined;
    let cancelled = false;

    const tryGenerate = () => {
      const now = Date.now();
      if (!shouldGenerateSpontaneousMoment({
        contacts,
        lastGeneratedAt: lastSpontaneousMomentAt.current,
        recentPostAt: momentPostsRef.current[0]?.createdAt || 0,
        now,
        isGenerating: generatingMomentsRef.current,
        allowSpontaneous: allowSpontaneousMoments,
      })) return;
      lastSpontaneousMomentAt.current = now;
      generateMomentsRef.current({
        mode: "spontaneous",
        postType: "text",
        selectedRoleId: "",
        count: 1,
        spontaneous: true,
      }).catch(() => {
        if (!cancelled) lastSpontaneousMomentAt.current = Date.now();
      });
    };

    const firstTimer = window.setTimeout(tryGenerate, 90_000);
    const interval = window.setInterval(tryGenerate, 5 * 60_000);
    return () => {
      cancelled = true;
      window.clearTimeout(firstTimer);
      window.clearInterval(interval);
    };
  }, [contacts, allowSpontaneousMoments]);

  if (selectedConversation) {
    return (
      <ChatThread
        conversation={selectedConversation}
        onBack={onCloseChat}
        onSend={(text) => onSendMessage(selectedConversation.id, text)}
        onSendRedPacket={(amount) => onSendRedPacket(selectedConversation.id, amount)}
        onAcceptRedPacket={(message) => onAcceptRedPacket(selectedConversation.id, message)}
        onReturnRedPacket={(message) => onReturnRedPacket(selectedConversation.id, message)}
        sending={sendingChatId === selectedConversation.id}
      />
    );
  }

  const tabTitles = {
    chats: "微聊",
    contacts: contactPage === "newFriends" ? "新的好友" : "通讯录",
    moments: "朋友圈",
    settings: "设置",
  };
  const showMicroTabs = !contactPage && chatTab !== "moments";
  const showMicroHeader = chatTab !== "moments";
  const headerBack = chatTab === "chats" ? onBack : null;

  return (
    <section className="page chat-page microchat-shell">
      {showMicroHeader ? <Header title={tabTitles[chatTab]} onBack={headerBack} /> : null}
      <div className="microchat-content">
        {chatTab === "chats" ? (
          <MicroChatList conversations={conversations} onOpenChat={onOpenChat} onDeleteChat={onDeleteChat} />
        ) : null}
        {chatTab === "contacts" ? (
          <MicroChatContacts
            roles={roles}
            contacts={contacts}
            requests={contactRequests}
            page={contactPage}
            onOpenNewFriends={() => setContactPage("newFriends")}
            onBackToContacts={() => setContactPage(null)}
            onStartChat={onStartChat}
            onAddContact={onAddContact}
            onRecordContactRequest={onRecordContactRequest}
          />
        ) : null}
        {chatTab === "moments" ? (
          <MicroChatMoments
            contacts={contacts}
            posts={momentPosts}
            myProfile={myProfile}
            onBack={() => setChatTab("chats")}
            onGenerate={onGenerateMoments}
            onToggleLike={onToggleMomentLike}
            onAddComment={onAddMomentComment}
            onClearMoments={onClearMoments}
            generating={generatingMoments}
          />
        ) : null}
        {chatTab === "settings" ? (
          <MicroChatSettings conversations={conversations} roles={roles} contacts={contacts} />
        ) : null}
      </div>
      {showMicroTabs ? <MicroChatTabs active={chatTab} setActive={(key) => {
        setContactPage(null);
        setChatTab(key);
      }} /> : null}
    </section>
  );
}

function MicroChatList({ conversations, onOpenChat, onDeleteChat }) {
  return (
    <div className="chat-list-shell">
      <div className="chat-search">搜索</div>
      <div className="chat-section-title">
        <b>聊天</b>
        <span>{conversations.length} 个会话</span>
      </div>
      <div className="chat-conversation-list">
        {conversations.length === 0 ? (
          <div className="chat-empty">
            <h2>还没有聊天</h2>
            <p>去通讯录添加角色后，就可以开始聊天。</p>
          </div>
        ) : (
          conversations.map((conversation) => {
            const lastMessage = conversation.messages.at(-1);
            return (
              <SwipeChatRow
                conversation={conversation}
                key={conversation.id}
                lastMessage={lastMessage}
                onOpen={() => onOpenChat(conversation.id)}
                onDelete={() => onDeleteChat(conversation.id)}
              />
            );
          })
        )}
      </div>

    </div>
  );
}

function SwipeChatRow({ conversation, lastMessage, onOpen, onDelete }) {
  const [open, setOpen] = useState(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const swiped = useRef(false);

  const onPointerDown = (event) => {
    startPoint.current = { x: event.clientX, y: event.clientY };
    swiped.current = false;
  };

  const onPointerUp = (event) => {
    const deltaX = event.clientX - startPoint.current.x;
    const deltaY = event.clientY - startPoint.current.y;
    if (Math.abs(deltaX) < 28 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    swiped.current = true;
    if (deltaX < -34) setOpen(true);
    if (deltaX > 34) setOpen(false);
  };

  const deleteChat = (event) => {
    event.stopPropagation();
    onDelete();
  };

  return (
    <div className={`chat-swipe ${open ? "is-open" : ""}`}>
      <button className="chat-delete-action" type="button" onClick={deleteChat}>删除</button>
      <button
        className="chat-row"
        type="button"
        onClick={() => {
          if (!swiped.current) onOpen();
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <ChatAvatar conversation={conversation} />
        <span className="chat-row-main">
          <b>{conversation.title}</b>
          <small>{lastMessage?.content || "还没有消息"}</small>
        </span>
        <span className="chat-row-side">
          <time>{formatChatTime(conversation.updatedAt)}</time>
          {conversation.unread ? <em>{conversation.unread}</em> : null}
        </span>
      </button>
    </div>
  );
}

function MicroChatContacts({
  roles,
  contacts,
  requests,
  page,
  onOpenNewFriends,
  onBackToContacts,
  onStartChat,
  onAddContact,
  onRecordContactRequest,
}) {
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingRoleId, setPendingRoleId] = useState("");
  const [incomingRole, setIncomingRole] = useState(null);
  const [incomingBusy, setIncomingBusy] = useState(false);
  const contactIds = new Set(contacts.map((contact) => contact.id));
  const availableRoles = roles.filter((role) => !contactIds.has(role.id));
  const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

  useEffect(() => {
    if (availableRoles.length === 0 || incomingRole) return undefined;
    const timer = window.setTimeout(() => {
      if (Math.random() < 0.42) {
        const role = availableRoles[Math.floor(Math.random() * availableRoles.length)];
        setIncomingRole(role || null);
        if (role) setMessage(`${role.name || "有角色"}想添加你为好友。`);
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [availableRoles.length, incomingRole]);

  const requestAdd = async (role) => {
    if (pendingRoleId) return;
    const roleKey = role.id || role.name || "pending-role";
    setPendingRoleId(roleKey);
    setMessage(`正在等待${role.name || "对方"}确认...`);
    try {
      await wait(350);
      const result = onAddContact(role);
      setMessage(result.accepted
        ? `${role.name || "角色"}已通过你的好友申请。`
        : result.reason || `${role.name || "角色"}拒绝了你的添加请求。`);
      if (result.accepted) setAdding(false);
    } catch (error) {
      setMessage(`添加失败：${error.message || "请稍后再试。"}`);
    } finally {
      setPendingRoleId("");
    }
  };

  const acceptIncoming = async () => {
    if (!incomingRole || incomingBusy) return;
    setIncomingBusy(true);
    setMessage(`正在通过${incomingRole.name || "对方"}的好友申请...`);
    try {
      await wait(350);
      onAddContact(incomingRole, () => 1);
      setMessage(`你已添加${incomingRole.name || "角色"}。`);
      setIncomingRole(null);
    } catch (error) {
      setMessage(`添加失败：${error.message || "请稍后再试。"}`);
    } finally {
      setIncomingBusy(false);
    }
  };

  const rejectIncoming = async () => {
    if (!incomingRole || incomingBusy) return;
    setIncomingBusy(true);
    setMessage(`正在处理${incomingRole.name || "对方"}的好友申请...`);
    try {
      await wait(350);
      onRecordContactRequest(incomingRole, { direction: "incoming", status: "rejected" });
      setMessage(`已拒绝${incomingRole.name || "角色"}的好友申请。`);
      setIncomingRole(null);
    } catch (error) {
      setMessage(`处理失败：${error.message || "请稍后再试。"}`);
    } finally {
      setIncomingBusy(false);
    }
  };

  if (page === "newFriends") {
    const history = [
      ...(incomingRole ? [{
        id: "incoming-now",
        roleName: incomingRole.name || "未命名角色",
        avatar: incomingRole.avatar,
        identity: incomingRole.identity,
        personality: incomingRole.personality,
        direction: "incoming",
        status: "pending",
      }] : []),
      ...requests,
    ];

    return (
      <div className="microchat-pane new-friends-page">
        <button className="back-button new-friends-back" onClick={onBackToContacts} aria-label="返回通讯录">
          ‹
        </button>
        <div className="chat-search">搜索</div>
        <div className="chat-conversation-list contact-list">
          {history.length === 0 ? (
            <div className="chat-empty compact">
              <h2>暂无新的好友</h2>
              <p>之前加过的角色会显示在这里。</p>
            </div>
          ) : (
            history.map((request) => (
              <div className="new-friend-row" key={request.id}>
                <ChatAvatar conversation={{ title: request.roleName || "角色", avatar: request.avatar }} />
                <span>
                  <b>{request.roleName || "未命名角色"}</b>
                  <small>{request.identity || request.personality || (request.direction === "incoming" ? "请求添加你为好友" : "好友申请")}</small>
                </span>
                {request.status === "pending" ? (
                  <>
                    <button onClick={rejectIncoming} disabled={incomingBusy}>拒绝</button>
                    <button onClick={acceptIncoming} disabled={incomingBusy}>通过</button>
                  </>
                ) : (
                  <em>{request.status === "accepted" ? "已添加" : "已拒绝"}</em>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="microchat-pane">
      <div className="contacts-head">
        <div className="chat-search">搜索联系人</div>
        <button className="contact-add-button" onClick={() => setAdding((value) => !value)} aria-label="添加联系人">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
      {message ? <p className="contact-request-message">{message}</p> : null}
      <div className="microchat-feature-list">
        <button className="microchat-feature-row" onClick={onOpenNewFriends}>
          <span>新</span>
          <b>新的好友</b>
          {incomingRole ? <em>1</em> : null}
        </button>
        <button className="microchat-feature-row">
          <span>群</span>
          <b>群聊</b>
        </button>
      </div>
      {adding ? (
        <div className="contact-add-panel">
          <div className="chat-section-title">
            <b>添加已有角色</b>
            <span>{availableRoles.length} 个可添加</span>
          </div>
          {availableRoles.length === 0 ? (
            <p>没有可添加的角色，或者角色已经在通讯录里。</p>
          ) : (
            availableRoles.map((role) => (
              <button className="chat-row" key={role.id} onClick={() => requestAdd(role)} disabled={Boolean(pendingRoleId)}>
                <ChatAvatar conversation={{ title: role.name || "角色", avatar: role.avatar }} />
                <span className="chat-row-main">
                  <b>{role.name || "未命名角色"}</b>
                  <small>{pendingRoleId === (role.id || role.name || "pending-role") ? "等待对方确认..." : role.identity || role.personality || "发送好友申请"}</small>
                </span>
                <span className="contact-apply">{pendingRoleId === (role.id || role.name || "pending-role") ? "等待" : "申请"}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
      <div className="chat-section-title">
        <b>通讯录</b>
        <span>{contacts.length} 个联系人</span>
      </div>
      <div className="chat-conversation-list contact-list">
        {contacts.length === 0 ? (
          <div className="chat-empty compact">
            <h2>还没有联系人</h2>
            <p>点击右上角添加按钮，向已有角色发送好友申请。</p>
          </div>
        ) : (
          contacts.map((contact) => {
            const role = roles.find((item) => item.id === contact.id) || contact;
            return (
            <button className="chat-row" key={contact.id} onClick={() => onStartChat(role)}>
              <ChatAvatar conversation={{ title: contact.name || "角色", avatar: contact.avatar }} />
              <span className="chat-row-main">
                <b>{contact.name || "未命名角色"}</b>
                <small>{contact.identity || contact.personality || "点击开始聊天"}</small>
              </span>
            </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function MicroChatMoments({
  contacts,
  posts,
  myProfile,
  onBack,
  onGenerate,
  onToggleLike,
  onAddComment,
  onClearMoments,
  generating,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState("random");
  const [postType, setPostType] = useState("text");
  const [count, setCount] = useState(getDefaultMomentCount);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [message, setMessage] = useState("");
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentTargets, setCommentTargets] = useState({});
  const [replyingPostId, setReplyingPostId] = useState("");
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  const generate = async () => {
    setMessage("正在生成动态...");
    try {
      const result = await onGenerate({ mode, postType, selectedRoleId, count });
      setMessage(result ? `已生成 ${result} 条动态。` : "没有生成到可用动态。");
      if (result) setMenuOpen(false);
    } catch (error) {
      setMessage(`生成失败：${withMomentDiagnostics(error)}`);
    }
  };

  return (
    <div className="moments-page">
      <button className="moments-back" onClick={onBack} aria-label="返回微聊">
        ‹
      </button>
      <button type="button" className="moments-action" onClick={() => setMenuOpen((value) => !value)} aria-label="朋友圈生成设置">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
      </button>
      <button
        type="button"
        className="moments-clear"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setClearConfirmOpen(true);
          setMenuOpen(false);
        }}
        aria-label="清空朋友圈"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.8 8.5v9M12 8.5v9M17.2 8.5v9M3.8 6.2h16.4M8.2 6.2l1-2h5.6l1 2M5.6 6.2l.8 14.3h11.2l.8-14.3" />
        </svg>
      </button>
      {clearConfirmOpen ? (
        <div className="moments-confirm" role="dialog" aria-label="确认清空朋友圈">
          <b>确认清空朋友圈？</b>
          <p>生成的朋友圈内容会被全部删除。</p>
          <div>
            <button type="button" onClick={() => setClearConfirmOpen(false)}>取消</button>
            <button
              type="button"
              onClick={() => {
                onClearMoments();
                setMessage("朋友圈已清空。");
                setMenuOpen(false);
                setClearConfirmOpen(false);
                setCommentDrafts({});
                setCommentTargets({});
              }}
            >
              确认清空
            </button>
          </div>
        </div>
      ) : null}
      {menuOpen ? (
        <div className="moments-menu">
          <b>生成动态</b>
          <label>
            <span>对象</span>
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="random">随机角色</option>
              <option value="specified">指定角色</option>
            </select>
          </label>
          <label>
            <span>类型</span>
            <select value={postType} onChange={(event) => setPostType(event.target.value)}>
              <option value="text">纯文字</option>
              <option value="image_text">图文</option>
            </select>
          </label>
          {mode === "specified" ? (
            <label>
              <span>指定</span>
              <select value={selectedRoleId} onChange={(event) => setSelectedRoleId(event.target.value)}>
                <option value="">选择已添加角色</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>{contact.name || "未命名角色"}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            <span>条数</span>
            <span className="moments-count-control">
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              />
              <output>{count}条</output>
            </span>
          </label>
          <button onClick={generate} disabled={generating || (mode === "specified" && !selectedRoleId)}>
            {generating ? "生成中..." : "生成动态"}
          </button>
        </div>
      ) : null}
      <div className="moments-cover">
        <div className="moments-my-card">
          <span className="moments-my-avatar">
            {myProfile?.avatar ? <img src={myProfile.avatar} alt="" /> : (myProfile?.name?.slice(0, 1) || "我")}
          </span>
          <b>{myProfile?.name || "我的头像"}</b>
        </div>
      </div>
      <div className="moments-blank">
        {message ? <p className="moments-message">{message}</p> : null}
        {posts.length === 0 ? null : posts.map((post) => (
          <article className="moment-post" key={post.id}>
            <ChatAvatar conversation={{ title: post.authorName, avatar: post.avatar }} />
            <div>
              <b>{post.authorName}</b>
              <p>{post.content}</p>
              {post.postType === "image_text" && post.image ? (
                <img className="moment-post-image" src={post.image} alt="" />
              ) : null}
              <div className="moment-actions">
                <small>{formatMomentTime(post.createdAt)}</small>
                <button
                  className={post.likes?.some((like) => like.id === (myProfile?.id || "me")) ? "is-liked" : ""}
                  type="button"
                  onClick={() => onToggleLike(post.id)}
                  aria-label="点赞"
                >
                  <svg className="moment-heart-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20.2s-6.8-4.1-8.7-8.1C1.8 8.8 3.5 5.7 6.7 5.4c1.8-.2 3.3.7 4.2 2.1.2.3.4.3.6 0 1-1.4 2.4-2.3 4.2-2.1 3.2.3 4.9 3.4 3.4 6.7-1.8 4-7.1 8.1-7.1 8.1Z" />
                  </svg>
                  {post.likes?.length ? <span>{post.likes.length}</span> : null}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCommentDrafts((current) => ({
                      ...current,
                      [post.id]: current[post.id] || "",
                    }));
                    setCommentTargets((current) => {
                      const next = { ...current };
                      delete next[post.id];
                      return next;
                    });
                  }}
                  aria-label="评论"
                >
                  <svg className="moment-comment-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5.2 6.8c1.5-1.4 3.8-2.2 6.8-2.2 5 0 8.2 2.6 8.2 6.4 0 3.9-3.3 6.5-8.1 6.5-.8 0-1.6-.1-2.3-.2L5 19.1c-.4.2-.8-.2-.6-.6l1.3-3.3C4.5 14.1 3.8 12.7 3.8 11c0-1.6.5-3 1.4-4.2Z" />
                  </svg>
                </button>
              </div>
              {post.likes?.length ? (
                <div className="moment-social-line">
                  <span>♥ </span>{post.likes.map((like) => like.name).join("、")}
                </div>
              ) : null}
              {post.comments?.length ? (
                <div className="moment-comments">
                  {post.comments.map((comment) => (
                    <div className="moment-comment" key={comment.id}>
                      <span>{comment.authorName}：</span>{comment.content}
                      {comment.replies?.map((reply) => (
                        <button
                          className="moment-reply"
                          key={reply.id}
                          type="button"
                          onClick={() => {
                            const targetName = reply.authorName || post.authorName || "角色";
                            setCommentDrafts((current) => ({ ...current, [post.id]: "" }));
                            setCommentTargets((current) => ({
                              ...current,
                              [post.id]: {
                                commentId: comment.id,
                                replyToName: targetName,
                              },
                            }));
                          }}
                        >
                          <MomentReplyText
                            authorName={reply.authorName}
                            replyToName={reply.replyToName}
                            content={reply.content}
                            myName={myProfile?.name || "我"}
                          />
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
              {Object.prototype.hasOwnProperty.call(commentDrafts, post.id) ? (
                <form
                  className="moment-comment-form"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const text = String(commentDrafts[post.id] || "").trim();
                    const target = commentTargets[post.id] || null;
                    if (!text || replyingPostId) return;
                    setReplyingPostId(post.id);
                    try {
                      await onAddComment(post, text, target);
                      setCommentDrafts((current) => {
                        const next = { ...current };
                        delete next[post.id];
                        return next;
                      });
                      setCommentTargets((current) => {
                        const next = { ...current };
                        delete next[post.id];
                        return next;
                      });
                    } catch (error) {
                      setMessage(`评论失败：${error.message || "请稍后再试。"}`);
                    } finally {
                      setReplyingPostId("");
                    }
                  }}
                >
                  <input
                    value={commentDrafts[post.id] || ""}
                    placeholder={commentTargets[post.id]?.replyToName ? `回复${commentTargets[post.id].replyToName}` : "评论"}
                    onChange={(event) => setCommentDrafts((current) => ({
                      ...current,
                      [post.id]: event.target.value,
                    }))}
                  />
                  <button type="submit" disabled={replyingPostId === post.id}>
                    {replyingPostId === post.id ? "发送中" : "发送"}
                  </button>
                </form>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function MicroChatSettings({ conversations, roles, contacts }) {
  return (
    <div className="microchat-pane">
      <div className="microchat-profile-card">
        <span>微</span>
        <div>
          <b>微聊</b>
          <p>{contacts.length} 个联系人 · {conversations.length} 个会话</p>
        </div>
      </div>
      <div className="microchat-settings-list">
        <div className="microchat-settings-row">
          <b>聊天记录</b>
          <span>本机保存</span>
        </div>
        <div className="microchat-settings-row">
          <b>角色回复</b>
          <span>使用 API 设置</span>
        </div>
        <div className="microchat-settings-row">
          <b>界面风格</b>
          <span>粉白玻璃</span>
        </div>
      </div>
    </div>
  );
}

function MicroChatTabs({ active, setActive }) {
  const items = [
    ["chats", "微聊", "chat"],
    ["contacts", "通讯录", "contacts"],
    ["moments", "朋友圈", "moments"],
    ["settings", "设置", "settings"],
  ];

  return (
    <nav className="microchat-tabs" aria-label="微聊导航">
      {items.map(([key, label, icon]) => (
        <button
          key={key}
          className={active === key ? "active" : ""}
          onClick={() => setActive(key)}
        >
          <span><MicroChatIcon name={icon} /></span>
          <b>{label}</b>
        </button>
      ))}
    </nav>
  );
}

function MicroChatIcon({ name }) {
  if (name === "chat") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5.5 6.5h13a2 2 0 0 1 2 2v6.2a2 2 0 0 1-2 2H12l-4.4 3v-3H5.5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z" />
        <path d="M8 10.5h8M8 13.5h5" />
      </svg>
    );
  }
  if (name === "contacts") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8.8 11.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
        <path d="M3.8 18.8c.5-3 2.4-4.8 5-4.8s4.5 1.8 5 4.8" />
        <path d="M16.5 7.2h4M18.5 5.2v4M16.5 14.5h4M16.5 17.5h4" />
      </svg>
    );
  }
  if (name === "moments") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="4" y="5" width="16" height="14" rx="3.2" />
        <path d="m7 15 3.2-3.3 2.5 2.4 2.1-2.2L18 15.2" />
        <circle cx="15.8" cy="9" r="1.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14M5 12h14M5 17h14" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="12" r="2" />
      <circle cx="10.8" cy="17" r="2" />
    </svg>
  );
}

function ChatAvatar({ conversation }) {
  return (
    <span className="chat-avatar">
      {conversation.avatar ? (
        <img src={conversation.avatar} alt="" />
      ) : (
        <span>{conversation.title?.slice(0, 1) || "聊"}</span>
      )}
    </span>
  );
}

function LocationIcon() {
  return (
    <svg className="message-location-icon" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 5.5c-8 0-14.5 6.4-14.5 14.2 0 10.4 14.5 22.8 14.5 22.8S38.5 30.1 38.5 19.7C38.5 11.9 32 5.5 24 5.5Z" />
      <circle cx="24" cy="19.8" r="5.1" />
    </svg>
  );
}

function RedPacketLineIcon() {
  return (
    <svg className="chat-more-svg" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="10" y="8" width="28" height="34" rx="4" />
      <path d="M10 17h28" />
      <path d="M18 25h12" />
      <path d="M24 20v15" />
    </svg>
  );
}

function LocationLineIcon() {
  return (
    <svg className="chat-more-svg" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 6c-8 0-14 6.1-14 13.7C10 30 24 42 24 42s14-12 14-22.3C38 12.1 32 6 24 6Z" />
      <circle cx="24" cy="19.8" r="4.5" />
    </svg>
  );
}

function ImageLineIcon() {
  return (
    <svg className="chat-more-svg" viewBox="0 0 48 48" aria-hidden="true">
      <rect x="8" y="11" width="32" height="26" rx="4" />
      <circle cx="18" cy="20" r="3" />
      <path d="M12 33l9-8 7 6 4-4 5 6" />
    </svg>
  );
}

function MessageBubble({ message, onOpenPendingPacket }) {
  if (message.type === "recall" || message.type === "pat") {
    return <span className={`message-system-chip ${message.type}`}>{message.content}</span>;
  }
  if (message.type === "red_packet" || message.type === "transfer") {
    const isTransfer = message.type === "transfer";
    const amount = Number(message.meta?.amount || 0);
    const packetStatus = message.meta?.status || (message.role === "user" ? "sent" : "pending");
    const canHandle = message.role !== "user" && packetStatus === "pending";
    const isHandled = ["received", "returned", "accepted_by_role", "returned_by_role"].includes(packetStatus);
    const statusText = {
      received: isTransfer ? `已收款 ¥${amount.toFixed(2)}` : `已领取 ¥${amount.toFixed(2)}`,
      returned: isTransfer ? "已退还" : "已退回",
      sent: `等待领取 ¥${amount.toFixed(2)}`,
      accepted_by_role: `已领取 ¥${amount.toFixed(2)}`,
      returned_by_role: `已退回 ¥${amount.toFixed(2)}`,
      pending: message.meta?.subtitle || (isTransfer ? "微信转账" : "微信红包"),
    }[packetStatus] || message.meta?.subtitle || (isTransfer ? "微信转账" : "微信红包");
    return (
      <button
        type="button"
        className={`message-card ${isTransfer ? "transfer-card" : "red-packet-card"} ${isHandled ? "is-handled" : ""} ${canHandle ? "can-open" : ""}`}
        onClick={() => {
          if (canHandle) onOpenPendingPacket?.(message);
        }}
      >
        <span className="red-packet-main">
          <span className="red-packet-icon">{isTransfer ? "¥" : "¥"}</span>
          <span>
            <b>{message.meta?.title || (isTransfer ? "转账给你" : "恭喜发财，大吉大利")}</b>
            <small>{statusText}</small>
          </span>
        </span>
        <span className="red-packet-footer">{isTransfer ? "微信转账" : "微信红包"}</span>
      </button>
    );
  }
  if (message.type === "red_packet_result") {
    return <span className="message-system-chip red-packet-result">{message.content}</span>;
  }
  if (message.type === "location") {
    return (
      <span className="message-card location-card">
        <span>
          <b>{message.meta?.title || "位置"}</b>
          <small>{message.meta?.subtitle || "对方分享了一个坐标"}</small>
        </span>
        <LocationIcon />
      </span>
    );
  }
  return (
    <span className={`message-bubble ${message.status === "failed" ? "failed" : ""}`}>
      {message.content}
    </span>
  );
}

function ChatThread({ conversation, onBack, onSend, onSendRedPacket, onAcceptRedPacket, onReturnRedPacket, sending }) {
  const [text, setText] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [redPacketOpen, setRedPacketOpen] = useState(false);
  const [pendingPacket, setPendingPacket] = useState(null);
  const [redPacketAmount, setRedPacketAmount] = useState("");
  const [redPacketMessage, setRedPacketMessage] = useState("");
  const visibleMessages = conversation.messages.filter((message) => (
    message.role === "user" || !isPromptLeakReply(message.content)
  ));

  const send = () => {
    const value = text.trim();
    if (!value || sending) return;
    setText("");
    onSend(value);
  };

  const sendRedPacket = () => {
    const amount = Number(redPacketAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setRedPacketMessage("请输入红包金额。");
      return;
    }
    try {
      onSendRedPacket(amount);
      setRedPacketAmount("");
      setRedPacketMessage("");
      setRedPacketOpen(false);
    } catch (error) {
      setRedPacketMessage(error.message || "红包发送失败。");
    }
  };

  return (
    <section className="page chat-page chat-thread-page">
      <Header title={conversation.title} onBack={onBack} />
      <div className="chat-thread">
        {visibleMessages.length === 0 ? (
          <div className="chat-day-tip">你们还没有聊天</div>
        ) : (
          visibleMessages.map((message) => (
            <div className={`message-row ${message.role === "user" ? "from-user" : "from-role"} message-type-${message.type || "text"}`} key={message.id}>
              {message.role !== "user" && !["recall", "pat", "red_packet_result"].includes(message.type) ? <ChatAvatar conversation={conversation} /> : null}
              <div className="message-stack">
                <MessageBubble
                  message={message}
                  onOpenPendingPacket={(item) => setPendingPacket(item)}
                />
                <small className="message-time">{formatChatTime(message.createdAt)}</small>
              </div>
            </div>
          ))
        )}
        {sending ? (
          <div className="message-row from-role">
            <ChatAvatar conversation={conversation} />
            <span className="message-bubble typing">正在输入...</span>
          </div>
        ) : null}
      </div>
      <div className={`chat-input-area ${moreOpen ? "open" : ""}`}>
        <div className="chat-composer">
          <input
            value={text}
            placeholder="发消息"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") send();
            }}
          />
          <button className="chat-send" onClick={send} disabled={!text.trim() || sending}>
            发送
          </button>
          <button
            aria-label="更多"
            className="chat-more-toggle"
            onClick={() => {
              setMoreOpen((value) => !value);
              setRedPacketMessage("");
            }}
          >
            <span aria-hidden="true" />
          </button>
        </div>
        {moreOpen ? (
          <div className="chat-more-panel">
            <button
              type="button"
              className="chat-more-item"
              onClick={() => {
                setRedPacketOpen(true);
                setMoreOpen(false);
                setRedPacketMessage("");
              }}
            >
              <span className="chat-more-icon"><RedPacketLineIcon /></span>
              <small>发红包</small>
            </button>
            <button type="button" className="chat-more-item" onClick={() => setRedPacketMessage("位置功能稍后开放。")}>
              <span className="chat-more-icon"><LocationLineIcon /></span>
              <small>位置</small>
            </button>
            <button type="button" className="chat-more-item" onClick={() => setRedPacketMessage("图片功能稍后开放。")}>
              <span className="chat-more-icon"><ImageLineIcon /></span>
              <small>图片</small>
            </button>
            {redPacketMessage ? <small className="chat-more-hint">{redPacketMessage}</small> : null}
          </div>
        ) : null}
      </div>
      {redPacketOpen ? (
        <div className="chat-red-packet-modal" role="dialog" aria-modal="true">
          <div className="chat-red-packet-dialog">
            <button
              type="button"
              className="chat-red-packet-close"
              aria-label="关闭红包弹窗"
              onClick={() => {
                setRedPacketOpen(false);
                setRedPacketMessage("");
              }}
            >
              ×
            </button>
            <b>发红包</b>
            <span>输入金额后发送给 {conversation.title}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={redPacketAmount}
              placeholder="¥ 0.00"
              onChange={(event) => setRedPacketAmount(event.target.value)}
            />
            <button type="button" onClick={sendRedPacket}>塞钱进红包</button>
            {redPacketMessage ? <small>{redPacketMessage}</small> : null}
          </div>
        </div>
      ) : null}
      {pendingPacket ? (
        <div className="chat-red-packet-modal" role="dialog" aria-modal="true">
          <div className={`packet-open-dialog ${pendingPacket.type === "transfer" ? "transfer" : ""}`}>
            <button
              type="button"
              className="chat-red-packet-close"
              aria-label="关闭红包弹窗"
              onClick={() => setPendingPacket(null)}
            >
              ×
            </button>
            <span className="packet-open-icon">¥</span>
            <b>{pendingPacket.type === "transfer" ? "微信转账" : "微信红包"}</b>
            <strong>¥{Number(pendingPacket.meta?.amount || 0).toFixed(2)}</strong>
            <small>{pendingPacket.meta?.subtitle || `${conversation.title}发来的${pendingPacket.type === "transfer" ? "转账" : "红包"}`}</small>
            <div className="packet-open-actions">
              <button
                type="button"
                onClick={() => {
                  onAcceptRedPacket(pendingPacket);
                  setPendingPacket(null);
                }}
              >
                {pendingPacket.type === "transfer" ? "收款" : "领取"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onReturnRedPacket(pendingPacket);
                  setPendingPacket(null);
                }}
              >
                {pendingPacket.type === "transfer" ? "退还" : "退回"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function SwipeRoleCard({ role, onOpen, onDelete, noun = "角色" }) {
  const [open, setOpen] = useState(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const swiped = useRef(false);

  const onPointerDown = (event) => {
    startPoint.current = { x: event.clientX, y: event.clientY };
    swiped.current = false;
  };

  const onPointerUp = (event) => {
    const deltaX = event.clientX - startPoint.current.x;
    const deltaY = event.clientY - startPoint.current.y;
    if (Math.abs(deltaX) < 28 || Math.abs(deltaX) < Math.abs(deltaY)) return;
    swiped.current = true;
    if (deltaX < -34) {
      setOpen(true);
    } else if (deltaX > 34) {
      setOpen(false);
    }
  };

  const deleteRole = (event) => {
    event.stopPropagation();
    onDelete(role.id);
  };

  return (
    <div className={`role-swipe ${open ? "is-open" : ""}`}>
      <button className="role-delete-action" type="button" onClick={deleteRole}>
        删除
      </button>
      <button
        className="role-card role-card-button"
        type="button"
        onClick={() => {
          if (swiped.current) return;
          onOpen(role.id);
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <span className="role-card-bg" aria-hidden="true" />
        <div className="role-avatar small">
          {role.avatar ? <img src={role.avatar} alt="" /> : <span>{role.name.slice(0, 1) || noun.slice(0, 1)}</span>}
        </div>
        <div className="role-card-main">
          <small>{role.worldview || "暂无关联世界观"}</small>
          <div className="role-card-head">
            <b>{role.name || `未命名${noun}`}</b>
            <span>{role.gender || "未填性别"}</span>
          </div>
          <div className="role-card-tags">
            <span>{role.identity || "未填写身份"}</span>
          </div>
          <p>{role.personality || role.persona || role.appearance || `还没有填写${noun}概况`}</p>
        </div>
      </button>
    </div>
  );
}

function RolesScreen({ roles, onCreate, onOpenRole, onDeleteRole }) {
  return (
    <section className="page soft-page roles-page">
      <Header title="角色" />
      <div className="role-toolbar">
        <div>
          <b>角色总览</b>
          <span>{roles.length} 个角色</span>
        </div>
        <button className="role-create-button" onClick={onCreate}>
          + 新建
        </button>
      </div>
      <div className="role-list">
        {roles.length === 0 ? (
          <div className="empty-state compact-empty roles-empty">
            <div className="mini-mark" />
            <h2>还没有角色</h2>
            <p>创建第一个角色后，就可以用于聊天扮演与剧情互动。</p>
          </div>
        ) : (
          roles.map((role) => (
            <SwipeRoleCard
              key={role.id}
              role={role}
              onOpen={onOpenRole}
              onDelete={onDeleteRole}
            />
          ))
        )}
      </div>
    </section>
  );
}

function IdentitiesScreen({ identities, onCreate, onOpenIdentity, onDeleteIdentity }) {
  return (
    <section className="page soft-page roles-page identities-page">
      <Header title="我" />
      <div className="role-toolbar">
        <div>
          <b>身份总览</b>
          <span>{identities.length} 个身份</span>
        </div>
        <button className="role-create-button" onClick={onCreate}>
          + 新建
        </button>
      </div>
      <div className="role-list">
        {identities.length === 0 ? (
          <div className="empty-state compact-empty roles-empty">
            <div className="mini-mark" />
            <h2>还没有身份</h2>
            <p>创建第一个身份后，就可以用自己的设定进入剧情互动。</p>
          </div>
        ) : (
          identities.map((identity) => (
            <SwipeRoleCard
              key={identity.id}
              role={identity}
              noun="身份"
              onOpen={onOpenIdentity}
              onDelete={onDeleteIdentity}
            />
          ))
        )}
      </div>
    </section>
  );
}

function CharacterCreatePage({
  initialRole = null,
  onBack,
  onSave,
  profileKind = "role",
  createDraft = createRoleDraft,
}) {
  const isIdentity = profileKind === "identity";
  const noun = isIdentity ? "身份" : "角色";
  const [draft, setDraft] = useState(() => initialRole || createDraft());
  const [message, setMessage] = useState("");
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorKeyword, setGeneratorKeyword] = useState("");
  const [generatingRole, setGeneratingRole] = useState(false);
  const updateRole = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const autoInputStyle = (value, minimum = 6) => ({
    "--field-chars": Math.min(24, Math.max(minimum, Array.from(value || "").length + 2)),
  });

  const applyGeneratedRole = (text) => {
    const parsed = parseGeneratedRole(text);
    setDraft((current) => ({
      ...current,
      name: parsed.name || current.name,
      gender: parsed.gender || current.gender,
      identity: parsed.identity || current.identity,
      personality: parsed.personality || current.personality,
      appearance: parsed.appearance || current.appearance,
      worldview: parsed.worldview || current.worldview,
      persona: parsed.persona || current.persona,
    }));
  };

  const uploadAvatar = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateRole("avatar", String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const saveRole = () => {
    const saved = onSave(draft);
    setDraft(saved);
    setMessage(`已保存${noun}：${saved.name}`);
  };

  const generateRole = async () => {
    const keyword = generatorKeyword.trim();
    if (!keyword) {
      setMessage(`请先填写${noun}关键词。`);
      return;
    }
    setGeneratingRole(true);
    setMessage(`正在生成${noun}信息...`);
    try {
      const store = new ApiConfigStore();
      const config = store.getSelected();
      const prompt = [
        `请根据用户关键词生成一个中文${noun}设定，用严格 JSON 返回，不要 Markdown，不要解释。`,
        "JSON 字段固定为：name, gender, identity, personality, appearance, worldview, persona。",
        "必须只返回一个 JSON 对象，所有字段都必须是字符串，不要嵌套对象。",
        "gender 只能从 女、男、非二元、其他 中选择一个。",
        "worldview 如果没有明确世界观，请填空字符串。",
        "appearance 写 1-2 句外貌与气质。",
        `persona 写 2-4 句${noun}人设，包括背景、关系感、说话方式和故事钩子。`,
        `关键词：${keyword}`,
      ].join("\n");
      const content = await callWithRetryAndFallback(config, ({ api }) =>
        requestChatCompletion(api, prompt, fetch, { maxTokens: 700 }),
      );
      applyGeneratedRole(content);
      setMessage(`${noun}信息已生成并填入表单。`);
    } catch (error) {
      setMessage(`生成失败：${error.message || "请检查 API 设置。"}`);
    } finally {
      setGeneratingRole(false);
    }
  };

  return (
    <section className={`page detail-page character-page ${isIdentity ? "identity-create-page" : ""}`.trim()}>
      <Header
        title={initialRole ? `编辑${noun}` : `新建${noun}`}
        onBack={onBack}
        action={(
          <button
            className="role-generate-toggle"
            onClick={() => setGeneratorOpen((open) => !open)}
            aria-label={`随机生成${noun}`}
          >
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path className="star-main" d="M16 4.8 18.9 12l7.7 1-5.6 5.1 1.4 7.6-6.4-3.8-6.4 3.8 1.4-7.6L5.4 13l7.7-1z" />
              <path className="star-small" d="M27.7 1.7 28.5 3.7 30.7 4 29.1 5.5 29.5 7.6 27.7 6.5 25.8 7.6 26.3 5.5 24.6 4 26.9 3.7z" />
              <path className="star-small" d="M4.5 23.6 5.3 25.6 7.5 25.9 5.9 27.4 6.3 29.5 4.5 28.4 2.6 29.5 3.1 27.4 1.4 25.9 3.7 25.6z" />
            </svg>
          </button>
        )}
      />
      <div className="character-form">
        {generatorOpen && (
          <div className="role-generator-panel">
            <input
              value={generatorKeyword}
              placeholder={isIdentity ? "输入关键词，例如：穿书少女" : "输入关键词，例如：赛博花店老板"}
              onChange={(event) => setGeneratorKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") generateRole();
              }}
            />
            <button onClick={generateRole} disabled={generatingRole}>
              {generatingRole ? "生成中" : "生成"}
            </button>
          </div>
        )}
        <div className="character-hero">
          <label className="avatar-picker">
            <input type="file" accept="image/*" onChange={uploadAvatar} />
            <span className="role-avatar large">
              {draft.avatar ? <img src={draft.avatar} alt="" /> : <span>上传头像</span>}
            </span>
          </label>
        </div>

        <div className="role-form-stack">
          <img
            className={`role-form-cat ${isIdentity ? "identity-form-cat" : ""}`.trim()}
            src={assetPath(isIdentity ? "assets/identity-form-cat.png" : "assets/role-form-cat.png")}
            alt=""
            draggable="false"
          />
          <div className="settings-group role-form-card role-card-two">
            <Field label="姓名" className="control-wide">
              <input
                className="role-auto-input"
                style={autoInputStyle(draft.name, 6)}
                value={draft.name}
                placeholder="需要填写"
                onChange={(event) => updateRole("name", event.target.value)}
              />
            </Field>
            <Field label="性别" className="select-wide">
              <select
                className={!draft.gender ? "role-placeholder-select" : ""}
                value={draft.gender}
                onChange={(event) => updateRole("gender", event.target.value)}
              >
                <option value="">选择</option>
                <option value="女">女</option>
                <option value="男">男</option>
                <option value="非二元">非二元</option>
                <option value="其他">其他</option>
              </select>
            </Field>
          </div>

          <div className="settings-group role-form-card">
            <Field label="身份" className="control-wide">
              <input
                className="role-auto-input"
                style={autoInputStyle(draft.identity, 10)}
                value={draft.identity}
                placeholder="例如：花店老板、同桌、骑士"
                onChange={(event) => updateRole("identity", event.target.value)}
              />
            </Field>
          </div>

          <div className="settings-group role-form-card">
            <Field label="性格" className="control-wide">
              <input
                className="role-auto-input"
                style={autoInputStyle(draft.personality, 10)}
                value={draft.personality}
                placeholder="例如：温柔、腹黑、慢热"
                onChange={(event) => updateRole("personality", event.target.value)}
              />
            </Field>
          </div>

          <div className="settings-group role-form-card">
            <Field label="容貌" className="textarea-row">
              <textarea value={draft.appearance} placeholder="发色、眼睛、穿搭、气质..." onChange={(event) => updateRole("appearance", event.target.value)} />
            </Field>
          </div>

          <div className="settings-group role-form-card">
            <Field label="关联世界观" className="select-wide">
              <select
                className={!draft.worldview ? "role-placeholder-select" : ""}
                value={draft.worldview}
                onChange={(event) => updateRole("worldview", event.target.value)}
              >
                <option value="">暂无</option>
                {draft.worldview ? <option value={draft.worldview}>{draft.worldview}</option> : null}
              </select>
            </Field>
          </div>

          <div className="settings-group role-form-card">
            <Field label="人设" className="textarea-row persona-row">
              <textarea value={draft.persona} placeholder="背景、关系、说话方式、故事钩子..." onChange={(event) => updateRole("persona", event.target.value)} />
            </Field>
          </div>
        </div>

        {message && <p className="api-message role-message">{message}</p>}
        <div className="action-row compact">
          <button onClick={saveRole}>{initialRole ? "保存修改" : `保存${noun}`}</button>
        </div>
      </div>
    </section>
  );
}

function Header({ title, onBack, action = null }) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="back-button" onClick={onBack} aria-label="返回">
          ‹
        </button>
      ) : (
        <span />
      )}
      <h1>{title}</h1>
      <span className="topbar-action">{action}</span>
    </header>
  );
}

function SettingsPage({ openSetting }) {
  return (
    <section className="page settings-page">
      <Header title="设置" />
      <div className="settings-group">
        {settingsItems.map(([key, title, desc, icon]) => (
          <button key={key} className="settings-row" onClick={() => openSetting(key)}>
            <span className="row-symbol">
              <img src={icon} alt="" draggable="false" />
            </span>
            <span className="row-copy">
              <b>{title}</b>
              <small>{desc}</small>
            </span>
            <span className="chevron">›</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Field({ label, children, className = "" }) {
  return (
    <label className={`field-row ${className}`.trim()}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function draftApiConfig() {
  return {
    ...DEFAULT_CONFIG,
    primary: { ...DEFAULT_CONFIG.primary },
    secondary: { ...DEFAULT_CONFIG.secondary },
  };
}

function ApiSettings({ onBack }) {
  const [store] = useState(() => new ApiConfigStore());
  const [config, setConfig] = useState(() => store.getSelected());
  const [primaryConfigId, setPrimaryConfigId] = useState(() => store.getSelected().id);
  const [message, setMessage] = useState("填写 API 后可拉取模型并测试连接。");
  const [selectionMessage, setSelectionMessage] = useState("");
  const [modelOptions, setModelOptions] = useState({ primary: [] });
  const [secondaryConfigId, setSecondaryConfigId] = useState(() => store.getSelected().secondaryConfigId || "");

  const configs = store.list();
  const visibleConfigs = configs.filter((item) => item.name && item.name !== DEFAULT_CONFIG.name);
  const primarySelectionValue = visibleConfigs.some((item) => item.id === primaryConfigId) ? primaryConfigId : "";
  const secondarySelectionValue = visibleConfigs.some((item) => item.id === secondaryConfigId) ? secondaryConfigId : "";
  const secondaryEnabled = config.secondaryEnabled !== false;
  const hasDistinctSecondarySelection = Boolean(
    secondaryEnabled && secondarySelectionValue && secondarySelectionValue !== primarySelectionValue,
  );
  const update = (section, key, value) => {
    if (section && (key === "apiUrl" || key === "apiKey")) {
      setModelOptions((current) => ({ ...current, [section]: [] }));
    }
    setConfig((current) =>
      section
        ? { ...current, [section]: { ...current[section], [key]: value } }
        : { ...current, [key]: value },
    );
  };

  const savePrimary = () => {
    const primaryName = config.primary.name?.trim();
    if (!primaryName) {
      setMessage("保存失败：请先填写主API名称。");
      return;
    }
    const saved = store.save({ ...config, name: primaryName });
    setConfig(saved);
    setPrimaryConfigId(saved.id);
    setMessage(`API已保存：${primaryName}`);
  };

  const saveSelection = () => {
    const primaryConfig = visibleConfigs.find((item) => item.id === primaryConfigId);
    const secondaryConfig = secondaryEnabled
      ? visibleConfigs.find((item) => item.id === secondaryConfigId)
      : null;
    if (!primaryConfig) {
      setSelectionMessage("保存失败：请先选择主API。");
      return;
    }
    const resolved = resolveApiSelection(config, primaryConfig, secondaryConfig);
    const saved = store.save(resolved);
    setConfig(saved);
    setPrimaryConfigId(saved.id);
    setSecondaryConfigId(saved.secondaryConfigId || "");
    const primaryName = primaryConfig.name;
    const secondaryName = secondaryConfig?.id === primaryConfig.id ? "" : secondaryConfig?.name;
    setSelectionMessage(
      secondaryName
        ? `已保存选择：主API ${primaryName}，副API ${secondaryName}`
        : `已保存选择：全局使用 ${primaryName}`,
    );
  };

  const createApi = () => {
    setModelOptions({ primary: [] });
    setConfig(draftApiConfig());
    setMessage("已新建 API，请填写后保存。");
  };

  const removePrimary = () => {
    setModelOptions((current) => ({ ...current, primary: [] }));
    if (config.id && config.id !== "draft") {
      const deletedId = config.id;
      store.remove(deletedId);
      if (primaryConfigId === deletedId) setPrimaryConfigId("");
      if (secondaryConfigId === deletedId) setSecondaryConfigId("");
      setConfig(draftApiConfig());
      setMessage("API已删除。");
      return;
    }
    setConfig(draftApiConfig());
    setMessage("API已删除。");
  };

  const testSectionApi = async (section) => {
    setMessage("正在测试 API...");
    try {
      await requestChatCompletion(config[section], "请用四个字回复：连接正常");
      if (section === "primary" && config.primary.name?.trim()) {
        const saved = store.save({ ...config, name: config.primary.name.trim() });
        setConfig(saved);
        setPrimaryConfigId(saved.id);
        setSecondaryConfigId(saved.secondaryConfigId || "");
        setMessage("API连接成功，已自动保存。");
        return;
      }
      setMessage(section === "primary" ? "API连接成功。请填写名称并保存后用于生成。" : "API连接成功。");
    } catch (error) {
      setMessage(`API连接失败：${error.message || "请检查地址、Key 和模型。"}`);
    }
  };

  const fetchModels = async (section) => {
    setMessage("正在拉取模型...");
    try {
      const models = await fetchModelList(config[section]);
      if (models.length === 0) {
        setMessage("未拉取到模型列表，可手动填写模型。");
        return;
      }
      setModelOptions((current) => ({ ...current, [section]: models }));
      update(section, "model", models[0]);
      setMessage(`已拉取 ${models.length} 个模型，可在模型框中手动选择。`);
    } catch (error) {
      setMessage(`拉取失败：${error.message || "请检查 API 地址和 Key。"}`);
    }
  };

  return (
    <section className="page detail-page api-settings-page">
      <Header title="API设置" onBack={onBack} />

      <div className="settings-group api-group">
        <Field label="主API选择" className="select-wide">
          <select
            value={primarySelectionValue}
            onChange={(event) => {
              setPrimaryConfigId(event.target.value);
              setModelOptions({ primary: [] });
              const selected = store.select(event.target.value);
              setConfig(selected);
              setSecondaryConfigId(selected.secondaryConfigId || "");
            }}
          >
            {visibleConfigs.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        {secondaryEnabled && (
          <Field label="副API选择" className="select-wide">
            <select
              className={!secondarySelectionValue ? "api-placeholder-select" : ""}
              value={secondarySelectionValue}
              onChange={(event) => setSecondaryConfigId(event.target.value)}
            >
              <option value="">无</option>
              {visibleConfigs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="主API温度">
          <input
            type="range"
            min="0"
            max="1.5"
            step="0.05"
            value={config.primary.temperature}
            onChange={(event) => update("primary", "temperature", Number(event.target.value))}
          />
          <em>{Number(config.primary.temperature).toFixed(2)}</em>
        </Field>
        {secondaryEnabled && (
          <Field label="副API温度">
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={config.secondary.temperature}
              onChange={(event) => update("secondary", "temperature", Number(event.target.value))}
            />
            <em>{Number(config.secondary.temperature).toFixed(2)}</em>
          </Field>
        )}
        <Field label="副API开关" className="switch-row">
          <input
            className="switch-input"
            type="checkbox"
            checked={secondaryEnabled}
            onChange={(event) => {
              update(null, "secondaryEnabled", event.target.checked);
              if (!event.target.checked) update(null, "fallbackToSecondary", false);
            }}
          />
        </Field>
        {secondaryEnabled && (
          <Field label="失败切换副API" className="switch-row">
            <input
              className="switch-input"
              type="checkbox"
              checked={hasDistinctSecondarySelection && config.fallbackToSecondary}
              disabled={!hasDistinctSecondarySelection}
              onChange={(event) => update(null, "fallbackToSecondary", event.target.checked)}
            />
          </Field>
        )}
        {selectionMessage && <p className="api-message">{selectionMessage}</p>}
        <div className="action-row compact">
          <button onClick={saveSelection}>保存</button>
        </div>
      </div>

      <ApiBlock
        title="API设置"
        section="primary"
        api={config.primary}
        message={message}
        update={update}
        fetchModels={fetchModels}
        modelOptions={modelOptions.primary}
        onTest={testSectionApi}
        onCreate={createApi}
        onSave={savePrimary}
        onDelete={removePrimary}
      />
    </section>
  );
}

function ApiBlock({ title, section, api, message, update, fetchModels, modelOptions = [], onTest, onCreate, onSave, onDelete }) {
  const modelListId = `${section}-model-options`;
  const canSavePrimary = section !== "primary" || Boolean(api.name?.trim());
  const hasFetchedModels = modelOptions.length > 0;
  const fetchedModels = [...new Set(modelOptions.filter(Boolean))];
  const defaultModels = [...new Set([
    api.model,
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
  ].filter(Boolean))];

  return (
    <div className="settings-group api-group">
      <div className="api-title-row">
        <h2>{title}</h2>
        {section === "primary" && (
          <button className="ghost-action" onClick={onCreate} aria-label="新建API">
            +
          </button>
        )}
      </div>
      <p className="api-message">{message}</p>
      {section === "primary" && (
        <Field label="名称" className="control-wide">
          <input
            value={api.name}
            required
            placeholder="需要填写"
            onChange={(event) => update(section, "name", event.target.value)}
          />
        </Field>
      )}
      <Field label="API 地址" className="control-wide">
        <input value={api.apiUrl} onChange={(event) => update(section, "apiUrl", event.target.value)} />
      </Field>
      <Field label="API Key" className="control-wide">
        <input value={api.apiKey} type="password" onChange={(event) => update(section, "apiKey", event.target.value)} />
      </Field>
      <Field label="模型" className="control-wide">
        {hasFetchedModels ? (
          <select
            value={api.model}
            onChange={(event) => update(section, "model", event.target.value)}
          >
            {fetchedModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              list={modelListId}
              value={api.model}
              placeholder="选择或输入模型"
              onChange={(event) => update(section, "model", event.target.value)}
            />
            <datalist id={modelListId}>
              {defaultModels.map((model) => (
                <option key={model} value={model} />
              ))}
            </datalist>
          </>
        )}
      </Field>
      <div className={`action-row compact ${section === "primary" ? "primary-actions" : ""}`}>
        <button onClick={() => fetchModels(section)}>自动拉取</button>
        {section === "primary" && (
          <button onClick={() => onTest(section)}>测试</button>
        )}
        {section === "primary" && (
          <button disabled={!canSavePrimary} onClick={onSave}>
            保存
          </button>
        )}
        {section === "primary" && (
          <button className="danger" onClick={onDelete}>
            删除
          </button>
        )}
      </div>
    </div>
  );
}

function AppearanceSettings({ onBack }) {
  return (
    <section className="page detail-page">
      <Header title="外观设置" onBack={onBack} />
      <div className="settings-group">
        {["替换壁纸", "替换屏保", "替换微聊图标", "替换论坛图标", "替换小红书图标", "替换钱包图标", "替换游戏图标", "替换美化图标", "替换世界观图标", "替换预设图标", "替换外卖图标", "替换外出图标", "替换日记图标", "替换情侣空间图标"].map((item) => (
          <button className="settings-row" key={item}>
            <span className="row-symbol" />
            <span className="row-copy"><b>{item}</b></span>
            <span className="chevron">›</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function SettingDetail({ page, onBack }) {
  if (page === "api") return <ApiSettings onBack={onBack} />;
  if (page === "appearance") return <AppearanceSettings onBack={onBack} />;
  const found = settingsItems.find(([key]) => key === page);
  return (
    <section className="page detail-page">
      <Header title={found?.[1] || "设置"} onBack={onBack} />
      <div className="empty-state">
        <div className="mini-mark" />
        <h2>{found?.[1]}</h2>
        <p>独立全屏页面已建立，可继续扩展具体选项。</p>
      </div>
    </section>
  );
}

function BottomTabs({ active, setActive }) {
  return (
    <nav className="bottom-tabs" aria-label="底部导航">
      {tabItems.map((item) => (
        <button
          key={item.key}
          className={active === item.key ? "active" : ""}
          onClick={() => setActive(item.key)}
        >
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

export function App() {
  const [locked, setLocked] = useState(true);
  const [tab, setTab] = useState("home");
  const [appPage, setAppPage] = useState(null);
  const [settingPage, setSettingPage] = useState(null);
  const [rolePage, setRolePage] = useState(null);
  const [identityPage, setIdentityPage] = useState(null);
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [selectedIdentityId, setSelectedIdentityId] = useState(null);
  const [selectedChatId, setSelectedChatId] = useState(null);
  const [sendingChatId, setSendingChatId] = useState(null);
  const [roleStore] = useState(() => new RoleStore());
  const [identityStore] = useState(() => new IdentityStore());
  const [chatStore] = useState(() => new ChatStore());
  const [walletStore] = useState(() => new WalletStore());
  const [workStore] = useState(() => new WorkStore());
  const [roles, setRoles] = useState(() => roleStore.list());
  const [identities, setIdentities] = useState(() => identityStore.list());
  const [conversations, setConversations] = useState(() => chatStore.list());
  const [wallet, setWallet] = useState(() => walletStore.snapshot());
  const [workDay, setWorkDay] = useState(() => workStore.snapshot());
  const [workMessage, setWorkMessage] = useState("");
  const [contacts, setContacts] = useState(() => chatStore.listContacts());
  const [contactRequests, setContactRequests] = useState(() => chatStore.listContactRequests());
  const [momentPosts, setMomentPosts] = useState(() => chatStore.listMomentPosts());
  const [generatingMoments, setGeneratingMoments] = useState(false);
  const momentGenerationBusyRef = useRef(false);
  const clock = useClock();

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.get("v") !== APP_VERSION) {
      currentUrl.searchParams.set("v", APP_VERSION);
      window.history.replaceState(null, "", currentUrl);
    }

    let versionCheckTimer = 0;
    let reloadingForVersion = false;
    const checkRemoteVersion = async () => {
      if (reloadingForVersion) return;
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}version.json?ts=${Date.now()}`, {
          cache: "no-store",
        });
        const payload = await response.json();
        if (payload?.version && payload.version !== APP_VERSION) {
          reloadingForVersion = true;
          const nextUrl = new URL(window.location.href);
          nextUrl.searchParams.set("v", payload.version);
          window.location.replace(nextUrl);
        }
      } catch {
        // Version checks are best-effort so offline launches still work.
      }
    };
    const checkOnVisible = () => {
      if (document.visibilityState === "visible") checkRemoteVersion();
    };
    window.addEventListener("pageshow", checkRemoteVersion);
    document.addEventListener("visibilitychange", checkOnVisible);
    versionCheckTimer = window.setInterval(checkRemoteVersion, 90_000);
    checkRemoteVersion();

    if ("serviceWorker" in navigator) {
      let refreshing = false;
      const reloadOnUpdate = () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", reloadOnUpdate);
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js?v=${APP_VERSION}`)
        .then((registration) => registration.update().catch(() => {}))
        .catch(() => {});
      return () => {
        window.clearInterval(versionCheckTimer);
        window.removeEventListener("pageshow", checkRemoteVersion);
        document.removeEventListener("visibilitychange", checkOnVisible);
        navigator.serviceWorker.removeEventListener("controllerchange", reloadOnUpdate);
      };
    }
    return () => {
      window.clearInterval(versionCheckTimer);
      window.removeEventListener("pageshow", checkRemoteVersion);
      document.removeEventListener("visibilitychange", checkOnVisible);
    };
  }, []);

  const selectedRole = useMemo(() => roles.find((role) => role.id === selectedRoleId) || null, [roles, selectedRoleId]);
  const selectedIdentity = useMemo(
    () => identities.find((identity) => identity.id === selectedIdentityId) || null,
    [identities, selectedIdentityId],
  );
  const content = useMemo(() => {
    if (appPage?.key === "chat") {
      return (
        <MicroChatApp
          roles={roles}
          contacts={contacts}
          contactRequests={contactRequests}
          myProfile={identities[0] || null}
          momentPosts={momentPosts}
          conversations={conversations}
          selectedChatId={selectedChatId}
          sendingChatId={sendingChatId}
          onBack={() => {
            setSelectedChatId(null);
            setAppPage(null);
          }}
          onStartChat={(role) => {
            const conversation = chatStore.startConversation(role, identities[0] || null);
            setConversations(chatStore.list());
            setSelectedChatId(conversation.id);
          }}
          onAddContact={(role, random) => {
            const result = chatStore.requestContact(role, random);
            setContacts(chatStore.listContacts());
            setContactRequests(chatStore.listContactRequests());
            return result;
          }}
          onRecordContactRequest={(role, options) => {
            const request = chatStore.recordContactRequest(role, options);
            setContactRequests(chatStore.listContactRequests());
            return request;
          }}
          onOpenChat={(id) => {
            chatStore.markRead(id);
            setConversations(chatStore.list());
            setSelectedChatId(id);
          }}
          onDeleteChat={(id) => {
            chatStore.removeConversation(id);
            setConversations(chatStore.list());
            if (selectedChatId === id) setSelectedChatId(null);
          }}
          onCloseChat={() => setSelectedChatId(null)}
          onSendMessage={async (conversationId, text) => {
            chatStore.bindConversationUser(conversationId, identities[0] || null);
            chatStore.addMessage(conversationId, createChatMessage({ role: "user", content: text }));
            setConversations(chatStore.list());
            setSendingChatId(conversationId);
            try {
              const conversation = chatStore.get(conversationId);
              const config = new ApiConfigStore().getSelected();
              const prompt = buildRoleReplyPrompt(conversation, text);
              const reply = await callWithRetryAndFallback(config, ({ api }) =>
                requestChatCompletion(api, prompt, fetch, { maxTokens: 420 }),
              );
              const replyEvents = parseAssistantReplyEvents(reply);
              for (const [index, event] of replyEvents.entries()) {
                if (index > 0) await wait(getChatReplyDelayMs(index));
                if (event.type === "transfer") {
                  chatStore.addMessage(conversationId, createChatMessage({
                    role: "assistant",
                    type: "transfer",
                    content: "转账",
                    meta: {
                      title: "转账给你",
                      subtitle: `${conversation.title}发起的转账`,
                      amount: event.amount,
                      status: "pending",
                    },
                  }));
                } else {
                  chatStore.addMessage(conversationId, createChatMessage({ role: "assistant", content: event.content }));
                }
                setConversations(chatStore.list());
              }
            } catch (error) {
              chatStore.addMessage(
                conversationId,
                createChatMessage({
                  role: "assistant",
                  status: "failed",
                  content: `发送失败：${error.message || "请检查 API 设置。"}`,
                }),
              );
            } finally {
              setSendingChatId(null);
              setConversations(chatStore.list());
            }
          }}
          onSendRedPacket={(conversationId, amount) => {
            const conversation = chatStore.get(conversationId);
            if (!conversation) throw new Error("会话不存在。");
            const value = Number(amount);
            if (!Number.isFinite(value) || value <= 0) throw new Error("红包金额无效。");
            if (value > walletStore.snapshot().balance) throw new Error("余额不足。");
            const message = chatStore.addMessage(conversationId, createChatMessage({
              role: "user",
              type: "red_packet",
              content: "红包",
              meta: {
                title: "恭喜发财，大吉大利",
                subtitle: `${identities[0]?.name || "我"}发出的红包`,
                amount: value,
                status: "sent",
              },
            }));
            walletStore.sendRedPacket({ to: conversation.title, amount: value, messageId: message.id });
            setWallet(walletStore.snapshot());
            setConversations(chatStore.list());
            window.setTimeout(async () => {
              const latestConversation = chatStore.get(conversationId);
              const latestMessage = latestConversation?.messages.find((item) => item.id === message.id);
              if (!latestMessage || latestMessage.meta?.status !== "sent") return;
              const accepted = Math.random() > 0.28;
              if (accepted) {
                chatStore.updateMessageMeta(conversationId, message.id, { status: "accepted_by_role" });
              } else {
                walletStore.refundSentRedPacket({
                  from: conversation.title,
                  amount: value,
                  messageId: message.id,
                });
                chatStore.updateMessageMeta(conversationId, message.id, { status: "returned_by_role" });
                setWallet(walletStore.snapshot());
              }
              setConversations(chatStore.list());
              setSendingChatId(conversationId);
              await wait(getChatReplyDelayMs(1));
              chatStore.addMessage(conversationId, createChatMessage({
                role: "assistant",
                content: accepted
                  ? pickShortReply(redPacketAcceptedReplies)
                  : pickShortReply(redPacketReturnedReplies),
              }));
              setSendingChatId(null);
              setConversations(chatStore.list());
            }, 2600 + Math.floor(Math.random() * 2400));
            return message;
          }}
          onAcceptRedPacket={(conversationId, message) => {
            const conversation = chatStore.get(conversationId);
            if (!conversation || message?.meta?.status !== "pending") return null;
            const receive = message.type === "transfer"
              ? walletStore.receiveTransfer.bind(walletStore)
              : walletStore.receiveRedPacket.bind(walletStore);
            receive({
              from: conversation.title,
              amount: Number(message.meta?.amount || 0),
              messageId: message.id,
            });
            chatStore.updateMessageMeta(conversationId, message.id, { status: "received" });
            setWallet(walletStore.snapshot());
            setConversations(chatStore.list());
            return message;
          }}
          onReturnRedPacket={(conversationId, message) => {
            if (message?.meta?.status !== "pending") return null;
            walletStore.returnRedPacket({
              from: chatStore.get(conversationId)?.title,
              amount: Number(message.meta?.amount || 0),
              messageId: message.id,
            });
            chatStore.updateMessageMeta(conversationId, message.id, { status: "returned" });
            setWallet(walletStore.snapshot());
            setConversations(chatStore.list());
            return message;
          }}
          onProactiveChatEvent={(conversationId, random = Math.random) => {
            const conversation = chatStore.get(conversationId);
            if (!conversation) return null;
            const message = createProactiveChatMessage(conversation, random);
            chatStore.addMessage(conversationId, message);
            setConversations(chatStore.list());
            return message;
          }}
          onGenerateMoments={async ({ mode, postType, selectedRoleId, count, spontaneous = false }) => {
            if (momentGenerationBusyRef.current) {
              if (spontaneous) return 0;
              throw new Error("正在生成动态，请稍后再试。");
            }
            momentGenerationBusyRef.current = true;
            setGeneratingMoments(true);
            let config = null;
            try {
              config = new ApiConfigStore().getSelected();
              const normalizedPostType = normalizeMomentPostType(postType);
              const limit = Math.max(1, Math.min(5, Number(count) || 1));
              const authors = pickMomentAuthors({
                contacts,
                selectedRoleId,
                count: limit,
                myProfile: identities[0] || null,
              });
              const author = authors[0] || pickMomentAuthor({
                contacts,
                selectedRoleId,
                myProfile: identities[0] || null,
              });
              if (!author) throw new Error("请先在通讯录添加角色。");
              const nowText = `${clock.date} ${clock.time}`;
              let generated = [];
              if (normalizedPostType === "text") {
                const textAuthors = (authors.length > 0 ? authors : [author]).slice(0, limit);
                for (const [index, currentAuthor] of textAuthors.entries()) {
                  const delayMs = getMomentRequestDelayMs(index, normalizedPostType);
                  if (delayMs) await wait(delayMs);
                  const context = buildMomentContext({ author: currentAuthor, conversations });
                  const prompt = buildTinyMomentPrompt({ author: currentAuthor, context, nowText });
                  let reply = "";
                  try {
                    reply = await callWithRetryAndFallback(config, ({ api }) =>
                      requestChatCompletion(api, prompt, fetch, { maxTokens: getMomentMaxTokens(1, normalizedPostType) }),
                    );
                  } catch (error) {
                    if (shouldKeepPartialMomentResults(error, generated.length)) {
                      break;
                    } else {
                      throw new Error(`${error.message || "生成失败"}；${describeApiUsage(config)}；请求:纯文字轻量；${describeAppRuntime()}`);
                    }
                  }
                  generated.push(...parseMomentPosts(reply, [currentAuthor]).slice(0, 1));
                }
              } else {
                const context = buildMomentContext({ author, conversations });
                const prompt = buildMomentsPrompt({
                  contacts: authors.length > 0 ? authors : contacts,
                  mode: spontaneous ? "spontaneous" : mode,
                  postType: normalizedPostType,
                  selectedRoleId,
                  count: limit,
                  author: selectedRoleId ? author : null,
                  context,
                  nowText,
                });
                const maxTokens = getMomentMaxTokens(limit, normalizedPostType);
                let reply = "";
                try {
                  reply = await callWithRetryAndFallback(config, ({ api }) =>
                    requestChatCompletion(api, prompt, fetch, { maxTokens }),
                  );
                } catch (error) {
                  throw new Error(`${error.message || "生成失败"}；${describeApiUsage(config)}；请求:图文；${describeAppRuntime()}`);
                }
                generated = parseMomentPosts(reply, authors.length > 0 ? authors : [author]).slice(0, limit);
              }
              generated.forEach((post, index) => {
                const matchedAuthor = contacts.find((contact) => contact.name === post.authorName)
                  || authors[index % Math.max(authors.length, 1)]
                  || author;
                chatStore.addMomentPost({
                  authorName: post.authorName || matchedAuthor.name,
                  avatar: matchedAuthor.avatar || "",
                  content: cleanMomentContent(post.content),
                  image: normalizedPostType === "image_text" ? matchedAuthor.avatar || "" : "",
                  postType: normalizedPostType,
                  createdAt: Date.now(),
                });
              });
              setMomentPosts(chatStore.listMomentPosts());
              return generated.length;
            } catch (error) {
              throw new Error(withApiDiagnostics(error, config, "朋友圈"));
            } finally {
              momentGenerationBusyRef.current = false;
              setGeneratingMoments(false);
            }
          }}
          onToggleMomentLike={(postId) => {
            chatStore.toggleMomentLike(postId, {
              id: identities[0]?.id || "me",
              name: identities[0]?.name || "我",
            });
            setMomentPosts(chatStore.listMomentPosts());
          }}
          onAddMomentComment={async (post, text, target = null) => {
            const myName = identities[0]?.name || "我";
            const comment = target?.commentId
              ? chatStore.addMomentReply(post.id, target.commentId, {
                authorName: myName,
                replyToName: target.replyToName || post.authorName,
                content: text,
              })
              : chatStore.addMomentComment(post.id, {
                authorName: myName,
                content: text,
              });
            setMomentPosts(chatStore.listMomentPosts());
            if (!comment) return comment;

            window.setTimeout(() => {
              (async () => {
                try {
                  const config = new ApiConfigStore().getSelected();
                  const prompt = buildMomentReplyPrompt(post, text);
                  const reply = await callWithRetryAndFallback(config, ({ api }) =>
                    requestChatCompletion(api, prompt, fetch, { maxTokens: 80 }),
                  );
                  chatStore.addMomentReply(post.id, target?.commentId || comment.id, {
                    authorName: post.authorName,
                    replyToName: myName,
                    content: cleanMomentContent(reply).slice(0, 80),
                  });
                  setMomentPosts(chatStore.listMomentPosts());
                } catch {
                  setMomentPosts(chatStore.listMomentPosts());
                }
              })();
            }, getMomentReplyDelayMs());
            return comment;
          }}
          onClearMoments={() => {
            chatStore.clearMomentPosts();
            setMomentPosts([]);
          }}
          generatingMoments={generatingMoments}
        />
      );
    }
    if (appPage?.key === "wallet") return <WalletApp wallet={wallet} />;
    if (appPage?.key === "work") {
      return (
        <WorkApp
          workDay={workDay}
          message={workMessage}
          onRefreshJobs={() => {
            try {
              setWorkDay(workStore.refreshJobs());
              setWorkMessage("今日工作已刷新。");
            } catch (error) {
              setWorkMessage(error.message || "刷新失败。");
            }
          }}
          onStartJob={(jobId) => {
            try {
              const job = workStore.startJob(jobId);
              setWorkDay(workStore.snapshot());
              setWorkMessage(`${job.title} 已开始。`);
            } catch (error) {
              setWorkMessage(error.message || "开始失败。");
            }
          }}
          onClaimJob={(jobId) => {
            try {
              const job = workStore.claimJob(jobId);
              walletStore.receiveWorkPay({
                job: job.title,
                amount: job.pay,
                messageId: `work-${workDay.dateKey}-${job.id}`,
              });
              setWallet(walletStore.snapshot());
              setWorkDay(workStore.snapshot());
              setWorkMessage(`工资 ¥${job.pay.toFixed(2)} 已存入钱包。`);
            } catch (error) {
              setWorkMessage(error.message || "领取失败。");
            }
          }}
        />
      );
    }
    if (appPage) return <SimplePane title={appPage.label} />;
    if (settingPage) return <SettingDetail page={settingPage} onBack={() => setSettingPage(null)} />;
    if (rolePage === "create") {
      return (
        <CharacterCreatePage
          onBack={() => setRolePage(null)}
          onSave={(draft) => {
            const saved = roleStore.save(draft);
            setRoles(roleStore.list());
            setSelectedRoleId(saved.id);
            return saved;
          }}
        />
      );
    }
    if (rolePage === "edit") {
      return (
        <CharacterCreatePage
          initialRole={selectedRole}
          onBack={() => {
            setRolePage(null);
            setSelectedRoleId(null);
          }}
          onSave={(draft) => {
            const saved = roleStore.save(draft);
            setRoles(roleStore.list());
            setSelectedRoleId(saved.id);
            return saved;
          }}
        />
      );
    }
    if (identityPage === "create") {
      return (
        <CharacterCreatePage
          profileKind="identity"
          createDraft={createIdentityDraft}
          onBack={() => setIdentityPage(null)}
          onSave={(draft) => {
            const saved = identityStore.save(draft);
            setIdentities(identityStore.list());
            setSelectedIdentityId(saved.id);
            return saved;
          }}
        />
      );
    }
    if (identityPage === "edit") {
      return (
        <CharacterCreatePage
          profileKind="identity"
          createDraft={createIdentityDraft}
          initialRole={selectedIdentity}
          onBack={() => setIdentityPage(null)}
          onSave={(draft) => {
            const saved = identityStore.save(draft);
            setIdentities(identityStore.list());
            setSelectedIdentityId(saved.id);
            return saved;
          }}
        />
      );
    }
    if (tab === "home") return <HomeScreen clock={clock} openApp={setAppPage} />;
    if (tab === "settings") return <SettingsPage openSetting={setSettingPage} />;
    if (tab === "roles") {
      return (
        <RolesScreen
          roles={roles}
          onCreate={() => setRolePage("create")}
          onOpenRole={(id) => {
            setSelectedRoleId(id);
            setRolePage("edit");
          }}
          onDeleteRole={(id) => {
            roleStore.remove(id);
            setRoles(roleStore.list());
            if (selectedRoleId === id) setSelectedRoleId(null);
          }}
        />
      );
    }
    if (tab === "me") {
      return (
        <IdentitiesScreen
          identities={identities}
          onCreate={() => setIdentityPage("create")}
          onOpenIdentity={(id) => {
            setSelectedIdentityId(id);
            setIdentityPage("edit");
          }}
          onDeleteIdentity={(id) => {
            identityStore.remove(id);
            setIdentities(identityStore.list());
            if (selectedIdentityId === id) setSelectedIdentityId(null);
          }}
        />
      );
    }
    return <SimplePane title={tab === "roles" ? "角色" : "我"} />;
  }, [
    appPage,
    chatStore,
    contacts,
    contactRequests,
    clock,
    conversations,
    generatingMoments,
    identities,
    identityPage,
    identityStore,
    momentPosts,
    rolePage,
    roleStore,
    roles,
    selectedChatId,
    selectedIdentity,
    selectedIdentityId,
    selectedRole,
    selectedRoleId,
    sendingChatId,
    settingPage,
    tab,
    wallet,
    walletStore,
    workDay,
    workMessage,
    workStore,
  ]);

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return (
    <main className="screen">
      {appPage && appPage.key !== "chat" ? (
        <button className="floating-back" onClick={() => setAppPage(null)}>
          返回
        </button>
      ) : null}
      {content}
      {!appPage && !settingPage && !rolePage && !identityPage ? <BottomTabs active={tab} setActive={setTab} /> : null}
    </main>
  );
}
