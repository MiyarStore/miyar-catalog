/* «اسأل معياري» وزر واتساب: يظهران في كل صفحات معياري */
(function () {
  if (window.__miyarHelp) return; window.__miyarHelp = 1;
  const KEY = 'miyar-help-chat';
  let wa = 'https://wa.me/966509896261';
  let busy = false;
  let hist = [];
  try { hist = JSON.parse(sessionStorage.getItem(KEY) || '[]'); } catch { hist = []; }
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(hist.slice(-20))); } catch {} };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (s) => esc(s).replace(/(https?:\/\/[^\s<]+[^\s<.,،)])/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\//, '').replace(/\?.*$/, '').slice(0, 42)}</a>`).replace(/\n/g, '<br>');
  const svg = (d, w = 22) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const I = {
    chat: svg('<path d="M4 5h16v11H9l-5 4z"/><path d="M9 10.5h.01M12 10.5h.01M15 10.5h.01" stroke-width="2.6"/>'),
    wa: `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2A9.8 9.8 0 003.6 17l-1.3 4.8 4.9-1.3A9.8 9.8 0 1012 2.2zm0 17.8a8 8 0 01-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1112 20zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.6 6.6 0 01-3.3-2.9c-.2-.4.3-.4.8-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 00-.6.3 2.7 2.7 0 00-.9 2 4.7 4.7 0 001 2.5 10.8 10.8 0 004.1 3.6c1.5.7 2.1.7 2.9.6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.4-.3z"/></svg>`,
    x: svg('<path d="M6 6l12 12M18 6L6 18"/>', 20),
    send: svg('<path d="M20 12L4 4l3 8-3 8z"/><path d="M7 12h6"/>', 20),
  };
  const css = `.mh-dock{position:fixed;z-index:60;left:16px;bottom:20px;display:flex;flex-direction:column;gap:10px;align-items:flex-start;font-family:'Readex Pro','IBM Plex Sans Arabic',Tahoma,sans-serif}
.mh-fab{display:flex;align-items:center;gap:8px;height:54px;min-width:54px;padding:0 16px;border-radius:999px;border:0;cursor:pointer;font:inherit;font-weight:600;font-size:14.5px;box-shadow:0 8px 24px rgba(11,27,43,.22);text-decoration:none;transition:transform .15s}
.mh-fab:hover{transform:translateY(-2px)}.mh-ai{background:#3DDBB0;color:#0B1B2B}.mh-ai svg{color:#0B1B2B}.mh-wa{background:#25D366;color:#fff;padding:0;justify-content:center;width:54px}
@media(max-width:860px){.mh-ai span{display:none}.mh-ai{padding:0;width:54px;justify-content:center}body:has(.bnav) .mh-dock{bottom:96px}}
.mh-panel{position:fixed;z-index:70;left:16px;bottom:20px;width:380px;max-width:calc(100vw - 32px);height:min(600px,calc(100vh - 40px));background:#fff;color:#0B1B2B;border-radius:24px;box-shadow:0 24px 60px rgba(11,27,43,.3);display:none;flex-direction:column;overflow:hidden;font-family:'Readex Pro','IBM Plex Sans Arabic',Tahoma,sans-serif;direction:rtl}
.mh-panel.on{display:flex}.mh-hd{background:#0B1B2B;color:#fff;padding:16px 18px;display:flex;gap:12px;align-items:center}
.mh-hd b{display:block;font-size:16px;font-weight:600}.mh-hd small{display:block;color:#B7C4D1;font-size:12.5px}.mh-hd button{margin-inline-start:auto;background:#132A40;border:0;color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;display:grid;place-items:center}
.mh-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#F3F5F8}
.mh-m{max-width:86%;padding:10px 14px;border-radius:18px;font-size:14.5px;line-height:1.75;word-wrap:break-word}.mh-m a{color:#0A7B67;font-weight:600}
.mh-b{background:#fff;border:1px solid #E2E8EF;align-self:flex-start;border-start-start-radius:6px}.mh-u{background:#0B1B2B;color:#fff;align-self:flex-end;border-start-end-radius:6px}
.mh-chips{display:flex;flex-wrap:wrap;gap:8px}.mh-chips button{border:1px solid #C9D3DE;background:#fff;border-radius:999px;padding:7px 13px;font:inherit;font-size:13px;color:#0B1B2B;cursor:pointer}.mh-chips button:hover{border-color:#0B1B2B}
.mh-dots{display:inline-flex;gap:4px}.mh-dots i{width:7px;height:7px;border-radius:50%;background:#8FA3B6;animation:mhd 1s infinite}.mh-dots i:nth-child(2){animation-delay:.15s}.mh-dots i:nth-child(3){animation-delay:.3s}@keyframes mhd{50%{opacity:.25}}
.mh-ft{padding:12px;border-top:1px solid #E2E8EF;background:#fff}.mh-f{display:flex;gap:8px}.mh-f input{flex:1;min-width:0;border:1px solid #C9D3DE;border-radius:999px;padding:11px 16px;font:inherit;font-size:16px;color:#0B1B2B;background:#fff}
.mh-f input:focus{outline:2px solid #3DDBB0;border-color:transparent}.mh-f button{flex:none;width:46px;height:46px;border-radius:50%;border:0;background:#3DDBB0;color:#0B1B2B;cursor:pointer;display:grid;place-items:center}.mh-f button:disabled{opacity:.5}
.mh-note{font-size:11.5px;color:#5B6B7C;margin-top:8px;text-align:center}.mh-note a{color:#0A7B67;font-weight:600}
@media(max-width:560px){.mh-panel{left:0;right:0;bottom:0;width:100%;max-width:none;height:min(88vh,640px);border-radius:24px 24px 0 0}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  const logo = '<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="17" fill="#3DDBB0"/><path d="M10 18l5 5 9-11" fill="none" stroke="#0B1B2B" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SUGG = ['كم أسعار الاشتراك؟', 'كيف أفعّل اشتراكي؟', 'وش الوظائف اللي يدعمها؟', 'هل يفيد قائد المدرسة؟'];
  const dock = document.createElement('div'); dock.className = 'mh-dock';
  dock.innerHTML = `<button type="button" class="mh-fab mh-ai" aria-label="اسأل معياري">${I.chat}<span>اسأل معياري</span></button><a class="mh-fab mh-wa" target="_blank" rel="noopener" aria-label="تواصل معنا واتساب" title="تواصل معنا واتساب">${I.wa}</a>`;
  const panel = document.createElement('section'); panel.className = 'mh-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'اسأل معياري');
  panel.innerHTML = `<div class="mh-hd">${logo}<div><b>اسأل معياري</b><small>يجاوبك على طول عن التطبيق والاشتراك</small></div><button type="button" aria-label="إغلاق">${I.x}</button></div>
    <div class="mh-body" aria-live="polite"></div>
    <div class="mh-ft"><form class="mh-f"><input name="q" maxlength="500" autocomplete="off" placeholder="اكتب سؤالك هنا" aria-label="سؤالك"><button aria-label="إرسال">${I.send}</button></form>
    <div class="mh-note">إجابات آلية من معلومات معياري. تبي تكلم شخص؟ <a class="mh-wal" target="_blank" rel="noopener">واتساب</a></div></div>`;
  const mount = () => { document.body.appendChild(dock); document.body.appendChild(panel); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
  const body = panel.querySelector('.mh-body'); const form = panel.querySelector('form'); const inp = form.q;
  const setWa = () => { dock.querySelector('.mh-wa').href = wa; panel.querySelector('.mh-wal').href = wa; };
  setWa();
  fetch('/api/help').then((r) => r.json()).then((d) => { if (d.wa) { wa = d.wa; setWa(); } }).catch(() => {});
  function draw(pending) {
    body.innerHTML = `<div class="mh-m mh-b">هلا والله! أنا مساعد معياري. اسألني عن التطبيق ومزاياه والأسعار وطريقة الاشتراك.</div>`
      + (hist.length ? '' : `<div class="mh-chips">${SUGG.map((s) => `<button type="button">${esc(s)}</button>`).join('')}</div>`)
      + hist.map((m) => `<div class="mh-m ${m.role === 'user' ? 'mh-u' : 'mh-b'}">${m.role === 'user' ? esc(m.content) : fmt(m.content)}</div>`).join('')
      + (pending ? '<div class="mh-m mh-b"><span class="mh-dots"><i></i><i></i><i></i></span></div>' : '');
    body.scrollTop = body.scrollHeight;
  }
  async function ask(q) {
    q = String(q || '').trim(); if (!q || busy) return;
    busy = true; form.querySelector('button').disabled = true;
    hist.push({ role: 'user', content: q.slice(0, 500) }); save(); draw(true);
    try {
      const r = await fetch('/api/help', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: hist.slice(-8) }) });
      const d = await r.json().catch(() => ({}));
      hist.push({ role: 'assistant', content: d.text || d.error || 'صار خطأ، جرّب مرة ثانية أو كلمنا واتساب.' });
    } catch { hist.push({ role: 'assistant', content: 'ما قدرت أوصل للخادم. تأكد من الاتصال أو كلمنا واتساب.' }); }
    save(); busy = false; form.querySelector('button').disabled = false; draw(false);
  }
  const open = () => { panel.classList.add('on'); dock.style.display = 'none'; draw(false); setTimeout(() => inp.focus(), 50); };
  const close = () => { panel.classList.remove('on'); dock.style.display = ''; };
  dock.querySelector('.mh-ai').onclick = open;
  panel.querySelector('.mh-hd button').onclick = close;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('on')) close(); });
  body.addEventListener('click', (e) => { const b = e.target.closest('.mh-chips button'); if (b) ask(b.textContent); });
  form.onsubmit = (e) => { e.preventDefault(); const q = inp.value; inp.value = ''; ask(q); };
})();
