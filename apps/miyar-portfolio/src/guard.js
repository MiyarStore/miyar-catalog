// حماية من التخمين: عدّاد محاولات في الذاكرة لكل مفتاح (بريد أو عنوان IP) خلال نافذة زمنية.
const buckets = new Map();

function check(key, max, windowMs, now = Date.now()) {
  const b = buckets.get(key);
  if (!b || now - b.start >= windowMs) return { ok: true };
  if (b.n >= max) return { ok: false, retryMin: Math.max(1, Math.ceil((b.start + windowMs - now) / 60000)) };
  return { ok: true };
}
function hit(key, windowMs, now = Date.now()) {
  const b = buckets.get(key);
  if (!b || now - b.start >= windowMs) buckets.set(key, { start: now, n: 1 });
  else b.n += 1;
}
const clear = (key) => buckets.delete(key);

// تنظيف دوري للمفاتيح القديمة عشان الذاكرة ما تكبر
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now - b.start > 6 * 3600000) buckets.delete(k);
}, 30 * 60000).unref();

const tooMany = (r) => `محاولات كثيرة. جرّب بعد ${r.retryMin} ${r.retryMin <= 10 && r.retryMin > 2 ? 'دقائق' : 'دقيقة'}.`;

module.exports = { check, hit, clear, tooMany, _buckets: buckets };
