const CACHE_NAME = "e-phone-pink-pwa-v12";
const ASSETS = [
  "./",
  "manifest.webmanifest",
  "assets/pwa-icon.svg",
  "assets/pink-cat-home-wallpaper-clean.png",
  "assets/pink-lockscreen-wallpaper.png",
  "assets/app-icons/chat.png",
  "assets/app-icons/forum.png",
  "assets/app-icons/rednote.png",
  "assets/app-icons/wallet.png",
  "assets/app-icons/game.png",
  "assets/app-icons/beauty.png",
  "assets/app-icons/world.png",
  "assets/app-icons/preset.png",
  "assets/app-icons/food.png",
  "assets/app-icons/outing.png",
  "assets/app-icons/diary.png",
  "assets/app-icons/couple.png",
  "assets/settings-wallpaper-cat-action.png",
  "assets/slider-cat-thumb.png",
  "assets/settings-icons/api.png",
  "assets/settings-icons/sound.png",
  "assets/settings-icons/image.png",
  "assets/settings-icons/appearance.png",
  "assets/settings-icons/time.png",
  "assets/settings-icons/notice.png",
  "assets/settings-icons/data.png",
  "assets/settings-icons/system.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
