// أداة «الخطة العلاجية لنافس»: تحليل بطاقة الأداء المدرسي (نتائج نافس) وبناء خطة علاجية لكل مادة ومجال فرعي.
// المدخلات هي أرقام البطاقة من منصة تميز: المشاركة، نسب الإتقان للمدرسة والإدارة والمملكة، والمجالات الفرعية.
// التصنيف مقارنة بمتوسط المملكة: نقطة قوة (+3 فأكثر)، أولوية عاجلة (-3 فأقل)، وما بينهما يحتاج تحسيناً.
// الإجراءات صياغتنا، عامة وقابلة للتعديل، وبدون أرقام مخترعة.

const SUBJECTS = {
  reading: { name: 'القراءة', teacher: 'معلم/ة لغتي' },
  math: { name: 'الرياضيات', teacher: 'معلم/ة الرياضيات' },
  science: { name: 'العلوم', teacher: 'معلم/ة العلوم' },
};
const GRADES = {
  g3p: { name: 'الثالث الابتدائي', subjects: ['reading', 'math'] },
  g6p: { name: 'السادس الابتدائي', subjects: ['reading', 'math', 'science'] },
  g3m: { name: 'الثالث المتوسط', subjects: ['reading', 'math', 'science'] },
};
// أسماء المجالات كما ظهرت في بطاقة حقيقية للثالث المتوسط. قابلة للتعديل لأن البطاقة قد تختلف حسب الصف والسنة.
const DOMAINS = {
  reading: ['استيعاب المقروء', 'دلالات الألفاظ'],
  math: ['الأعداد والعمليات عليها', 'الجبر', 'الهندسة والقياس', 'البيانات والاحتمالات'],
  science: ['علوم الحياة', 'علم الأرض والفلك', 'العلوم الفيزيائية والكيميائية'],
};
const CLS = {
  urgent: { name: 'أولوية عاجلة', color: '#d33a2c' },
  improve: { name: 'يحتاج تحسيناً', color: '#d9690a' },
  strength: { name: 'نقطة قوة', color: '#0b8f55' },
};
const GAP = 3;
const STEP = 5;

const num = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace('%', '').replace('٫', '.').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))); return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : null; };
const cnt = (v) => { const n = parseInt(String(v ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10); return Number.isFinite(n) && n >= 0 && n < 100000 ? n : null; };
const clip = (v, n) => String(v ?? '').trim().slice(0, n);
const r1 = (n) => Math.round(n * 10) / 10;

// تنظيف بيانات البطاقة القادمة من الواجهة
function normalize(input = {}) {
  const grades = [];
  for (const g of Array.isArray(input.grades) ? input.grades : []) {
    const def = GRADES[g && g.grade];
    if (!def || grades.some((x) => x.grade === g.grade)) continue;
    const subjects = [];
    for (const key of def.subjects) {
      const s = (g.subjects || []).find((x) => x && x.subject === key) || {};
      const lv = s.levels || {};
      subjects.push({
        subject: key,
        mastery: num(s.mastery), office: num(s.office), ksa: num(s.ksa), last: num(s.last),
        mean: num(s.mean), mean_ksa: num(s.mean_ksa),
        levels: { high: num(lv.high), mid: num(lv.mid), low: num(lv.low), vlow: num(lv.vlow) },
        domains: (Array.isArray(s.domains) ? s.domains : []).slice(0, 8).map((d) => ({ name: clip(d && d.name, 80), school: num(d && d.school), office: num(d && d.office), ksa: num(d && d.ksa) })).filter((d) => d.name),
      });
    }
    grades.push({ grade: g.grade, students: cnt(g.students), tested: cnt(g.tested), index: num(g.index), index_last: num(g.index_last), subjects });
  }
  return { year: clip(input.year, 20), sample: !!input.sample, grades };
}

const classify = (school, ksa) => {
  if (school == null || ksa == null) return null;
  const gap = school - ksa;
  return gap >= GAP ? 'strength' : gap <= -GAP ? 'urgent' : 'improve';
};
// مستهدف مرحلي: يقرّب المدرسة من متوسط المملكة، بحد أدنى 5 نقاط وأعلى 15 نقطة تحسن في العام
const MAX_STEP = 15;
const targetOf = (school, ksa) => (school == null ? null : Math.min(100, Math.ceil(Math.max(school + STEP, Math.min(ksa ?? 0, school + MAX_STEP)))));

// بيانات الصف/المادة كافية للتحليل؟
const ready = (s) => s.mastery != null && s.ksa != null;
function analyze(card) {
  const grades = card.grades.map((g) => {
    const def = GRADES[g.grade];
    const participation = g.students && g.tested != null ? r1((g.tested / g.students) * 100) : null;
    const subjects = g.subjects.map((s) => ({
      ...s,
      name: SUBJECTS[s.subject].name,
      gap: ready(s) ? r1(s.mastery - s.ksa) : null,
      gap_office: s.mastery != null && s.office != null ? r1(s.mastery - s.office) : null,
      change: s.mastery != null && s.last != null ? r1(s.mastery - s.last) : null,
      cls: classify(s.mastery, s.ksa),
      target: targetOf(s.mastery, s.ksa),
      domains: s.domains.map((d) => ({ ...d, gap: d.school != null && d.ksa != null ? r1(d.school - d.ksa) : null, cls: classify(d.school, d.ksa), target: targetOf(d.school, d.ksa) })),
    }));
    return { ...g, name: def.name, participation, change: g.index != null && g.index_last != null ? r1(g.index - g.index_last) : null, subjects };
  });
  const domains = grades.flatMap((g) => g.subjects.flatMap((s) => s.domains.filter((d) => d.cls).map((d) => ({ ...d, grade: g.grade, grade_name: g.name, subject: s.subject, subject_name: s.name }))));
  const subjects = grades.flatMap((g) => g.subjects.filter((s) => s.cls).map((s) => ({ ...s, grade: g.grade, grade_name: g.name })));
  const count = (list, c) => list.filter((x) => x.cls === c).length;
  return {
    grades,
    domains,
    subjects,
    counts: { urgent: count(domains, 'urgent'), improve: count(domains, 'improve'), strength: count(domains, 'strength'), total: domains.length },
    complete: subjects.length > 0 && subjects.length === grades.reduce((a, g) => a + g.subjects.length, 0),
  };
}

// ---------- بنك الإجراءات ----------
// لكل مادة وتصنيف: إجراءات عامة. ولكل مجال: إجراء نوعي يُضاف في أول الخطة.
const W = { diag: 'الأسبوعان الأول والثاني', mid: 'من الأسبوع الثالث حتى العاشر', all: 'طوال الفصل' };
const BANK = {
  'reading|urgent': [
    ['اختبار تشخيصي قصير في مهارات المجال لتحديد الطلاب في المستويين المنخفضين', W.diag],
    ['مجموعات دعم صغيرة (4 إلى 6 طلاب) بحصتين أسبوعياً تركز على مهارات المجال', W.mid],
    ['نص قصير في بداية كل حصة مع أسئلة بنمط نافس ومناقشة طريقة الوصول للإجابة', W.all],
  ],
  'reading|improve': [
    ['تضمين أسئلة المجال في الواجبات والاختبارات القصيرة أسبوعياً', W.all],
    ['تحليل أخطاء الطلاب في الاختبار المحاكي ومناقشتها مع الصف', W.mid],
  ],
  'math|urgent': [
    ['اختبار تشخيصي للمتطلبات السابقة للمجال، وعلاج الفجوات قبل الدروس الجديدة', W.diag],
    ['مجموعات علاجية بحصتين أسبوعياً، بالتدرج من المحسوس إلى الصوري ثم المجرد', W.mid],
    ['تدريب يومي قصير (10 دقائق) على الطلاقة الحسابية ومسائل المجال', W.all],
  ],
  'math|improve': [
    ['سؤالان بنمط نافس في كل حصة مع مناقشة أكثر من طريقة للحل', W.all],
    ['تحليل نتائج الاختبار المحاكي وإعادة تدريس المهارات الأضعف', W.mid],
  ],
  'science|urgent': [
    ['تشخيص المفاهيم الخاطئة في المجال وتصحيحها بأنشطة عملية', W.diag],
    ['مجموعات علاجية بحصتين أسبوعياً تركز على مفاهيم المجال وتطبيقها', W.mid],
    ['سؤال تفسير لظاهرة من الحياة في كل درس، بنمط أسئلة نافس', W.all],
  ],
  'science|improve': [
    ['تجارب أو محاكاة لمفاهيم المجال، مع أسئلة تفسير بعد كل تجربة', W.all],
    ['تحليل نتائج الاختبار المحاكي ومراجعة المفاهيم الأضعف', W.mid],
  ],
  strength: [['إثراء المتقدمين بمسائل ونصوص أعلى مستوى، وتوظيفهم قرناء داعمين لزملائهم', W.all]],
};
const DOMAIN_BANK = {
  'استيعاب المقروء': 'تدريب الطلاب على استراتيجيات ما قبل القراءة وأثنائها وبعدها: التنبؤ، وتحديد الفكرة الرئيسة، والتلخيص، والاستنتاج',
  'دلالات الألفاظ': 'بنك مفردات أسبوعي من نصوص المنهج، مع تمارين المعنى من السياق والمترادف والمضاد',
  'الأعداد والعمليات عليها': 'أنشطة قصيرة متدرجة على الكسور والنسبة والعمليات على الأعداد، مع تقدير الناتج قبل الحل',
  'الجبر': 'تمثيل المواقف الحياتية بمعادلات وجداول ورسوم، وربط الأنماط بالتعبيرات الجبرية',
  'الهندسة والقياس': 'أنشطة عملية بالأدوات أو البرمجيات لقياس الزوايا والمساحات والحجوم وحل مسائل عليها',
  'البيانات والاحتمالات': 'قراءة جداول ورسوم بيانية حقيقية وتفسيرها، وتجارب احتمال بسيطة يسجل الطلاب نتائجها',
  'علوم الحياة': 'خرائط مفاهيم للأجهزة والعمليات الحيوية والسلاسل الغذائية، وربطها بأمثلة من البيئة المحلية',
  'علم الأرض والفلك': 'نماذج ومحاكاة لحركة الأرض والقمر، ودورة الصخور، والطقس، مع أسئلة تفسير',
  'العلوم الفيزيائية والكيميائية': 'تجارب قصيرة على الطاقة والحركة والمادة وتحولاتها، يتوقع الطالب فيها النتيجة ثم يفسرها',
};
const MEASURE = {
  urgent: 'نسبة الطلاب في المستويين المنخفضين، ونسبة المجال في الاختبارات المحاكية',
  improve: 'نسبة المجال في الاختبارات المحاكية مقارنة بالتشخيصي',
  strength: 'المحافظة على النسبة أو رفعها في الاختبارات المحاكية',
};
// إجراءات على مستوى المدرسة تظهر في الخطة مرة واحدة
const SCHOOL_ACTIONS = [
  { text: 'تشكيل لجنة نافس بالمدرسة وتوزيع المهام وجدول المتابعة', owner: 'قائد/ة المدرسة', when: W.diag },
  { text: 'اختبار محاكي لكل مادة كل شهر تقريباً، ومناقشة نتائجه في اجتماع لجنة نافس', owner: 'لجنة نافس، وكيل/ة الشؤون التعليمية', when: W.all },
  { text: 'مجتمع تعلم مهني لمعلمي كل مادة لتبادل استراتيجيات تدريس المجالات الأضعف', owner: 'رواد/رائدات المواد', when: W.all },
  { text: 'تواصل شهري مع الأسرة عن مستوى الطالب، وأنشطة منزلية قصيرة في القراءة والرياضيات', owner: 'الموجه/ة الطلابي، معلمو المواد', when: W.all },
  { text: 'تهيئة الطلاب ليوم الاختبار: التعريف بنمط الأسئلة، وإدارة الوقت، وتخفيف القلق، وضمان حضور جميع المسجلين', owner: 'الموجه/ة الطلابي، لجنة نافس', when: 'قبل موعد الاختبار' },
];

function actionsFor(subject, domain, cls) {
  if (cls === 'strength') return BANK.strength.map(([text, when]) => ({ text, when }));
  const out = [];
  if (DOMAIN_BANK[domain]) out.push({ text: DOMAIN_BANK[domain], when: W.mid });
  for (const [text, when] of BANK[`${subject}|${cls}`] || []) out.push({ text, when });
  return out.slice(0, 4);
}

// ---------- الخطة ----------
const ORDER = { urgent: 0, improve: 1, strength: 2 };
const GK = Object.keys(GRADES);
const SK = Object.keys(SUBJECTS);
function buildNafisPlan(card, { limit = 0 } = {}) {
  const a = analyze(card);
  const all = a.domains
    .filter((d) => d.cls !== 'strength')
    .sort((x, y) => GK.indexOf(x.grade) - GK.indexOf(y.grade) || SK.indexOf(x.subject) - SK.indexOf(y.subject) || ORDER[x.cls] - ORDER[y.cls] || x.gap - y.gap)
    .map((d) => ({
      grade: d.grade, grade_name: d.grade_name, subject: d.subject, subject_name: d.subject_name,
      domain: d.name, school: d.school, office: d.office, ksa: d.ksa, gap: d.gap, cls: d.cls, target: d.target,
      actions: actionsFor(d.subject, d.name, d.cls),
      owner: `${SUBJECTS[d.subject].teacher} (${d.grade_name})`,
      measure: MEASURE[d.cls],
    }));
  const strengths = a.domains.filter((d) => d.cls === 'strength').sort((x, y) => y.gap - x.gap)
    .map((d) => ({ grade_name: d.grade_name, subject_name: d.subject_name, domain: d.name, school: d.school, ksa: d.ksa, gap: d.gap }));
  const rows = limit ? all.slice(0, limit) : all;
  const priorities = a.domains.filter((d) => d.cls === 'urgent').sort((x, y) => x.gap - y.gap).slice(0, 5)
    .map((d) => ({ grade_name: d.grade_name, subject_name: d.subject_name, domain: d.name, school: d.school, ksa: d.ksa, gap: d.gap }));
  return {
    created: Date.now(),
    total: all.length,
    limited: rows.length < all.length,
    rows,
    strengths,
    priorities,
    school_actions: SCHOOL_ACTIONS.map((x) => ({ ...x })),
    summary: summaryOf(a),
    recommendations: '',
  };
}

// الملخص التنفيذي لقائد المدرسة
function summaryOf(a) {
  const lines = [];
  for (const s of a.subjects) {
    const dir = s.gap >= 0 ? `أعلى من متوسط المملكة بـ ${s.gap} نقطة` : `أقل من متوسط المملكة بـ ${Math.abs(s.gap)} نقطة`;
    lines.push(`${s.name} (${s.grade_name}): نسبة الإتقان ${s.mastery}%، ${dir}${s.change != null ? `، و${s.change >= 0 ? 'تحسنت' : 'تراجعت'} ${Math.abs(s.change)} نقطة عن العام الماضي` : ''}.`);
  }
  const low = a.grades.filter((g) => g.participation != null && g.participation < 95);
  const urgent = a.domains.filter((d) => d.cls === 'urgent').sort((x, y) => x.gap - y.gap);
  const decision = !a.domains.length ? ''
    : a.counts.urgent * 2 >= a.counts.total ? 'خطة علاجية مكثفة: أغلب المجالات أقل من متوسط المملكة بفارق واضح، فتبدأ المدرسة بالتشخيص والمجموعات العلاجية في كل المواد مع متابعة شهرية.'
      : a.counts.urgent ? 'خطة علاجية مركزة على المجالات ذات الأولوية العاجلة، مع تعزيز بقية المجالات داخل الحصص.'
        : 'خطة تعزيز وإثراء: المجالات قريبة من متوسط المملكة أو أعلى، والتركيز على رفعها والمحافظة عليها.';
  const steps = [];
  if (urgent.length) steps.push(`البدء بتشخيص المجالات العاجلة: ${urgent.slice(0, 3).map((d) => `${d.name} (${d.subject_name})`).join('، ')}.`);
  steps.push('تكوين مجموعات علاجية للطلاب في المستويين المنخفضين، وجدولتها ضمن الخطة الأسبوعية.');
  steps.push('اختبار محاكي شهري لكل مادة، ومقارنة نتائجه بالمستهدف في اجتماع لجنة نافس.');
  if (low.length) steps.push(`رفع نسبة المشاركة في ${low.map((g) => `${g.name} (${g.participation}%)`).join('، ')} بالتواصل مع أسر الطلاب قبل موعد الاختبار.`);
  else steps.push('التواصل مع الأسر قبل موعد الاختبار لضمان حضور جميع الطلاب المسجلين.');
  return { lines, decision, steps };
}

module.exports = { SUBJECTS, GRADES, DOMAINS, CLS, normalize, analyze, buildNafisPlan, classify, targetOf, actionsFor };
