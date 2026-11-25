// عامل خدمة بسيط: يخلي الموقع قابل للتثبيت، ويعرض صفحة بسيطة إذا انقطع النت.
// ما نخزّن بيانات الحساب ولا ردود الـ API، كل شيء يجي من الخادم مباشرة.
const OFFLINE = '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>معياري</title><body style="font-family:Tahoma,Arial;background:#F7F4EE;color:#17232E;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center"><div><h2>ما فيه اتصال بالإنترنت</h2><p>شواهدك محفوظة. ارجع للصفحة أول ما يرجع الاتصال.</p><button onclick="location.reload()" style="background:#0E7C66;color:#fff;border:0;border-radius:10px;padding:10px 22px;font-size:16px">حاول مرة ثانية</button></div></body></html>';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
// إشعارات الجوال: تذكير الشاهد الأسبوعي والتهنئة
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'معياري', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'معياري', { body: d.body || '', icon: '/assets/brand/icon-192.png', badge: '/assets/brand/icon-192.png', dir: 'rtl', lang: 'ar', data: { url: d.url || '/app' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/app';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.includes('/app') && 'focus' in c) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
