/* 운동일지 서비스 워커: 오프라인 실행 + 홈 화면 앱 */
const VER = "wl-2.0.0";
const SHELL = ["./", "./index.html", "./catalog.js", "./data/tips.json", "./manifest.webmanifest", "./apple-touch-icon.png", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/maskable-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VER).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VER).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // 폰트 CDN·Apps Script·노션은 그대로 네트워크
  // 앱 셸: 네트워크 우선(새 버전 빨리 반영), 실패하면 캐시
  e.respondWith(
    fetch(req).then((res) => { if (res && res.ok) { const copy = res.clone(); caches.open(VER).then((c) => c.put(req, copy)); } return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === "navigate" ? caches.match("./index.html") : undefined)))
  );
});
