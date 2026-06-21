import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiConfigStore,
  callWithRetryAndFallback,
  DEFAULT_CONFIG,
  fetchModelList,
  requestChatCompletion,
  resolveApiSelection,
} from "./lib/apiStore.js";
import { ChatStore, createChatMessage } from "./lib/chatStore.js";
import { createIdentityDraft, IdentityStore } from "./lib/identityStore.js";
import { parseGeneratedRole } from "./lib/roleGenerator.js";
import { createRoleDraft, RoleStore } from "./lib/roleStore.js";

const assetPath = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;

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

function formatChatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function buildRoleReplyPrompt(conversation, userText) {
  const role = conversation.roleSnapshot || {};
  const recentMessages = conversation.messages.slice(-8).map((message) => (
    `${message.role === "user" ? "用户" : role.name || "角色"}：${message.content}`
  )).join("\n");

  return [
    "你正在一个中文角色扮演聊天软件里回复用户。请只输出角色要发出的消息，不要解释，不要 Markdown。",
    `角色姓名：${role.name || conversation.title || "未命名角色"}`,
    `性别：${role.gender || "未填写"}`,
    `身份：${role.identity || "未填写"}`,
    `性格：${role.personality || "未填写"}`,
    `容貌：${role.appearance || "未填写"}`,
    `世界观：${role.worldview || "暂无"}`,
    `人设：${role.persona || "未填写"}`,
    "回复要求：像微信聊天一样自然，1-3 句为主；可以有情绪和动作暗示，但不要太长。",
    recentMessages ? `最近聊天：\n${recentMessages}` : "",
    `用户新消息：${userText}`,
  ].filter(Boolean).join("\n");
}

function MicroChatApp({
  roles,
  contacts,
  contactRequests,
  myProfile,
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
  sendingChatId,
}) {
  const [chatTab, setChatTab] = useState("chats");
  const [contactPage, setContactPage] = useState(null);
  const selectedConversation = conversations.find((conversation) => conversation.id === selectedChatId) || null;

  if (selectedConversation) {
    return (
      <ChatThread
        conversation={selectedConversation}
        onBack={onCloseChat}
        onSend={(text) => onSendMessage(selectedConversation.id, text)}
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
        {chatTab === "moments" ? <MicroChatMoments myProfile={myProfile} /> : null}
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

  useEffect(() => {
    if (availableRoles.length === 0 || incomingRole) return undefined;
    const timer = window.setTimeout(() => {
      if (Math.random() < 0.42) {
        const role = availableRoles[Math.floor(Math.random() * availableRoles.length)];
        setIncomingRole(role || null);
        if (role) setMessage(`${role.name || "有角色"}想添加你为好友。`);
      }
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [availableRoles.length, incomingRole]);

  const requestAdd = (role) => {
    if (pendingRoleId) return;
    setPendingRoleId(role.id);
    setMessage(`正在等待${role.name || "对方"}确认...`);
    window.setTimeout(() => {
      const result = onAddContact(role);
      setMessage(result.accepted
        ? `${role.name || "角色"}已通过你的好友申请。`
        : result.reason || `${role.name || "角色"}拒绝了你的添加请求。`);
      setPendingRoleId("");
      if (result.accepted) setAdding(false);
    }, 1200);
  };

  const acceptIncoming = () => {
    if (!incomingRole || incomingBusy) return;
    setIncomingBusy(true);
    setMessage(`正在通过${incomingRole.name || "对方"}的好友申请...`);
    window.setTimeout(() => {
      onAddContact(incomingRole, () => 1);
      setMessage(`你已添加${incomingRole.name || "角色"}。`);
      setIncomingRole(null);
      setIncomingBusy(false);
    }, 800);
  };

  const rejectIncoming = () => {
    if (!incomingRole || incomingBusy) return;
    setIncomingBusy(true);
    setMessage(`正在处理${incomingRole.name || "对方"}的好友申请...`);
    window.setTimeout(() => {
      onRecordContactRequest(incomingRole, { direction: "incoming", status: "rejected" });
      setMessage(`已拒绝${incomingRole.name || "角色"}的好友申请。`);
      setIncomingRole(null);
      setIncomingBusy(false);
    }, 900);
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
        <button className="new-friends-back" onClick={onBackToContacts}>‹ 通讯录</button>
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
                    <button onClick={acceptIncoming} disabled={incomingBusy}>通过</button>
                    <button onClick={rejectIncoming} disabled={incomingBusy}>拒绝</button>
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
                  <small>{pendingRoleId === role.id ? "等待对方确认..." : role.identity || role.personality || "发送好友申请"}</small>
                </span>
                <span className="contact-apply">{pendingRoleId === role.id ? "等待" : "申请"}</span>
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

function MicroChatMoments({ myProfile }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState("random");
  const [count, setCount] = useState(3);
  const [specified, setSpecified] = useState("");

  return (
    <div className="moments-page">
      <button className="moments-action" onClick={() => setMenuOpen((value) => !value)} aria-label="朋友圈生成设置">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
      </button>
      {menuOpen ? (
        <div className="moments-menu">
          <b>生成动态</b>
          <label>
            <span>自选</span>
            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="random">随机</option>
              <option value="specified">指定</option>
            </select>
          </label>
          {mode === "specified" ? (
            <label>
              <span>指定</span>
              <input value={specified} placeholder="填写角色或主题" onChange={(event) => setSpecified(event.target.value)} />
            </label>
          ) : null}
          <label>
            <span>条数</span>
            <input type="number" min="1" max="9" value={count} onChange={(event) => setCount(event.target.value)} />
          </label>
          <button>生成动态</button>
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
      <div className="moments-blank" />
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

function ChatThread({ conversation, onBack, onSend, sending }) {
  const [text, setText] = useState("");

  const send = () => {
    const value = text.trim();
    if (!value || sending) return;
    setText("");
    onSend(value);
  };

  return (
    <section className="page chat-page chat-thread-page">
      <Header title={conversation.title} onBack={onBack} />
      <div className="chat-thread">
        {conversation.messages.length === 0 ? (
          <div className="chat-day-tip">你们还没有聊天</div>
        ) : (
          conversation.messages.map((message) => (
            <div className={`message-row ${message.role === "user" ? "from-user" : "from-role"}`} key={message.id}>
              {message.role !== "user" ? <ChatAvatar conversation={conversation} /> : null}
              <span className={`message-bubble ${message.status === "failed" ? "failed" : ""}`}>
                {message.content}
              </span>
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
      <div className="chat-composer">
        <button aria-label="语音">⌕</button>
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
      </div>
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
      setMessage("API连接成功。");
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
  const [roles, setRoles] = useState(() => roleStore.list());
  const [identities, setIdentities] = useState(() => identityStore.list());
  const [conversations, setConversations] = useState(() => chatStore.list());
  const [contacts, setContacts] = useState(() => chatStore.listContacts());
  const [contactRequests, setContactRequests] = useState(() => chatStore.listContactRequests());
  const clock = useClock();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    }
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
          conversations={conversations}
          selectedChatId={selectedChatId}
          sendingChatId={sendingChatId}
          onBack={() => {
            setSelectedChatId(null);
            setAppPage(null);
          }}
          onStartChat={(role) => {
            const conversation = chatStore.startConversation(role);
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
            chatStore.addMessage(conversationId, createChatMessage({ role: "user", content: text }));
            setConversations(chatStore.list());
            setSendingChatId(conversationId);
            try {
              const conversation = chatStore.get(conversationId);
              const config = new ApiConfigStore().getSelected();
              const prompt = buildRoleReplyPrompt(conversation, text);
              const reply = await callWithRetryAndFallback(config, ({ api }) =>
                requestChatCompletion(api, prompt, fetch, { maxTokens: 900 }),
              );
              chatStore.addMessage(conversationId, createChatMessage({ role: "assistant", content: reply }));
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
    identities,
    identityPage,
    identityStore,
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
