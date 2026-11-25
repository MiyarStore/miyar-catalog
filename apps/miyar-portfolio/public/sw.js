// عامل خدمة بسيط: يخلي الموقع قابل للتثبيت، ويعرض صفحة بسيطة إذا انقطع النت.
// ما نخزّن بيانات الحساب ولا ردود الـ API، كل شيء يجي من الخادم مباشرة.
const OFFLINE = '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>معياري</title><body style="font-family:Tahoma,Arial;background:#F7F4EE;color:#17232E;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center"><div><h2>ما فيه اتصال بالإنترنت</h2><p>شواهدك محفوظة. ارجع للصفحة أول ما يرجع الاتصال.</p><button onclick="location.reload()" style="background:#0E7C66;color:#fff;border:0;border-radius:10px;padding:10px 22px;font-size:16px">حاول مرة ثانية</button></div></body></html>';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(fetch(e.request).catch(() => new Response(OFFLINE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })));
});
