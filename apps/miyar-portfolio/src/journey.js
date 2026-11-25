// رحلة السنة الدراسية: نوزّع عناصر التقييم على أسابيع السنة حسب توقيتها الطبيعي،
// ونعرف وش المستحق الحين، ووش الجاي، ومتى يكتمل الملف. منها تطلع التذكيرات والتهنئة.
const CAL = require('./calendar');
const { forRole } = require('./standards');
const COV = require('./coverage');

const DAY = 86400000;
const P = (s) => Date.parse(`${s}T00:00:00Z`);

// ترتيب العناصر حسب وقتها المناسب في السنة (للمعلم): التخطيط والبيئة الصفية أول السنة،
// بعدها التشخيص والتواصل والاستراتيجيات، وتحسين النتائج آخر شي لأنه يحتاج نتائج قبل وبعد.
const ORDER = [6, 8, 9, 1, 10, 3, 4, 7, 11, 2, 5];
const rank = (id, i) => { const r = ORDER.indexOf(id); return r >= 0 ? r : 20 + i; };

// نافذة التوثيق: من الأسبوع الثالث في الفصل الأول، إلى قبل نهاية السنة بأربعة أسابيع.
function window_(region) {
  const r = CAL.regionKey(region) || 'general';
  const t1 = CAL.term(r, 'الفصل الدراسي الأول');
  const t2 = CAL.term(r, 'الفصل الدراسي الثاني');
  if (!t1 || !t2) return null;
  return { from: P(t1.start) + 14 * DAY, to: P(t2.end) - 28 * DAY, yearEnd: P(t2.end) };
}

// يرجع خطة الرحلة لمستخدم: لكل عنصر موعد مقترح وحالته.
// since: تاريخ تسجيل المستخدم. اللي يسجّل في نص السنة ما نحسب عليه عناصر "متأخرة"؛ نوزّع الخطة من أسبوع بعد تسجيله.
function plan({ role, region, counts = {}, now = Date.now(), since = 0 }) {
  const list = forRole(role).map((s, i) => ({ s, i })).sort((a, b) => rank(a.s.id, a.i) - rank(b.s.id, b.i)).map((x) => x.s);
  const w = window_(region);
  if (w && since) w.from = Math.min(Math.max(w.from, since + 7 * DAY), w.to - 28 * DAY);
  const n = list.length;
  const items = list.map((s, i) => {
    const due = w ? Math.round(w.from + ((w.to - w.from) * (i + 1)) / n) : null;
    const done = (counts[s.id] || 0) > 0;
    const parts = COV.partsOf(s.id, role) || [];
    const tip = (parts.find((p) => p.ev && p.ev.length) || {}).ev;
    return { id: s.id, name: s.name, weight: s.weight, due, done, tip: tip ? tip[0] : '' };
  });
  const open = items.filter((x) => !x.done);
  const late = open.filter((x) => x.due && x.due < now);
  const soon = open.filter((x) => x.due && x.due >= now && x.due < now + 14 * DAY);
  // مهمة هذا الأسبوع: أقدم متأخر، وإلا أقرب مستحق، وإلا أول عنصر ناقص.
  const focus = late[0] || soon[0] || open[0] || null;
  const doneN = items.length - open.length;
  return {
    total: items.length,
    done: doneN,
    pct: items.length ? Math.round((doneN / items.length) * 100) : 0,
    complete: items.length > 0 && open.length === 0,
    focus,
    late: late.length,
    items,
    finishBy: w ? w.to : null,
    started: w ? now >= w.from - 7 * DAY : true,
  };
}

// نص التذكير الأسبوعي (يستخدم في الإشعار داخل التطبيق والجوال)
function weeklyMessage(p, gender = 'm') {
  if (p.complete) return null;
  const f = p.focus;
  if (!f) return null;
  const you = gender === 'f' ? 'وثّقي' : 'وثّق';
  const title = p.late > 1 ? `عندك ${p.late} عناصر متأخرة في ملفك` : `حان وقت توثيق «${f.name}»`;
  const body = `${you} شاهد لـ «${f.name}»${f.tip ? `، مثل: ${f.tip}` : ''}. ملفك الحين ${p.pct}% (${p.done} من ${p.total}).`;
  return { title, body, url: `/app#/new?std=${f.id}` };
}

function completeMessage(gender = 'm') {
  return {
    title: gender === 'f' ? 'مبروك، ملف إنجازك اكتمل' : 'مبروك، ملف إنجازك اكتمل',
    body: 'كل عناصر التقييم عليها شواهد. تقدر الحين تطبع ملفك كامل أو تشارك رابطه مع مديرك.',
    url: '/app#/',
  };
}

module.exports = { plan, weeklyMessage, completeMessage, ORDER };
