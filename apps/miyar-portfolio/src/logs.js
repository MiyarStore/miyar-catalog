// «السجلات اليومية»: توثيق سريع للأعمال المتكررة، كل سجل يطبع بترويسة الوزارة ويتحول لشاهد على عنصره.
// الحقول تُعرّف هنا مرة وحدة، والواجهة والطباعة تبنى منها.
const { db } = require('./db');

const T = (key, label, extra = {}) => ({ key, label, type: 'text', ...extra });
const A = (key, label, extra = {}) => ({ key, label, type: 'textarea', ...extra });
const S = (key, label, opts, extra = {}) => ({ key, label, type: 'select', opts, ...extra });
const N = (key, label, extra = {}) => ({ key, label, type: 'number', ...extra });

const KINDS = {
  wait: {
    name: 'حصص الانتظار', one: 'حصة انتظار', icon: '⏳', std: 1,
    hint: 'كل حصة انتظار تغطيها: الفصل، والحصة، ووش سويت فيها.',
    fields: [
      N('period', 'الحصة', { min: 1, max: 8, req: true }),
      T('cls', 'الفصل', { req: true, ph: 'مثال: ثالث متوسط / 2' }),
      T('absent', 'بدلاً عن (اختياري)', { ph: 'اسم المعلم الغائب أو المادة' }),
      S('activity', 'نوع النشاط', ['نشاط إثرائي', 'قراءة حرة', 'مراجعة ومساندة', 'قيم وسلوك', 'مسابقة ثقافية', 'مهارات حياتية', 'أخرى'], { req: true }),
      A('done', 'وش نفّذت', { ph: 'مثال: مسابقة أسئلة عن المواطنة، شارك فيها 24 طالباً' }),
    ],
    cols: ['period', 'cls', 'absent', 'activity', 'done'],
  },
  duty: {
    name: 'المناوبة والإشراف', one: 'مناوبة أو إشراف', icon: '🛡️', std: 1,
    hint: 'المناوبة اليومية، الإشراف على الفسحة والانصراف، الطابور والإذاعة.',
    fields: [
      S('type', 'النوع', ['مناوبة يومية', 'إشراف على الفسحة', 'إشراف على الانصراف', 'طابور صباحي', 'إذاعة مدرسية', 'إشراف على الاختبارات', 'أخرى'], { req: true }),
      T('place', 'الموقع', { ph: 'مثال: الساحة الشمالية' }),
      A('notes', 'الملاحظات والحالات', { ph: 'اكتب ما تم رصده والإجراء، بدون أسماء الطلاب' }),
    ],
    cols: ['type', 'place', 'notes'],
  },
  circular: {
    name: 'التعاميم والتعليمات', one: 'تعميم', icon: '📨', std: 1,
    hint: 'كل تعميم يوصلك: رقمه وموضوعه ووش سويت فيه.',
    fields: [
      T('no', 'رقم التعميم'),
      T('subject', 'الموضوع', { req: true }),
      S('source', 'الجهة', ['إدارة المدرسة', 'مكتب التعليم', 'إدارة التعليم', 'وزارة التعليم', 'أخرى']),
      A('action', 'الإجراء المتخذ', { ph: 'مثال: اطلعت عليه ووقّعت، وطبّقت التعليمات في الفصل' }),
    ],
    cols: ['no', 'subject', 'source', 'action'],
  },
  committee: {
    name: 'اللجان والاجتماعات', one: 'لجنة أو اجتماع', icon: '👥',
    std: (d) => (d.type === 'مجتمع تعلم مهني' || d.type === 'درس تطبيقي / زيارة تبادلية' ? 2 : 1),
    hint: 'عضوياتك في اللجان، والاجتماعات، ومجتمعات التعلم المهنية.',
    fields: [
      S('type', 'النوع', ['لجنة مدرسية', 'اجتماع', 'مجتمع تعلم مهني', 'درس تطبيقي / زيارة تبادلية'], { req: true }),
      T('title', 'اسم اللجنة أو الاجتماع', { req: true }),
      S('role', 'دورك', ['عضو', 'رئيس', 'مقرر', 'حاضر', 'مقدّم']),
      A('topics', 'الموضوعات'),
      A('decisions', 'القرارات والمهام المكلف بها'),
    ],
    cols: ['type', 'title', 'role', 'topics', 'decisions'],
  },
  contact: {
    name: 'سجل التواصل', one: 'تواصل', icon: '📞',
    std: (d) => (d.party === 'ولي أمر' ? 3 : 1),
    hint: 'التواصل مع أولياء الأمور والإدارة. استخدم رمز الطالب أو رقمه بدل اسمه.',
    follow: true,
    fields: [
      S('party', 'مع من', ['ولي أمر', 'إدارة المدرسة', 'الموجه الطلابي', 'زميل', 'أخرى'], { req: true }),
      T('student', 'رمز الطالب (اختياري)', { ph: 'مثال: ط-07' }),
      S('channel', 'الطريقة', ['اتصال', 'رسالة نصية', 'منصة مدرستي', 'لقاء في المدرسة', 'بريد', 'أخرى']),
      S('reason', 'السبب', ['المستوى الدراسي', 'الغياب أو التأخر', 'السلوك', 'تعزيز وتكريم', 'صحي أو اجتماعي', 'إداري', 'أخرى'], { req: true }),
      A('summary', 'ملخص التواصل', { req: true }),
      A('outcome', 'النتيجة والإجراء المتفق عليه'),
    ],
    cols: ['party', 'student', 'channel', 'reason', 'summary', 'outcome'],
  },
  initiative: {
    name: 'المبادرات والبرامج', one: 'مبادرة', icon: '🚀', std: (d) => Number(d.std) || 5,
    hint: 'مبادرة بقياس قبلي وبعدي، والتطبيق يحسب الفرق بالنقاط المئوية.',
    single: true,
    fields: [
      T('title', 'اسم المبادرة', { req: true }),
      S('std', 'العنصر المرتبط', [], { stdPick: true }),
      A('goal', 'الهدف', { req: true }),
      T('group', 'الفئة المستهدفة', { ph: 'مثال: طلاب ثاني متوسط (3 فصول)' }),
      N('n', 'عدد المستفيدين', { min: 0, max: 5000 }),
      T('end', 'تاريخ الانتهاء', { type: 'date' }),
      T('tool', 'أداة القياس', { ph: 'مثال: اختبار مهارات قصير من 10 درجات' }),
      N('pre', 'القياس القبلي (%)', { min: 0, max: 100, step: 0.1 }),
      N('post', 'القياس البعدي (%)', { min: 0, max: 100, step: 0.1 }),
      A('steps', 'خطوات التنفيذ'),
      A('notes', 'ملاحظات وتوصيات'),
    ],
    cols: ['title', 'group', 'n', 'pre', 'post'],
  },
};

const clip = (v, n) => String(v ?? '').slice(0, n);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const num = (v) => { if (v === '' || v == null) return null; const n = Number(String(v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))); return Number.isFinite(n) ? n : null; };

// تنظيف بيانات السجل حسب حقول نوعه
function clean(kind, body) {
  const K = KINDS[kind];
  const d = {};
  for (const f of K.fields) {
    const v = body[f.key];
    if (f.type === 'number') { const n = num(v); d[f.key] = n == null ? null : Math.min(Math.max(n, f.min ?? -1e9), f.max ?? 1e9); }
    else if (f.type === 'select' && f.opts.length) d[f.key] = f.opts.includes(v) ? v : '';
    else if (f.type === 'date') d[f.key] = isDate(v) ? v : '';
    else d[f.key] = clip(v, f.type === 'textarea' ? 2000 : 200).trim();
  }
  const miss = K.fields.filter((f) => f.req && (d[f.key] == null || d[f.key] === ''));
  return { d, miss };
}

// نتائج المبادرة: الفرق بالنقاط المئوية والتغير النسبي، والفراغ يعني «لا توجد بيانات» وليس صفراً
function impact(d) {
  const pre = d.pre == null ? null : Number(d.pre), post = d.post == null ? null : Number(d.post);
  if (pre == null || post == null) return { pre, post, diff: null, rel: null, text: 'لم يُستكمل القياس القبلي والبعدي بعد.' };
  const diff = Math.round((post - pre) * 10) / 10;
  const rel = pre > 0 ? Math.round(((post - pre) / pre) * 1000) / 10 : null;
  const dir = diff > 0 ? `ارتفعت النتيجة من ${pre}% في القياس القبلي إلى ${post}% في البعدي، بفرق ${diff} نقطة مئوية` : diff < 0 ? `انخفضت النتيجة من ${pre}% في القياس القبلي إلى ${post}% في البعدي، بفرق ${Math.abs(diff)} نقطة مئوية` : `بقيت النتيجة عند ${pre}% في القياسين`;
  return { pre, post, diff, rel, text: `${dir}${rel != null && diff ? ` (تغير نسبي ${rel > 0 ? '+' : ''}${rel}%)` : ''}. التحسن يُقرأ مؤشراً على الأثر، ولا يعني بالضرورة أن المبادرة وحدها سببه.` };
}

const row = (r) => {
  const d = JSON.parse(r.data || '{}');
  const K = KINDS[r.kind];
  const out = { id: r.id, kind: r.kind, date: r.log_date, data: d, status: r.status, follow_up: r.follow_up, std: K ? (typeof K.std === 'function' ? K.std(d) : K.std) : null, updated_at: r.updated_at };
  if (r.kind === 'initiative') out.impact = impact(d);
  return out;
};

function list(userId, { kind, from, to } = {}) {
  let q = 'SELECT * FROM logs WHERE user_id = ?'; const a = [userId];
  if (kind) { q += ' AND kind = ?'; a.push(kind); }
  if (isDate(from)) { q += ' AND log_date >= ?'; a.push(from); }
  if (isDate(to)) { q += ' AND log_date <= ?'; a.push(to); }
  return db.prepare(`${q} ORDER BY log_date DESC, id DESC LIMIT 2000`).all(...a).map(row);
}
const get = (userId, id) => { const r = db.prepare('SELECT * FROM logs WHERE id = ? AND user_id = ?').get(Number(id), userId); return r ? row(r) : null; };

function save(userId, id, body) {
  const kind = id ? (db.prepare('SELECT kind FROM logs WHERE id = ? AND user_id = ?').get(Number(id), userId) || {}).kind : body.kind;
  if (!KINDS[kind]) return { error: 'نوع السجل غير معروف' };
  const { d, miss } = clean(kind, body.data || {});
  if (miss.length) return { error: `أكمل: ${miss.map((f) => f.label).join('، ')}` };
  const date = isDate(body.date) ? body.date : new Date().toISOString().slice(0, 10);
  const status = KINDS[kind].follow ? (body.status === 'closed' ? 'closed' : 'open') : '';
  const follow = KINDS[kind].follow && status === 'open' && isDate(body.follow_up) ? body.follow_up : '';
  const now = Date.now();
  if (id) {
    db.prepare('UPDATE logs SET log_date = ?, data = ?, status = ?, follow_up = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(date, JSON.stringify(d), status, follow, now, Number(id), userId);
    return { log: get(userId, id) };
  }
  const n = db.prepare('SELECT COUNT(*) n FROM logs WHERE user_id = ?').get(userId).n;
  if (n >= 3000) return { error: 'وصلت الحد الأعلى للسجلات' };
  const info = db.prepare('INSERT INTO logs (user_id, kind, log_date, data, status, follow_up, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(userId, kind, date, JSON.stringify(d), status, follow, now, now);
  return { log: get(userId, info.lastInsertRowid) };
}
const remove = (userId, id) => db.prepare('DELETE FROM logs WHERE id = ? AND user_id = ?').run(Number(id), userId);

// ملخص لكل نوع + المتابعات المستحقة
function summary(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const counts = Object.fromEntries(db.prepare('SELECT kind, COUNT(*) n FROM logs WHERE user_id = ? GROUP BY kind').all(userId).map((r) => [r.kind, r.n]));
  const due = db.prepare("SELECT * FROM logs WHERE user_id = ? AND kind = 'contact' AND status = 'open' AND follow_up != '' AND follow_up <= ? ORDER BY follow_up LIMIT 20").all(userId, today).map(row);
  const open = db.prepare("SELECT COUNT(*) n FROM logs WHERE user_id = ? AND kind = 'contact' AND status = 'open'").get(userId).n;
  return { counts, due, open };
}

// إحصاءات السجل لنوع واحد (للطباعة والشاهد)
function stats(kind, rows) {
  const by = (k) => { const m = {}; rows.forEach((r) => { const v = r.data[k]; if (v) m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const out = { total: rows.length };
  if (kind === 'wait') out.groups = by('activity');
  if (kind === 'duty') out.groups = by('type');
  if (kind === 'circular') out.groups = by('source');
  if (kind === 'committee') out.groups = by('type');
  if (kind === 'contact') { out.groups = by('reason'); out.parties = by('party'); out.closed = rows.filter((r) => r.status === 'closed').length; }
  return out;
}

// العدد مع المعدود بصيغة عربية سليمة: [واحد، مثنى، جمع 3-10، تمييز 11 فأكثر]
const cnt = (n, [one, two, few, many]) => (n === 1 ? one : n === 2 ? two : n >= 3 && n <= 10 ? `${n} ${few}` : `${n} ${many}`);
const join = (g) => g.map(([k, n]) => `${k} (${n})`).join('، ');

// نص الشاهد المقترح من السجل
function evidenceFrom(kind, rows, label = '') {
  const K = KINDS[kind];
  const st = stats(kind, rows);
  const dates = rows.map((r) => r.date).sort();
  const span = dates.length ? `${dates[0]}|${dates[dates.length - 1]}` : '';
  const base = { ev_date: dates[dates.length - 1] || new Date().toISOString().slice(0, 10), goals: [] };
  if (kind === 'wait') return { ...base, standard_id: 1, parts: ['a'], title: `تغطية حصص الانتظار${label}`, goals: ['الإسهام في انتظام اليوم الدراسي', 'استثمار وقت الحصة في نشاط تربوي هادف'], description: `غطيت ${cnt(st.total, ['حصة انتظار واحدة', 'حصتي انتظار', 'حصص انتظار', 'حصة انتظار'])}، ونفّذت فيها: ${join(st.groups)}.`, steps: 'تسجيل كل حصة انتظار في سجل الانتظار بتاريخها ورقمها والفصل والنشاط المنفذ، وإعداد أنشطة جاهزة لاستثمار وقت الحصة.', impact: 'استُثمرت حصص الانتظار المسجلة في أنشطة تعليمية وتربوية موثقة بدلاً من الفراغ.', span };
  if (kind === 'duty') return { ...base, standard_id: 1, parts: ['a'], title: `المناوبة والإشراف اليومي${label}`, goals: ['الالتزام بالمهام الإشرافية المكلف بها', 'المحافظة على سلامة الطلاب وانضباطهم'], description: `نفّذت ${cnt(st.total, ['مهمة مناوبة وإشراف واحدة', 'مهمتي مناوبة وإشراف', 'مهام مناوبة وإشراف', 'مهمة مناوبة وإشراف'])}: ${join(st.groups)}.`, steps: 'الحضور في موقع المناوبة في الوقت المحدد، ورصد الملاحظات والحالات والإجراء المتخذ في سجل المناوبة.', impact: 'رُصدت الملاحظات والحالات أثناء المناوبة والإشراف، ووُثّق الإجراء المتخذ لكل منها.', span };
  if (kind === 'circular') return { ...base, standard_id: 1, parts: ['a'], title: `الاطلاع على التعاميم وتنفيذها${label}`, goals: ['الالتزام بالأنظمة والتعليمات المنظمة للعمل'], description: `اطلعت على ${cnt(st.total, ['تعميم واحد', 'تعميمين', 'تعاميم', 'تعميماً'])} (${join(st.groups)})، ووثّقت الإجراء المتخذ لكل منها.`, steps: 'تسجيل رقم التعميم وموضوعه وجهته، والإجراء المتخذ لتطبيقه.', impact: 'وُثّق الإجراء المتخذ لتطبيق كل تعميم في العمل اليومي.', span };
  if (kind === 'committee') {
    const prof = rows.some((r) => r.std === 2) && rows.every((r) => r.std === 2);
    return { ...base, standard_id: prof ? 2 : 1, parts: prof ? ['a'] : ['b'], title: prof ? `المشاركة في مجتمعات التعلم المهنية${label}` : `المشاركة في اللجان والاجتماعات المدرسية${label}`, goals: prof ? ['تبادل الخبرات مع الزملاء', 'تطوير الممارسات المهنية'] : ['المشاركة الفاعلة في المهام المدرسية'], description: `شاركت في ${cnt(st.total, ['لقاء واحد', 'لقاءين', 'لقاءات', 'لقاءً'])} (${join(st.groups)}): ${rows.slice(0, 6).map((r) => r.data.title).join('، ')}${rows.length > 6 ? '، وغيرها' : ''}.`, steps: 'حضور الاجتماعات وتوثيق الموضوعات والقرارات والمهام المكلف بها ومتابعة تنفيذها.', impact: 'وُثّقت الموضوعات والقرارات والمهام المكلف بها لمتابعة تنفيذها.', span };
  }
  if (kind === 'contact') {
    const parents = rows.filter((r) => r.data.party === 'ولي أمر');
    const set = parents.length >= rows.length / 2 ? parents : rows;
    const s2 = stats('contact', set);
    return { ...base, standard_id: set === parents ? 3 : 1, parts: ['a'], title: set === parents ? `التواصل مع أولياء الأمور${label}` : `سجل التواصل المهني${label}`, goals: set === parents ? ['تعزيز الشراكة بين المدرسة والأسرة', 'إطلاع الأسرة على مستوى الطالب'] : ['التواصل الفاعل مع إدارة المدرسة والزملاء'], description: `وثّقت ${cnt(s2.total, ['تواصلاً واحداً', 'تواصلين', 'حالات تواصل', 'حالة تواصل'])} (${join(s2.groups)})، أُغلق منها ${s2.closed} بإجراء متفق عليه.`, steps: 'تسجيل كل تواصل بتاريخه وطريقته وسببه وملخصه، وتحديد موعد للمتابعة حتى يُغلق.', impact: `اكتمل ${s2.total ? Math.round((s2.closed / s2.total) * 100) : 0}% من حالات التواصل بإجراء متفق عليه.`, span };
  }
  if (kind === 'initiative') {
    const r = rows[0]; const d = r.data; const im = impact(d);
    return { ...base, ev_date: d.end || r.date, standard_id: r.std, parts: Number(r.std) === 5 ? ['b'] : [], title: d.title, goals: [d.goal].filter(Boolean), description: `${d.goal}${d.group ? `\nالفئة المستهدفة: ${d.group}` : ''}${d.n ? ` (${d.n} مستفيد)` : ''}${d.tool ? `\nأداة القياس: ${d.tool}` : ''}`, steps: d.steps || '', impact: im.text, span };
  }
  return null;
}

module.exports = { KINDS, list, get, save, remove, summary, stats, impact, evidenceFrom, clean };
