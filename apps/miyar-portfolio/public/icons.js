/* معياري: أيقونات خطية موحدة بدل الإيموجي (تشتغل في المتصفح وفي الخادم) */
(function (root) {
  const p = (...ds) => ds.map((d) => `<path d="${d}"/>`).join('');
  const c = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`;
  const I = {
    home: p('M4 11l8-7 8 7v9h-5v-6H9v6H4z'),
    plus: p('M12 5v14M5 12h14'),
    book: p('M4 19.5V5a2 2 0 012-2h13v16H6a2 2 0 00-2 2.5zM8 7h7'),
    doc: p('M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h4'),
    edit: p('M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4'),
    folder: p('M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z'),
    user: c(12, 8, 4) + p('M4 21a8 8 0 0116 0'),
    users: c(9, 8, 3.5) + p('M2.5 20a6.5 6.5 0 0113 0M16 4.6a3.5 3.5 0 010 6.8M18 14.2a6 6 0 013.5 5.8'),
    star: p('M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z'),
    tool: p('M14.7 6.3a4 4 0 00-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 005.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z'),
    sliders: p('M4 7h9M17 7h3M4 17h3M11 17h9') + c(15, 7, 2) + c(9, 17, 2),
    moon: p('M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z'),
    clock: c(12, 12, 9) + p('M12 7v5l3 2'),
    calendar: p('M5 5h14v16H5zM9 3v4M15 3v4M5 10h14'),
    target: c(12, 12, 9) + c(12, 12, 5) + c(12, 12, 1),
    up: p('M12 19V5M6 11l6-6 6 6'),
    down: p('M12 5v14M6 13l6 6 6-6'),
    sparkle: p('M11 3l1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8zM18.5 15l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z'),
    bell: p('M6 16v-5a6 6 0 0112 0v5l2 2H4zM10 21h4'),
    megaphone: p('M3 10v4h3l8 5V5L6 10zM18 9a4 4 0 010 6'),
    link: p('M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1'),
    printer: p('M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z'),
    puzzle: p('M10 4.5a2 2 0 114 0V6h4v4h-1.5a2 2 0 100 4H18v4h-4v-1.5a2 2 0 10-4 0V18H6v-4h1.5a2 2 0 100-4H6V6h4z'),
    ok: c(12, 12, 9) + p('M8 12.5l2.7 2.7L16 9.8'),
    check: p('M5 12.5l4.5 4.5L19 7'),
    bulb: p('M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z'),
    pin: p('M9 3h6l-1 6 3 3.5H7L10 9zM12 12.5V21'),
    clip: p('M20 11.5l-8.5 8.5a5 5 0 01-7-7L13 4.5a3.5 3.5 0 015 5L9.5 18a2 2 0 01-3-3L14 7.5'),
    lock: p('M5.5 11h13v10h-13zM8.5 11V8a3.5 3.5 0 017 0v3'),
    save: p('M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6'),
    ban: c(12, 12, 9) + p('M5.6 5.6l12.8 12.8'),
    cart: p('M3 4h2l2.4 11h10.2L20 8H6.2') + c(9.5, 19.5, 1.2) + c(16.5, 19.5, 1.2),
    bars: p('M4 20h16M7 16v-5M12 16V7M17 16v-8'),
    trend: p('M4 19h16M5 15l4-4 3 3 7-7M15 7h4v4'),
    chat: p('M4 5h16v11H9l-5 4z'),
    sun: c(12, 12, 4) + p('M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'),
    alert: p('M12 9v4M12 16.5v.5M10.3 4.5L2.6 18a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 4.5a2 2 0 00-3.4 0z'),
    x: p('M6 6l12 12M18 6L6 18'),
    trash: p('M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'),
    ruler: p('M3 17l4 4L21 7l-4-4zM7 13l2 2M10 10l2 2M13 7l2 2'),
    refresh: p('M20 11a8 8 0 00-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0014.3 4.9L20 16M20 20v-4h-4'),
    school: p('M3 21h18M5 21V10l7-5 7 5v11M10 21v-5h4v5'),
    screen: p('M3 5h18v11H3zM8 20h8M12 16v4'),
    bolt: p('M13 3L5 14h6l-1 7 8-11h-6z'),
    qr: p('M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18v2M18 14h2'),
    mail: p('M3 6h18v12H3zM3 7l9 6 9-6'),
    phone: p('M5 4h4l2 5-3 2a11 11 0 005 5l2-3 5 2v4a2 2 0 01-2 2A17 17 0 013 6a2 2 0 012-2z'),
    shield: p('M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z'),
    flag: p('M5 21V4M5 4h12l-2 4 2 4H5'),
    compass: c(12, 12, 9) + p('M15.5 8.5l-2 5-5 2 2-5z'),
    search: c(11, 11, 7) + p('M20 20l-4-4'),
    heart: p('M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z'),
    palette: p('M12 3a9 9 0 100 18c1.1 0 1.5-.9 1-1.8-.6-1-.1-2.2 1.1-2.2H17a4 4 0 004-4c0-5.5-4-10-9-10z') + c(7.5, 11, 1) + c(10, 7, 1) + c(15, 7.5, 1),
    leaf: p('M5 19c0-8 5-13 14-14 0 9-5 14-13 14zM5 19l7-7'),
    flask: p('M9 3h6M10 3v6L4.5 19a1.5 1.5 0 001.3 2h12.4a1.5 1.5 0 001.3-2L14 9V3M7 15h10'),
    box: p('M3 7.5L12 3l9 4.5v9L12 21l-9-4.5zM3 7.5L12 12l9-4.5M12 12v9'),
    cap: p('M2 9l10-5 10 5-10 5zM6 11v5c3 2.5 9 2.5 12 0v-5M22 9v6'),
    copy: p('M8 8h12v12H8zM4 16V4h12'),
    out: p('M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10'),
    arrow: p('M15 6l-6 6 6 6'),
    eye: p('M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z') + c(12, 12, 3),
  };
  const E = {
    '🌙': 'moon', '🏠': 'home', '➕': 'plus', '📚': 'book', '📝': 'edit', '🗂': 'folder', '📁': 'folder', '👤': 'user', '⭐': 'star', '🌟': 'star', '🏅': 'star', '🎉': 'star',
    '🛠': 'tool', '🏗': 'tool', '⚙': 'sliders', '⏳': 'clock', '🎯': 'target', '⬆': 'up', '⬇': 'down', '✨': 'sparkle', '🤖': 'sparkle', '🔔': 'bell', '📣': 'megaphone',
    '🔗': 'link', '🖨': 'printer', '🧩': 'puzzle', '✅': 'ok', '✔': 'check', '💡': 'bulb', '📄': 'doc', '📋': 'doc', '📘': 'book', '📖': 'book', '✏': 'edit', '✍': 'edit',
    '📌': 'pin', '📎': 'clip', '🔒': 'lock', '💾': 'save', '⛔': 'ban', '🚫': 'ban', '🛒': 'cart', '🗓': 'calendar', '📅': 'calendar', '📊': 'bars', '📈': 'trend',
    '👥': 'users', '🤝': 'users', '👨‍👩‍👦': 'users', '👨‍👩‍👧': 'users', '💬': 'chat', '🏖': 'sun', '⚠': 'alert', '🔥': 'alert', '✖': 'x', '🗑': 'trash', '📐': 'ruler',
    '🔄': 'refresh', '🔁': 'refresh', '🌀': 'refresh', '🔀': 'refresh', '🏫': 'school', '🏡': 'school', '🏟': 'school', '📺': 'screen', '💻': 'screen', '🎞': 'screen',
    '⚡': 'bolt', '🔳': 'qr', '⬜': 'qr', '📨': 'mail', '📞': 'phone', '🛡': 'shield', '🦺': 'shield', '🚀': 'flag', '🧭': 'compass', '🗺': 'compass', '🔎': 'search',
    '🩺': 'heart', '🧼': 'heart', '🤲': 'heart', '🧑‍⚕': 'heart', '🎨': 'palette', '🎭': 'palette', '🌱': 'leaf', '🔬': 'flask', '🧪': 'flask', '⚗': 'flask', '📦': 'box', '🎓': 'cap',
  };
  const RE = /\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*/gu;
  const key = (e) => e.replace(/️/g, '');
  const ico = (name, size = 20, cls = '') => `<svg class="ico${cls ? ' ' + cls : ''}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || I.doc}</svg>`;
  const nameOf = (emoji) => E[key(emoji)] || null;
  // أيقونة من إيموجي مخزّن في البيانات (مثل أيقونات العناصر)
  const icoFor = (emoji, size, cls) => ico(nameOf(emoji) || 'doc', size, cls);
  // حذف الإيموجي من نص عادي (رسائل التنبيه وخيارات القوائم)
  const strip = (s) => String(s ?? '').replace(RE, (m) => (nameOf(m) ? '' : m)).replace(/^\s+/, '').replace(/\s{2,}/g, ' ');
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'TITLE', 'CODE', 'PRE']);
  // تحويل الإيموجي داخل واجهة مرسومة إلى أيقونات خطية
  function iconize(rootEl) {
    if (!rootEl || typeof document === 'undefined') return;
    const w = document.createTreeWalker(rootEl, 4);
    const hits = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const m = n.nodeValue.match(RE);
      if (m && m.some(nameOf)) hits.push(n);
    }
    for (const n of hits) {
      const par = n.parentNode;
      if (!par || SKIP.has(par.nodeName) || par.closest('[data-raw],svg,[contenteditable="true"]')) continue;
      if (par.nodeName === 'OPTION') { n.nodeValue = strip(n.nodeValue); continue; }
      const html = n.nodeValue.replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]))
        .replace(RE, (m) => { const k = nameOf(m); return k ? ico(k, 18, 'ie') : m; });
      const t = document.createElement('template');
      t.innerHTML = html;
      par.replaceChild(t.content, n);
    }
  }
  // شعار معياري: دائرة نعناعية وعلامة صح كحلية
  const logo = (size = 34) => `<svg width="${size}" height="${size}" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="112" fill="#0E7C66"/><g transform="translate(256 226) scale(1.45) translate(-1285 -446)"><path fill="#FFFFFF" fill-rule="evenodd" d="M1180 341H1390V551H1180ZM1244 405V486H1325V405Z"/></g><path d="M104 404H408" stroke="#E6CF9A" stroke-width="26" stroke-linecap="butt"/></svg>`;
  // نفس التحويل لكن على نص HTML (للصفحات اللي يرسمها الخادم)
  const iconizeHtml = (html, size = 20) => String(html).replace(RE, (m) => { const k = nameOf(m); return k ? ico(k, size, 'ie') : m; });
  const api = { iconizeHtml, logo, ico, icoFor, nameOf, strip, iconize, ICONS: I };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MI = api;
})(typeof window !== 'undefined' ? window : this);
