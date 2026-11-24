// التقويم الدراسي المعتمد في المملكة بنسختيه: العام لبقية المناطق، والخاص بمكة المكرمة والمدينة المنورة وجدة والطائف.
// كل تاريخ ميلادي بصيغة YYYY-MM-DD، و«to» آخر يوم في الإجازة (شامل).
// ok: true = البداية والنهاية منقولتان من موقع الوزارة أو إدارات التعليم. ok: false = البداية رسمية والنهاية بانتظار التعميم الكامل.
// المصادر:
//  - صورة التقويم الدراسي 1448/1449 الرسمية من وزارة التعليم (من - إلى لكل إجازة)
//  - https://www.moe.gov.sa/ar/education/generaleducation/Pages/academicCalendar.aspx (بدايات الإجازات وبداية ونهاية العام)
//  - https://sites.moe.gov.sa/Qassim/news/news-1136/ (مثال إجازات إضافية تعلنها إدارة التعليم)
//  - توزيع أسابيع الفصل الثاني لمكة والمدينة وجدة والطائف (يطابق بداية الأضحى 23/11 ونهاية العام 26/1/1449)
//  - https://sites.moe.gov.sa/Taif/news/news-1580/ (بداية الدراسة في الطائف 17/3/1448)
const DAY = 86400000;
const P = (s) => Date.parse(`${s}T00:00:00Z`);
const Y = (t) => new Date(t).toISOString().slice(0, 10);

const GENERAL_1448 = {
  terms: [
    { name: 'الفصل الدراسي الأول', start: '2026-08-23', end: '2027-01-07', ok: true },
    { name: 'الفصل الدراسي الثاني', start: '2027-01-17', end: '2027-06-24', ok: true },
  ],
  holidays: [
    { name: 'إجازة اليوم الوطني', from: '2026-09-23', to: '2026-09-26', ok: true },
    { name: 'إجازة الخريف', from: '2026-11-20', to: '2026-11-28', ok: true },
    { name: 'إجازة منتصف العام الدراسي', from: '2027-01-08', to: '2027-01-16', ok: true },
    { name: 'إجازة يوم التأسيس', from: '2027-02-19', to: '2027-02-22', ok: true },
    { name: 'إجازة عيد الفطر', from: '2027-02-26', to: '2027-03-13', ok: true },
    { name: 'إجازة عيد الأضحى', from: '2027-05-07', to: '2027-05-22', ok: true },
  ],
};

// مكة المكرمة والمدينة المنورة وجدة والطائف: تبدأ بعد بقية المناطق بأسبوع، وإجازة الأضحى تبدأ قبلها بأسبوع (موسم الحج)،
// وتنتهي الدراسة بعدها بأسبوع. باقي الإجازات نفسها.
const WEST_1448 = {
  terms: [
    { name: 'الفصل الدراسي الأول', start: '2026-08-30', end: '2027-01-07', ok: true },
    { name: 'الفصل الدراسي الثاني', start: '2027-01-17', end: '2027-07-01', ok: false },
  ],
  holidays: GENERAL_1448.holidays.map((h) => (h.name === 'إجازة عيد الأضحى' ? { ...h, from: '2027-04-30', ok: false } : { ...h })),
};

// الإجازات الإضافية تعلنها كل إدارة تعليم لمنطقتها (حسب التقويم الرسمي)، فالمعلم يضيفها في سجله.
// هذي المعلنة رسمياً ونقدر نعبيها له بضغطة.
const EXTRA_1448 = {
  qassim: { name: 'تعليم القصيم', days: ['2026-10-25', '2026-11-29', '2027-01-07', '2027-04-11'], src: 'https://sites.moe.gov.sa/Qassim/news/news-1136/' },
};

const REGIONS = {
  general: { name: 'بقية مناطق المملكة', short: 'التقويم العام' },
  west: { name: 'مكة المكرمة والمدينة المنورة وجدة والطائف', short: 'تقويم مكة والمدينة وجدة والطائف' },
};
const CAL = { '1448': { general: GENERAL_1448, west: WEST_1448 } };
const CURRENT_YEAR = '1448';

const get = (region, year = CURRENT_YEAR) => (CAL[year] && CAL[year][region]) || null;
const regionKey = (r) => (REGIONS[r] ? r : '');

// الإجازة اللي يقع فيها اليوم (أو null). الجمعة والسبت عطلة أسبوعية وما تحسب هنا.
function holidayOn(region, ds, year, extra = []) {
  const c = get(region, year);
  if (!c) return null;
  const t = P(ds);
  if (extra.includes(ds)) return { name: 'إجازة إضافية', from: ds, to: ds, ok: true };
  return c.holidays.find((h) => t >= P(h.from) && t <= P(h.to)) || null;
}
function termIndex(name = '') { return /الثاني/.test(name) ? 1 : 0; }
function term(region, name, year) { const c = get(region, year); return c ? c.terms[termIndex(name)] : null; }

// أسابيع الفصل من الأحد إلى الخميس، ولكل يوم: تاريخه، وهل هو دراسي، واسم الإجازة إن وجدت.
function weeks(region, name, year, extra = []) {
  const tr = term(region, name, year);
  if (!tr) return [];
  const s0 = P(tr.start) - new Date(P(tr.start)).getUTCDay() * DAY;
  const end = P(tr.end);
  const out = [];
  for (let w = s0, n = 1; w <= end; w += 7 * DAY, n++) {
    const days = [0, 1, 2, 3, 4].map((i) => {
      const ds = Y(w + i * DAY);
      const t = w + i * DAY;
      const h = holidayOn(region, ds, year, extra);
      const inTerm = t >= P(tr.start) && t <= end;
      return { ds, school: inTerm && !h, holiday: h ? h.name : inTerm ? '' : 'خارج الفصل' };
    });
    out.push({ n, from: Y(w), to: Y(w + 4 * DAY), days, off: days.every((d) => !d.school) });
  }
  return out;
}
// ملخص للفصل: البداية، عدد الأسابيع، أسابيع الإجازة، وعدد الأيام الدراسية.
function summary(region, name, year, extra = []) {
  const tr = term(region, name, year);
  if (!tr) return null;
  const ws = weeks(region, name, year, extra);
  return { region, regionName: REGIONS[region].name, term: tr.name, start: tr.start, end: tr.end, weeks: ws.length, off: ws.filter((w) => w.off).map((w) => w.n), schoolDays: ws.reduce((a, w) => a + w.days.filter((d) => d.school).length, 0), ok: tr.ok };
}
// الفصل الحالي حسب تاريخ اليوم (بعد نهاية الأول نعتبره الثاني)
function currentTerm(region = 'general', year) { const c = get(region, year); if (!c) return 'الفصل الدراسي الأول'; const now = Date.now(); return now > P(c.terms[0].end) + DAY ? c.terms[1].name : c.terms[0].name; }
// للواجهة: التقويمات المتاحة
function options() { return Object.entries(REGIONS).map(([key, r]) => ({ key, name: r.name, short: r.short, currentTerm: currentTerm(key) })); }
const extras = (year = CURRENT_YEAR) => (year === '1448' ? Object.entries(EXTRA_1448).map(([key, x]) => ({ key, ...x })) : []);
// للعرض: كل الإجازات مع حالة التوثيق
function list(region, year) { const c = get(region, year); return c ? { terms: c.terms, holidays: c.holidays } : null; }

const hijri = (ds) => { try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(P(ds))); } catch { return ''; } };

module.exports = { extras, options, currentTerm, REGIONS, CURRENT_YEAR, regionKey, holidayOn, term, weeks, summary, list, hijri };
