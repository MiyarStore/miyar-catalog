// طباعة «السجلات اليومية» بترويسة الوزارة: سجل كامل لنوع واحد، أو تقرير مبادرة.
const { letterheadHtml, esc } = require('./school/export');
const { CSS, shell } = require('./teacher/record-export');
const F = require('./fmt');
const L = require('./logs');
const { roleKey } = require('./standards');

const cell = (v) => (v == null || v === '' ? '-' : esc(String(v)).replace(/\n/g, '<br>'));
const dayName = (s) => { try { return new Intl.DateTimeFormat('ar-SA', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${s}T12:00:00Z`)); } catch { return ''; } };

function frame(u, title, sub, inner, back) {
  const g = F.G(u);
  const school = { office: u.office, name: u.school, year: u.year, ministry_number: '' };
  const info = `<table class="info"><tr><th>الاسم</th><td>${esc(u.full_name)}</td><th>العمل الحالي</th><td>${esc(u.job_title || g.teacher)}</td></tr><tr><th>المدرسة</th><td>${esc(u.school || '')}</td><th>تاريخ الطباعة</th><td>${esc(F.dual(Date.now()))}</td></tr></table>`;
  const sign = `<div class="sign"><div>${roleKey(u.role) === 'teacher' ? g.teacher : g.employee}: ${esc(u.full_name)}</div><div>${g.deputy}</div><div>${g.principal}${u.principal ? `: ${esc(u.principal)}` : ''}</div></div><p class="madeby">${esc(F.madeBy(u))}</p>`;
  const body = `<div class="toolbar"><a class="btn ghost" href="${back}">→ رجوع</a><button class="btn" onclick="print()">🖨️ طباعة / حفظ PDF</button></div>
  <div class="page">${letterheadHtml(school, null)}<h1>${esc(title)}</h1>${sub ? `<div class="center muted">${sub}</div>` : ''}${info}${inner}${sign}</div>`;
  return shell(`${title} - ${u.full_name}`, body);
}

function kindPage({ u, kind, rows, from, to }) {
  const K = L.KINDS[kind];
  const st = L.stats(kind, rows);
  const lab = Object.fromEntries(K.fields.map((f) => [f.key, f.label.replace(/ \(.*\)$/, '')]));
  const cols = K.cols;
  const range = from || to ? `من ${from ? F.dual(from) : 'البداية'} إلى ${to ? F.dual(to) : 'اليوم'}` : 'كل السجلات';
  const kpis = [[st.total, 'إجمالي السجلات'], ...(st.groups || []).slice(0, kind === 'contact' ? 2 : 3).map(([k, n]) => [n, k])];
  if (kind === 'contact') kpis.push([`${st.closed}/${st.total}`, 'حالات مغلقة بإجراء']);
  const sorted = [...rows].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  const table = `<table style="font-size:12px"><thead><tr><th style="width:7mm">م</th><th style="width:30mm">التاريخ</th>${cols.map((c) => `<th>${esc(lab[c])}</th>`).join('')}${K.follow ? '<th>الحالة</th>' : ''}</tr></thead><tbody>
    ${sorted.map((r, i) => `<tr><td class="center">${i + 1}</td><td>${esc(dayName(r.date))}<br>${esc(F.hijri(r.date))}<br><span class="muted">${esc(F.greg(r.date))}م</span></td>${cols.map((c) => `<td>${cell(r.data[c])}</td>`).join('')}${K.follow ? `<td>${r.status === 'closed' ? 'مغلقة' : `مفتوحة${r.follow_up ? `<br><span class="muted">متابعة ${esc(F.hijriShort(r.follow_up))}</span>` : ''}`}</td>` : ''}</tr>`).join('') || `<tr><td colspan="${cols.length + 2 + (K.follow ? 1 : 0)}" class="center muted">لا توجد سجلات في هذه الفترة.</td></tr>`}
  </tbody></table>`;
  const note = kind === 'contact' ? '<p class="muted" style="font-size:11px">يُكتفى برمز الطالب حفاظاً على خصوصية الطلاب وأسرهم.</p>' : '';
  return frame(u, `سجل ${K.name}`, esc(range), `<div class="kpis">${kpis.slice(0, 4).map(([v, t]) => `<div class="kpi"><b>${esc(String(v))}</b>${esc(t)}</div>`).join('')}</div>${table}${note}`, '/app#/logs/' + kind);
}

function initiativePage({ u, r, stdName }) {
  const d = r.data; const im = r.impact;
  const rows = [['العنصر المرتبط', stdName], ['الهدف', d.goal], ['الفئة المستهدفة', d.group], ['عدد المستفيدين', d.n], ['تاريخ البدء', r.date ? F.dual(r.date) : ''], ['تاريخ الانتهاء', d.end ? F.dual(d.end) : ''], ['أداة القياس', d.tool], ['خطوات التنفيذ', d.steps]];
  const bar = (v, c) => `<div style="background:#eef3f2;border-radius:6px;height:16px;overflow:hidden"><div style="width:${Math.max(0, Math.min(100, v))}%;height:100%;background:${c}"></div></div>`;
  const res = im.diff == null ? `<p class="muted">${esc(im.text)}</p>` : `<div class="kpis"><div class="kpi"><b>${im.pre}%</b>القياس القبلي</div><div class="kpi"><b>${im.post}%</b>القياس البعدي</div><div class="kpi"><b><bdi dir="ltr">${im.diff > 0 ? '+' : ''}${im.diff}</bdi></b>الفرق (نقطة مئوية)</div><div class="kpi"><b>${im.rel == null ? '-' : `<bdi dir="ltr">${im.rel > 0 ? '+' : ''}${im.rel}%</bdi>`}</b>التغير النسبي</div></div>
    <table class="info"><tr><th>القبلي</th><td>${bar(im.pre, '#94a3b8')}</td></tr><tr><th>البعدي</th><td>${bar(im.post, '#0f766e')}</td></tr></table><p>${esc(im.text)}</p>`;
  const inner = `<table class="prep" style="font-size:12.5px"><tbody>${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${cell(v)}</td></tr>`).join('')}</tbody></table>
    <h2 class="sec">نتائج القياس</h2>${res}${d.notes ? `<h2 class="sec">ملاحظات وتوصيات</h2><p>${cell(d.notes)}</p>` : ''}`;
  return frame(u, `تقرير مبادرة: ${d.title}`, '', inner, '/app#/logs/initiative');
}

module.exports = { kindPage, initiativePage };
