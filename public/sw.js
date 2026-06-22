const CACHE_NAME = "e-phone-pink-pwa-v48";
const ASSETS = [
  "manifest.webmanifest",
  "version.json",
  "assets/pwa-icon.svg",
  "assets/pink-cat-home-wallpaper-clean.png",
  "assets/pink-cat-home-wallpaper.png",
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
  "assets/settings-icons/system.png",
  "assets/role-create-clean-a-nocat.png",
  "assets/identity-create-bg.png",
  "assets/identity-form-cat.png",
  "assets/role-create-clean-a.png",
  "assets/role-create-hero-a.png",
  "assets/role-create-hero.png",
  "assets/role-create-reference-a.png",
  "assets/role-detail-magazine-bg.png",
  "assets/role-detail-pet-soft-bg.png",
  "assets/role-detail-scheme-b-frames.png",
  "assets/role-form-cat.png",
  "assets/role-preview-pink-wallpaper.png",
  "assets/settings-wallpaper-bunny-soft.png",
  "assets/settings-wallpaper-bunny.png",
  "assets/settings-wallpaper-card-cat.png",
  "assets/settings-wallpaper-cat-comic.png",
  "assets/settings-wallpaper-integrated-cat.png",
  "assets/settings-wallpaper-lie-cat.png",
  "assets/settings-wallpaper-title-cat.png",
  "assets/settings-wallpaper.png",
  "assets/slider-cat-thumb-source.png",
  "assets/slider-cat-thumb-transparent.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(ASSETS.map((asset) => cache.add(asset))),
    ),
  );
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

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isImage =
    event.request.destination === "image" ||
    (isSameOrigin && /\.(png|jpe?g|webp|svg)$/i.test(requestUrl.pathname));

  if (isImage) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        });
      }),
    );
    return;
  }

  if (event.request.mode === "navigate" || ["script", "style"].includes(event.request.destination)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
