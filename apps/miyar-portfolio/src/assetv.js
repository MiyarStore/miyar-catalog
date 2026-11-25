// رقم نسخة للملفات الثابتة: يتغير مع كل نشر، فالمتصفح ياخذ ملفات CSS وJS الجديدة مباشرة بدل نسخة قديمة من الكاش.
const V = String(process.env.RAILWAY_GIT_COMMIT_SHA || Date.now().toString(36)).slice(0, 10);
const bust = (html) => String(html).replace(/(["'])(\/assets\/[\w.-]+\.(?:css|js))\1/g, (m, q, u) => `${q}${u}?v=${V}${q}`);
module.exports = { V, bust };
