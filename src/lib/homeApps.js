export const HOME_APP_PAGE_SIZE = 12;

export const HOME_APP_ITEMS = [
  { key: "chat", label: "微聊", icon: "assets/app-icons/chat.png" },
  { key: "forum", label: "论坛", icon: "assets/app-icons/forum.png" },
  { key: "rednote", label: "小红书", icon: "assets/app-icons/rednote.png" },
  { key: "wallet", label: "钱包", icon: "assets/app-icons/wallet.png" },
  { key: "game", label: "游戏", icon: "assets/app-icons/game.png" },
  { key: "beauty", label: "美化", icon: "assets/app-icons/beauty.png" },
  { key: "world", label: "世界书", icon: "assets/app-icons/world.png" },
  { key: "preset", label: "预设", icon: "assets/app-icons/preset.png" },
  { key: "food", label: "外卖", icon: "assets/app-icons/food.png" },
  { key: "outing", label: "外出", icon: "assets/app-icons/outing.png" },
  { key: "diary", label: "日记", icon: "assets/app-icons/diary.png" },
  { key: "couple", label: "情侣空间", icon: "assets/app-icons/couple.png" },
  { key: "work", label: "工作", icon: "assets/app-icons/work.png" },
  { key: "parallel", label: "平行时空", icon: "assets/app-icons/parallel.png" },
  { key: "phonecheck", label: "查手机", icon: "assets/app-icons/phonecheck.png" },
  { key: "weibo", label: "微博", icon: "assets/app-icons/weibo.png" },
  { key: "schedule", label: "日程", icon: "assets/app-icons/schedule.png" },
  { key: "event", label: "特别活动", icon: "assets/app-icons/event.png" },
  { key: "business", label: "经营", icon: "assets/app-icons/business.png" },
];

export function getHomeAppPages(basePath = "") {
  const normalizedBase = basePath ? basePath.replace(/\/?$/, "/") : "";
  const items = HOME_APP_ITEMS.map((item) => ({
    ...item,
    icon: `${normalizedBase}${item.icon}`,
  }));
  const pages = [];
  for (let index = 0; index < items.length; index += HOME_APP_PAGE_SIZE) {
    pages.push(items.slice(index, index + HOME_APP_PAGE_SIZE));
  }
  return pages;
}
