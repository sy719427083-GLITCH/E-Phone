import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApiConfigStore,
  callWithRetryAndFallback,
  DEFAULT_CONFIG,
  fetchModelList,
  requestChatCompletion,
  resolveApiSelection,
} from "./lib/apiStore.js";
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
  { key: "roles", label: "角色", icon: "roles" },
  { key: "me", label: "我", icon: "profile" },
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

function useBattery() {
  const [battery, setBattery] = useState({ charging: false, level: 87 });

  useEffect(() => {
    if (!("getBattery" in navigator)) return undefined;

    let batteryManager;
    const updateBattery = () => {
      setBattery({
        charging: Boolean(batteryManager.charging),
        level: Math.round(batteryManager.level * 100),
      });
    };

    navigator
      .getBattery()
      .then((manager) => {
        batteryManager = manager;
        updateBattery();
        manager.addEventListener("chargingchange", updateBattery);
        manager.addEventListener("levelchange", updateBattery);
      })
      .catch(() => undefined);

    return () => {
      if (!batteryManager) return;
      batteryManager.removeEventListener("chargingchange", updateBattery);
      batteryManager.removeEventListener("levelchange", updateBattery);
    };
  }, []);

  return battery;
}

function StatusBar({ clock, battery }) {
  return (
    <div className="status-row">
      <span className="status-time">{clock.time}</span>
      <span className="battery-status" aria-label={`电量 ${battery.level}%`}>
        <span className="battery-shell">
          <span
            className="battery-fill"
            style={{ width: `${Math.min(100, Math.max(0, battery.level))}%` }}
          />
        </span>
        <span>{battery.level}%{battery.charging ? " 充电" : ""}</span>
      </span>
    </div>
  );
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

function SwipeRoleCard({ role, onOpen, onDelete }) {
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
          {role.avatar ? <img src={role.avatar} alt="" /> : <span>{role.name.slice(0, 1) || "角"}</span>}
        </div>
        <div className="role-card-main">
          <small>{role.worldview || "暂无关联世界观"}</small>
          <div className="role-card-head">
            <b>{role.name || "未命名角色"}</b>
            <span>{role.gender || "未填性别"}</span>
          </div>
          <div className="role-card-tags">
            <span>{role.identity || "未填写身份"}</span>
          </div>
          <p>{role.personality || role.persona || role.appearance || "还没有填写角色概况"}</p>
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

function CharacterCreatePage({ initialRole = null, onBack, onSave }) {
  const [draft, setDraft] = useState(() => initialRole || createRoleDraft());
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
    setMessage(`已保存角色：${saved.name}`);
  };

  const generateRole = async () => {
    const keyword = generatorKeyword.trim();
    if (!keyword) {
      setMessage("请先填写角色关键词。");
      return;
    }
    setGeneratingRole(true);
    setMessage("正在生成角色信息...");
    try {
      const store = new ApiConfigStore();
      const config = store.getSelected();
      const prompt = [
        "请根据用户关键词生成一个中文角色设定，用严格 JSON 返回，不要 Markdown，不要解释。",
        "JSON 字段固定为：name, gender, identity, personality, appearance, worldview, persona。",
        "必须只返回一个 JSON 对象，所有字段都必须是字符串，不要嵌套对象。",
        "gender 只能从 女、男、非二元、其他 中选择一个。",
        "worldview 如果没有明确世界观，请填空字符串。",
        "appearance 写 1-2 句外貌与气质。",
        "persona 写 2-4 句人设，包括背景、关系感、说话方式和故事钩子。",
        `关键词：${keyword}`,
      ].join("\n");
      const content = await callWithRetryAndFallback(config, ({ api }) =>
        requestChatCompletion(api, prompt, fetch, { maxTokens: 700 }),
      );
      applyGeneratedRole(content);
      setMessage("角色信息已生成并填入表单。");
    } catch (error) {
      setMessage(`生成失败：${error.message || "请检查 API 设置。"}`);
    } finally {
      setGeneratingRole(false);
    }
  };

  return (
    <section className="page detail-page character-page">
      <Header
        title={initialRole ? "编辑角色" : "新建角色"}
        onBack={onBack}
        action={(
          <button
            className="role-generate-toggle"
            onClick={() => setGeneratorOpen((open) => !open)}
            aria-label="随机生成角色"
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
              placeholder="输入关键词，例如：赛博花店老板"
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
          <img className="role-form-cat" src={assetPath("assets/role-form-cat.png")} alt="" draggable="false" />
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
              <select value={draft.gender} onChange={(event) => updateRole("gender", event.target.value)}>
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
          <button onClick={saveRole}>{initialRole ? "保存修改" : "保存角色"}</button>
        </div>
      </div>
    </section>
  );
}

function RoleDetailPage({ role, onBack, onEdit }) {
  if (!role) {
    return (
      <section className="page detail-page">
        <Header title="角色详情" onBack={onBack} />
        <div className="empty-state compact-empty">
          <div className="mini-mark" />
          <h2>角色不存在</h2>
          <p>这个角色可能已经被删除或数据已刷新。</p>
        </div>
      </section>
    );
  }

  const detailRows = [
    ["性格", role.personality || "未填写"],
    ["容貌", role.appearance || "未填写"],
    ["人设", role.persona || "未填写"],
  ];
  const detailStyle = role.avatar ? { "--role-bg-image": `url(${role.avatar})` } : undefined;

  return (
    <section className="page detail-page character-page role-detail-page" style={detailStyle}>
      <Header
        title="角色预览"
        onBack={onBack}
        action={<button className="role-edit-button" onClick={onEdit}>编辑</button>}
      />
      <div className="role-detail-panel">
        <div className="role-detail-cover">
          <div className="role-detail-name-card">
            <div className="role-detail-title-row">
              <div className="role-inline-avatar">
                {role.avatar ? <img src={role.avatar} alt="" /> : <span>{role.name.slice(0, 1) || "角"}</span>}
              </div>
              <h2>{role.name || "未命名角色"}</h2>
            </div>
            <div className="role-detail-chips">
              <span>性别：{role.gender || "未填写"}</span>
              <span>关联世界观：{role.worldview || "暂无"}</span>
              <span>身份：{role.identity || "未填写"}</span>
            </div>
          </div>
        </div>
        <div className="role-detail-list">
          {detailRows.map(([label, value]) => (
            <article className="role-detail-card" key={label}>
              <span>{label}</span>
              <p>{value}</p>
            </article>
          ))}
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
    <section className="page detail-page">
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
  const [selectedRoleId, setSelectedRoleId] = useState(null);
  const [roleStore] = useState(() => new RoleStore());
  const [roles, setRoles] = useState(() => roleStore.list());
  const clock = useClock();
  const battery = useBattery();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    }
  }, []);

  const selectedRole = useMemo(() => roles.find((role) => role.id === selectedRoleId) || null, [roles, selectedRoleId]);
  const screenStyle = rolePage === "detail" && selectedRole?.avatar ? { "--screen-role-bg-image": `url(${selectedRole.avatar})` } : undefined;

  const content = useMemo(() => {
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
    if (rolePage === "detail") {
      return (
        <RoleDetailPage
          role={selectedRole}
          onBack={() => {
            setRolePage(null);
            setSelectedRoleId(null);
          }}
          onEdit={() => setRolePage("edit")}
        />
      );
    }
    if (rolePage === "edit") {
      return (
        <CharacterCreatePage
          initialRole={selectedRole}
          onBack={() => setRolePage("detail")}
          onSave={(draft) => {
            const saved = roleStore.save(draft);
            setRoles(roleStore.list());
            setSelectedRoleId(saved.id);
            setRolePage("detail");
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
            setRolePage("detail");
          }}
          onDeleteRole={(id) => {
            roleStore.remove(id);
            setRoles(roleStore.list());
            if (selectedRoleId === id) setSelectedRoleId(null);
          }}
        />
      );
    }
    return <SimplePane title={tab === "roles" ? "角色" : "我"} />;
  }, [appPage, clock, rolePage, roleStore, roles, selectedRole, selectedRoleId, settingPage, tab]);

  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }

  return (
    <main className={`screen ${rolePage === "detail" ? "role-preview-screen" : ""}`} style={screenStyle}>
      <StatusBar clock={clock} battery={battery} />
      {appPage ? (
        <button className="floating-back" onClick={() => setAppPage(null)}>
          返回
        </button>
      ) : null}
      {content}
      {!appPage && !settingPage && !rolePage ? <BottomTabs active={tab} setActive={setTab} /> : null}
    </main>
  );
}
