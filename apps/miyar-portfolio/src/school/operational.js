// الخطة التشغيلية للمدرسة: تُشتق من تقرير التقويم وخطة التحسين وخطة نافس، ولا تنسخ بياناتها.
// البرامج = صفوف خطة التحسين (متابعتها وإسنادها مشترك)، + برامج نافس العلاجية، + برنامج استدامة التميز.
// المدير يعدّل: الرؤية والرسالة، تحليل SWOT، واسم البرنامج ونوعه ومؤشر قياسه وميزانيته. التعديلات تُحفظ منفصلة (overrides).
const { DOMAINS, STANDARDS, levelOf } = require('./indicators');
const { procs, progress } = require('./export');
const { lateDays, stateOf } = require('./track');
const withTrack = (x) => ({ ...x, late: lateDays(x), state: stateOf(x) });

const TYPES = {
  remedial: { name: 'علاجي', color: '#d33a2c' },
  preventive: { name: 'وقائي', color: '#d9690a' },
  developmental: { name: 'تطويري', color: '#1a6fe0' },
  enrichment: { name: 'إثرائي', color: '#0b8f55' },
};
const PREVENTIVE = ['4-2', '1-5', '3-2'];
const r1 = (n) => Math.round(n * 10) / 10;
const avg = (xs) => (xs.length ? r1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
const ceil5 = (n) => Math.ceil(n / 5) * 5;
const short = (t, n = 70) => { const s = String(t || '').trim(); return s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, '')}…` : s; };

// أسماء مختصرة للبرامج حسب المؤشر (يعدّلها المدير)
const NAMES = {
  '1-1-1-1': 'بناء الخطة التشغيلية', '1-1-1-2': 'متابعة تنفيذ الخطة التشغيلية', '1-2-1-1': 'القيم والهوية الوطنية', '1-2-1-2': 'أخلاقيات مهنة التعليم',
  '1-2-1-3': 'الانضباط المدرسي', '1-2-1-4': 'تعزيز السلوك الإيجابي', '1-2-1-5': 'رعاية المواهب والإثراء', '1-3-1-1': 'المناخ المدرسي والعلاقات الإيجابية',
  '1-3-1-2': 'الشراكة مع الأسرة', '1-3-1-3': 'الشراكة المجتمعية', '1-4-1-1': 'دعم الرخصة المهنية', '1-4-1-2': 'التطوير المهني للمنسوبين',
  '1-4-1-3': 'التقويم الذاتي المستمر', '1-4-1-4': 'تنفيذ خطة التحسين ومتابعتها', '1-5-1-1': 'حقوق المتعلمين وحمايتهم', '1-5-1-2': 'البيئة الآمنة نفسياً واجتماعياً',
  '2-1-1-1': 'تكافؤ فرص التعلم والدمج', '2-1-1-2': 'دعم تنفيذ المناهج', '2-1-1-3': 'تنويع استراتيجيات التدريس', '2-1-1-4': 'التقنية الرقمية في التعلم',
  '2-1-1-5': 'التعلم التطبيقي', '2-1-1-6': 'المهارات القرائية والعددية', '2-1-1-7': 'التفكير والبحث والابتكار', '2-1-1-8': 'المهارات العاطفية والاجتماعية',
  '2-1-1-9': 'دافعية التعلم', '2-2-1-1': 'تنويع أدوات التقويم', '2-2-1-2': 'تقويم نواتج التعلم', '2-2-1-3': 'تحليل نتائج التقويم وتوظيفها',
  '2-2-1-4': 'التغذية الراجعة ومتابعة التقدم', '3-2-1-1': 'الاعتزاز بالقيم والهوية', '3-2-1-2': 'الاتجاهات الإيجابية', '3-2-1-3': 'الممارسات الصحية',
  '3-2-1-4': 'التطوع والمشاركة المجتمعية', '3-2-1-5': 'الالتزام بقواعد السلوك', '3-2-1-6': 'التعلم الذاتي', '3-2-1-7': 'احترام التنوع الثقافي',
  '4-1-1-1': 'تهيئة المبنى المدرسي', '4-1-1-2': 'تنظيم المبنى واستيعابه', '4-1-1-3': 'تجهيز الفصول والمعامل', '4-1-1-4': 'المرافق والخدمات المساندة',
  '4-2-1-1': 'الأمن والسلامة', '4-2-1-2': 'الصيانة الدورية', '4-2-1-3': 'النظافة المدرسية',
};
function nameOf(r) {
  if (r.code.startsWith('3-1-')) {
    const t = r.indicator || '';
    const subj = ['القراءة', 'الرياضيات', 'العلوم'].find((x) => t.includes(x));
    if (subj) return `برنامج رفع نتائج ${subj} في الاختبارات الوطنية`;
    if (t.includes('القدرات')) return 'برنامج الاستعداد لاختبار القدرات';
    if (t.includes('التحصيلية')) return 'برنامج الاستعداد للاختبار التحصيلي';
  }
  return NAMES[r.code] ? `برنامج ${NAMES[r.code]}` : `برنامج تحسين: ${short(r.indicator)}`;
}

function typeOf(row) {
  const std = row.code.split('-').slice(0, 2).join('-');
  if (PREVENTIVE.includes(std)) return 'preventive';
  return row.pct < 75 ? 'remedial' : 'developmental';
}

// أداء المجالات والمعايير من التقرير
function groups(report) {
  const inds = report.indicators.filter((i) => i.pct != null);
  const g = (list, key) => list.map((x) => {
    const xs = inds.filter((i) => i[key] === x.code);
    return { code: x.code, name: x.name, pct: avg(xs.map((i) => i.pct)), n: xs.length };
  }).filter((x) => x.n);
  return { domains: g(DOMAINS, 'domain'), standards: g(STANDARDS, 'standard') };
}

// تحليل SWOT مقترح من الأرقام فقط (بدون جهات أو أرقام مخترعة)، والمدير يعدّله
function autoSwot(report, nafisA) {
  const inds = report.indicators.filter((i) => i.pct != null);
  const line = (i) => `${short(i.text, 90)} (${r1(i.pct)}%)`;
  const S = inds.filter((i) => i.pct >= 90).sort((a, b) => b.pct - a.pct).slice(0, 5).map(line);
  const W = inds.filter((i) => i.pct < 75).sort((a, b) => a.pct - b.pct).slice(0, 5).map(line);
  const O = inds.filter((i) => i.pct >= 75 && i.pct < 90).sort((a, b) => b.pct - a.pct).slice(0, 4).map((i) => `قريب من التميز: ${line(i)}`);
  const T = [];
  if (nafisA) {
    for (const s of nafisA.subjects) {
      if (s.subject && s.gap != null && s.gap <= -3) T.push(`${s.name} (${s.grade_name}) في نافس أقل من متوسط المملكة بـ ${Math.abs(s.gap)} نقطة`);
      else if (s.gap != null && s.gap >= 3) S.push(`${s.name} (${s.grade_name}) في نافس أعلى من متوسط المملكة بـ ${s.gap} نقطة`);
      if (s.change != null && s.change < 0) T.push(`تراجع ${s.name} (${s.grade_name}) في نافس ${Math.abs(s.change)} نقطة عن العام الماضي`);
      else if (s.change != null && s.change > 0) O.push(`تحسن ${s.name} (${s.grade_name}) في نافس ${s.change} نقطة عن العام الماضي، ويمكن البناء عليه`);
    }
    for (const g of nafisA.grades) if (g.participation != null && g.participation < 95) T.push(`نسبة المشاركة في نافس للصف ${g.name} ${g.participation}%`);
  }
  for (const i of inds.filter((x) => ['4-2', '1-5'].includes(x.standard) && x.pct < 75)) T.push(`مؤشر حماية أو سلامة دون المتوقع: ${line(i)}`);
  if (!O.length) O.push('توظيف نتائج التقويم الذاتي في بناء برامج موجهة للأولويات');
  if (!T.length) T.push('احتمال تراجع المؤشرات المتميزة دون برنامج استدامة');
  return { s: S.slice(0, 6), w: W.slice(0, 6), o: O.slice(0, 5), t: T.slice(0, 5) };
}

const ENRICH = [
  { text: 'توثيق الممارسات المتميزة في المؤشرات المتحققة ونشرها بين المنسوبين', when: 'الفصل الدراسي الأول' },
  { text: 'تبادل الزيارات والخبرات مع مدرسة شريكة في المعايير المتميزة', when: 'كل فصل دراسي' },
  { text: 'مراجعة دورية لمؤشرات التميز في التقويم الذاتي للتأكد من استمرارها', when: 'منتصف كل فصل' },
];

function build({ report, plan, nafis, nafisA, over = {} }) {
  if (!report) return null;
  const pg = over.programs || {};
  const G = groups(report);
  const programs = [];
  const rows = (plan && plan.rows) || [];
  rows.forEach((r, i) => {
    const key = `p${i}`; const o = pg[key] || {};
    const pr = progress([r]);
    const ops = Object.values(r.opinions || {});
    programs.push({
      key, source: 'improvement', row: i, code: r.code, domain: r.domain, standard: r.standard, indicator: r.indicator, pct: r.pct, target: r.target,
      name: o.name || nameOf(r),
      type: o.type && TYPES[o.type] ? o.type : typeOf(r),
      goal: r.goal, procedures: procs(r).map((x, j) => withTrack({ ...x, refs: [{ k: 'plan', i, j }] })), responsible: r.responsible, from: r.from, to: r.to,
      kpi: o.kpi || r.measure, budget: o.budget || '', evidence: r.evidence || [],
      progress: { done: pr.done, total: pr.total, pct: pr.total ? Math.round((pr.done / pr.total) * 100) : 0 },
      opinions: { n: ops.length, avg: avg(ops.map((x) => x.rating).filter(Boolean)), comments: ops.filter((x) => x.comment).map((x) => ({ name: x.name, rating: x.rating, comment: x.comment })) },
    });
  });
  // برامج نافس: برنامج علاجي لكل مادة في كل صف
  if (nafis && nafis.rows && nafis.rows.length) {
    const by = new Map();
    for (const r of nafis.rows) { const k = `${r.grade}|${r.subject}`; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
    for (const [k, rs] of by) {
      const key = `n${k.replace('|', '_')}`; const o = pg[key] || {};
      const f = rs[0];
      // الإجراءات المتكررة بين مجالات نفس المادة تظهر مرة وحدة، وتأشيرها يشمل كل نسخها
      const acts = [];
      for (const r of rs) {
        const i = nafis.rows.indexOf(r);
        r.actions.forEach((a, j) => {
          const ex = acts.find((x) => x.text === a.text);
          if (ex) { ex.refs.push({ k: 'nafis', i, j }); return; }
          acts.push({ text: a.text, when: a.when, done: !!a.done, done_at: a.done_at || null, done_name: a.done_name || '', note: a.note || '', due: a.due || '', refs: [{ k: 'nafis', i, j }] });
        });
      }
      const nd = acts.filter((x) => x.done).length;
      programs.push({
        key, source: 'nafis', domain: 'نواتج التعلم', standard: 'التحصيل التعليمي (نافس)', code: '', indicator: `${f.subject_name}، ${f.grade_name}: ${rs.map((r) => r.domain).join('، ')}`,
        name: o.name || `البرنامج العلاجي لنافس: ${f.subject_name} (${f.grade_name})`,
        type: o.type && TYPES[o.type] ? o.type : 'remedial',
        goal: `رفع نسبة الإتقان في مجالات ${rs.map((r) => `${r.domain} إلى ${r.target}%`).join('، ')}.`,
        procedures: acts.map(withTrack), responsible: f.owner, from: 'بداية الفصل', to: 'قبل موعد الاختبار',
        kpi: o.kpi || rs[0].measure, budget: o.budget || '', evidence: ['نتائج الاختبار التشخيصي', 'سجل المجموعات العلاجية', 'نتائج الاختبارات المحاكية'],
        progress: { done: nd, total: acts.length, pct: acts.length ? Math.round((nd / acts.length) * 100) : 0 }, opinions: { n: 0, avg: null, comments: [] },
      });
    }
  }
  // برنامج استدامة التميز للمؤشرات المتحققة
  const strong = report.indicators.filter((i) => i.pct != null && i.pct >= 90);
  if (strong.length) {
    const o = pg.keep || {};
    programs.push({
      key: 'keep', source: 'strengths', domain: 'كل المجالات', standard: `${strong.length} مؤشر في مستوى التميز`, code: '', indicator: strong.slice(0, 4).map((i) => short(i.text, 50)).join('، '),
      name: o.name || 'برنامج استدامة التميز', type: o.type && TYPES[o.type] ? o.type : 'enrichment',
      goal: `المحافظة على ${strong.length} مؤشر في مستوى التميز (90% فأعلى) في دورة التقويم القادمة.`,
      procedures: ENRICH.map((x) => ({ ...x, done: false })), responsible: 'قائد المدرسة، لجنة التميز', from: 'بداية العام', to: 'نهاية العام',
      kpi: o.kpi || 'بقاء نسبة المؤشرات المتميزة 90% فأعلى في التقويم الذاتي القادم', budget: o.budget || '', evidence: ['دليل الممارسات المتميزة', 'تقارير تبادل الزيارات'],
      progress: null, opinions: { n: 0, avg: null, comments: [] },
    });
  }
  // الأهداف العامة من المجالات، والتفصيلية من البرامج
  const goals = G.domains.map((d) => {
    const ps = programs.filter((p) => p.domain === d.name || (p.source === 'nafis' && d.code === '3'));
    const target = Math.min(100, Math.max(ceil5(d.pct + 3), d.pct >= 90 ? d.pct : 0));
    return { domain: d.name, pct: d.pct, target, level: levelOf(d.pct).name, text: d.pct >= 90 ? `المحافظة على تميز مجال ${d.name} (${d.pct}%)` : `رفع متوسط الأداء في مجال ${d.name} من ${d.pct}% إلى ${target}%`, programs: ps.map((p) => p.key) };
  });
  for (const p of programs) { p.late = p.procedures.filter((x) => x.state === 'late').length; p.maxLate = Math.max(0, ...p.procedures.map((x) => x.late || 0)); }
  const tracked = programs.filter((p) => p.progress);
  const done = tracked.reduce((a, p) => a + p.progress.done, 0), total = tracked.reduce((a, p) => a + p.progress.total, 0);
  const byType = Object.fromEntries(Object.keys(TYPES).map((t) => [t, programs.filter((p) => p.type === t).length]));
  const sw = autoSwot(report, nafisA);
  const swot = Object.fromEntries(['s', 'w', 'o', 't'].map((k) => [k, Array.isArray(over.swot?.[k]) ? over.swot[k] : sw[k]]));
  return {
    vision: over.vision || '', mission: over.mission || '', values: over.values || '',
    swot, swot_edited: !!over.swot, goals, programs, byType,
    progress: { done, total, pct: total ? Math.round((done / total) * 100) : 0 },
    late: programs.reduce((a, p) => a + p.late, 0),
    domains: G.domains, standards: G.standards,
    trial: !!(plan && plan.trial), has_plan: !!plan,
  };
}

module.exports = { build, TYPES, groups, autoSwot };
