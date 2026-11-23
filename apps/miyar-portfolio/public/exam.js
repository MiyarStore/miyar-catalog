/* صانع الاختبارات: جدول المواصفات، كتابة الأسئلة، المراجعة، الطباعة وWord، والإرسال لسجل المادة */
const EX = { x: null, spec: null, total: 0, ai: false, meta: null, timer: null };
const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ'];
const LV_COLOR = { know: '#0369a1', apply: '#0f766e', reason: '#7c3aed' };
const exRid = () => Math.random().toString(16).slice(2, 10);

if (!document.getElementById('exam-css')) {
  const st = document.createElement('style'); st.id = 'exam-css';
  st.textContent = `.xspec{width:100%;border-collapse:collapse;font-size:13.5px}.xspec th,.xspec td{border:1px solid var(--line);padding:5px;text-align:center}.xspec th{background:var(--brand-soft);color:var(--brand-text)}.xspec td.t{text-align:right}.xspec tfoot td{font-weight:700;background:var(--brand-soft)}
  .xsec{display:grid;grid-template-columns:1.6fr .8fr .8fr .8fr;gap:6px;align-items:center;font-size:14px;padding:6px 0;border-bottom:1px solid var(--line)}.xsec input{width:100%;box-sizing:border-box;text-align:center}
  .xles{width:100%;border-collapse:collapse;font-size:13.5px}.xles td,.xles th{border-bottom:1px solid var(--line);padding:5px 4px;text-align:right;vertical-align:middle}.xles input[type=number]{width:56px;text-align:center}
  .xit{border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:10px;background:var(--card)}.xit.empty{border-style:dashed;border-color:#d97706}.xit textarea{width:100%;box-sizing:border-box;min-height:56px}
  .xit .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:6px;font-size:13px}.xit .row select,.xit .row input{font-size:13px;padding:4px 6px}.xch{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px}.xch label{display:flex;gap:6px;align-items:center}.xch input[type=text]{flex:1;min-width:0}
  .lvtag{display:inline-block;color:#fff;border-radius:99px;padding:1px 9px;font-size:12px}.xsum{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}.xsum div{flex:1;min-width:110px;border:1px solid var(--line);border-radius:12px;padding:8px;text-align:center}.xsum b{display:block;font-size:22px;color:var(--brand)}
  .xbtns{display:flex;gap:8px;flex-wrap:wrap}.xwarn{background:#fff7e6;color:#7a4b00;border:1px solid #f0c36d;border-radius:10px;padding:8px 12px;font-size:13.5px;margin:8px 0}
  #xt input[type=checkbox],#xt input[type=radio]{width:auto!important;flex:none;margin:0;min-height:0}.xit .row select{width:auto;max-width:48%;flex:0 1 auto}.xit .row input[type=number]{width:70px!important}.xch label{min-width:0}.xch input[type=text]{width:0!important;flex:1 1 0;min-width:0}.xit{min-width:0;overflow:hidden}.xles input[type=number]{width:60px!important}.xsec input{min-width:0}
  @media (max-width:640px){.xsec{grid-template-columns:1.3fr .7fr .7fr .7fr;font-size:13px}.xch{grid-template-columns:1fr}}`;
  document.head.appendChild(st);
}

async function exMeta() { if (!EX.meta) EX.meta = await api('/api/exam'); return EX.meta; }
function exApply(d) { EX.x = d.exam; EX.spec = d.spec; EX.total = d.total; EX.ai = d.ai; }
async function exSave(quiet) {
  clearTimeout(EX.timer); EX.timer = null;
  const d = await api(`/api/exam/${EX.x.id}`, { method: 'PUT', body: EX.x });
  exApply(d); if (!quiet) toast('تم الحفظ ✅');
  return d;
}
function exSoon(fn) { clearTimeout(EX.timer); EX.timer = setTimeout(async () => { try { await exSave(true); fn && fn(); } catch (e) { toast(e.message); } }, 600); }

// ---------- القائمة ----------
async function examList() {
  view.innerHTML = '<p class="muted">جاري التحميل...</p>';
  let m;
  try { EX.meta = null; m = await exMeta(); } catch (e) { view.innerHTML = `<p>${esc(e.message)}</p>`; return; }
  view.innerHTML = `${banner()}<div class="head"><div><h1 style="margin:0">📝 صانع الاختبارات</h1><p class="muted" style="margin:4px 0 0">اختر المادة والدروس، ويتبني جدول المواصفات لحاله بأوزان الدروس ومستويات المعرفة والتطبيق والاستدلال، وتنكتب الأسئلة على الجدول. تراجعها وتعدلها، وتطبع الورقة بترويسة الوزارة بنموذجين ومفتاح الإجابة وورقة التظليل، أو تنزلها Word.</p></div></div>
  ${m.list.length ? `<div class="grid g2" style="margin-bottom:16px">${m.list.map((x) => `<a class="card" href="#/exam/${x.id}" style="text-decoration:none;color:inherit">
    <div class="head" style="margin:0"><h3 style="margin:0">${esc(x.title)}</h3><span class="pill">${x.total} درجة</span></div>
    <div class="muted" style="font-size:13px;margin-top:6px">${esc(x.grade || '')} · ${x.ready}/${x.items} فقرة مكتوبة</div></a>`).join('')}</div>` : ''}
  <form id="nx" class="card"><h3 style="margin-top:0">➕ اختبار جديد</h3>
    <div class="grid g2"><div class="field"><label>نوع الاختبار</label><select name="kind">${Object.entries(m.kinds).map(([k, v]) => `<option value="${k}"${k === 'p1' ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
    <div class="field"><label>من وين الدروس؟</label><select name="src" id="xsrc">
      ${m.records.length ? `<optgroup label="سجلات المادة عندك">${m.records.map((r) => `<option value="record:${r.id}">${esc(r.subject)} ${esc(r.grade)} ${esc(r.section)} (${r.lessons} درس)</option>`).join('')}</optgroup>` : ''}
      ${m.templates.length ? `<optgroup label="مواد جاهزة من الكتاب">${m.templates.map((t) => `<option value="template:${esc(t.id)}">${esc(t.name)}، ${esc(t.stage)}</option>`).join('')}</optgroup>` : ''}
      <option value="manual:">أكتب الدروس بنفسي</option></select></div></div>
    <div id="xman" style="display:none"><div class="grid g2"><div class="field"><label>المادة</label><input name="subject" value="${esc(S.me.subject || '')}" placeholder="العلوم"></div><div class="field"><label>الصف</label><input name="grade" placeholder="الثاني المتوسط"></div></div>
      <div class="field"><label>الدروس <span class="muted">(درس في كل سطر، وتقدر تكتب عدد الحصص بعد فاصلة: «الخلية، 3». سطر يبدأ بـ«الوحدة» يصير عنوان وحدة)</span></label><textarea name="lessons_text" rows="6" placeholder="الوحدة الأولى: المادة\nخصائص المادة، 2\nحالات المادة، 3"></textarea></div></div>
    <div id="xgr" class="field"><label>الصف <span class="muted">(يظهر في الورقة)</span></label><input name="grade2" placeholder="الأول الثانوي"></div>
    <button class="btn">إنشاء الاختبار</button></form>
  <div class="card" style="margin-top:16px"><h3 style="margin-top:0">كيف يشتغل؟</h3><ol class="steps-rec">${['تختار الدروس المشمولة، ويحسب وزن كل درس بعدد حصصه.', 'تحدد نسب المستويات وأقسام الأسئلة وعددها ودرجتها، ويتوزع كل شي على جدول المواصفات.', 'تنكتب الأسئلة على كل خلية في الجدول، وتراجع كل فقرة وتعدلها أو تعيد كتابتها.', 'تطبع الورقة بالنموذجين ومفتاح الإجابة وجدول المواصفات، أو تنزلها Word، وترسلها لسجل المادة عشان ترصد الدرجات وتحلل النتائج بالمهارات.'].map((t, i) => `<li><b class="n">${i + 1}</b><span>${t}</span></li>`).join('')}</ol></div>`;
  const sync = () => { const man = $('#xsrc').value.startsWith('manual'); $('#xman').style.display = man ? '' : 'none'; $('#xgr').style.display = man || $('#xsrc').value.startsWith('record') ? 'none' : ''; };
  $('#xsrc').onchange = sync; sync();
  $('#nx').onsubmit = async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const [type, id] = f.src.split(':');
    const body = { kind: f.kind, source: { type, id }, grade: type === 'manual' ? f.grade : f.grade2, subject: f.subject, lessons_text: f.lessons_text };
    try { const d = await api('/api/exam', { method: 'POST', body }); exApply(d); location.hash = `#/exam/${d.exam.id}`; } catch (err) { toast(err.message); }
  };
}

// ---------- الاختبار ----------
const XTABS = [['setup', '⚙️ الإعداد وجدول المواصفات'], ['items', '✍️ الأسئلة'], ['export', '🖨️ الطباعة والتصدير']];
async function examView(id, tab = 'setup') {
  if (!id) return examList();
  try { await exMeta(); if (!EX.x || EX.x.id !== Number(id)) { view.innerHTML = '<p class="muted">جاري التحميل...</p>'; exApply(await api(`/api/exam/${id}`)); } } catch (e) { toast(e.message); location.hash = '#/exam'; return; }
  const x = EX.x;
  const empty = x.items.filter((it) => !it.text.trim()).length;
  view.innerHTML = `${banner()}<div class="head"><div><a href="#/exam" class="muted" style="text-decoration:none">→ كل الاختبارات</a><h1 style="margin:4px 0 0">${esc(x.title || EX.meta.kinds[x.kind])}</h1><div class="muted" style="font-size:13px">${esc(x.subject)}${x.grade ? ` · ${esc(x.grade)}` : ''} · ${x.items.length} فقرة · ${EX.total} درجة${empty ? ` · <span style="color:#b45309">${empty} بدون نص</span>` : ''}</div></div>
    <button class="btn ghost sm" id="xdel">🗑️ حذف</button></div>
  <nav class="rtabs">${XTABS.map(([k, t]) => `<a href="#/exam/${x.id}/${k}" class="${tab === k ? 'on' : ''}">${t}</a>`).join('')}</nav><div id="xt"></div>`;
  $('#xdel').onclick = async () => { if (!confirm('تحذف الاختبار نهائياً؟')) return; await api(`/api/exam/${x.id}`, { method: 'DELETE' }); EX.x = null; location.hash = '#/exam'; };
  ({ setup: xSetup, items: xItems, export: xExport }[tab] || xSetup)();
}

function specTable() {
  const sp = EX.spec;
  if (!sp.lessons.length) return '<p class="muted">أضف الدروس أولاً.</p>';
  return `<div style="overflow:auto"><table class="xspec"><thead><tr><th rowspan="2">الدرس</th><th rowspan="2">الحصص</th><th rowspan="2">الوزن</th><th colspan="3">عدد الفقرات حسب المستوى</th><th rowspan="2">المجموع</th></tr><tr>${sp.levels.map((l) => `<th>${l.name} ${l.pct}%</th>`).join('')}</tr></thead>
  <tbody>${sp.lessons.map((l) => `<tr><td class="t">${esc(l.title)}</td><td>${l.periods}</td><td>${l.weight}%</td>${l.cells.map((c) => `<td>${c || '-'}</td>`).join('')}<td><b>${l.items}</b></td></tr>`).join('')}</tbody>
  <tfoot><tr><td class="t">المجموع</td><td>${sp.periods}</td><td>100%</td>${sp.levels.map((l) => `<td>${l.items}</td>`).join('')}<td>${sp.items}</td></tr></tfoot></table></div>`;
}

function xSetup() {
  const x = EX.x; const m = EX.meta;
  const sel = new Set(x.selected.length ? x.selected : x.lessons.map((l) => l.id));
  const lvSum = () => m.levels.reduce((a, l) => a + (Number(x.levels[l.key]) || 0), 0);
  const secOf = (t) => x.sections.find((s) => s.type === t) || { type: t, count: 0, mark: 1 };
  $('#xt').innerHTML = `<div class="card"><h3 style="margin-top:0">بيانات الورقة</h3>
    <div class="grid g3">
      <div class="field"><label>نوع الاختبار</label><select data-f="kind">${Object.entries(m.kinds).map(([k, v]) => `<option value="${k}"${x.kind === k ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div>
      <div class="field"><label>عنوان خاص <span class="muted">(اختياري)</span></label><input data-f="title" value="${esc(x.title)}" placeholder="${esc(m.kinds[x.kind])}"></div>
      <div class="field"><label>المادة</label><input data-f="subject" value="${esc(x.subject)}"></div>
      <div class="field"><label>الصف</label><input data-f="grade" value="${esc(x.grade)}" placeholder="الأول الثانوي"></div>
      <div class="field"><label>الفصل الدراسي</label><input data-f="term" value="${esc(x.term)}"></div>
      <div class="field"><label>العام الدراسي</label><input data-f="year" value="${esc(x.year)}" placeholder="1448هـ"></div>
      <div class="field"><label>التاريخ</label><input type="date" data-f="date" value="${esc(x.date)}"></div>
      <div class="field"><label>الزمن بالدقائق</label><input type="number" min="0" max="300" data-f="duration" value="${x.duration}"></div>
      <div class="field"><label>ملاحظة للطلاب <span class="muted">(اختياري)</span></label><input data-f="notes" value="${esc(x.notes)}" placeholder="يسمح باستخدام الآلة الحاسبة"></div>
    </div></div>
  <div class="card"><div class="head" style="margin:0 0 6px"><h3 style="margin:0">الدروس المشمولة</h3><span class="xbtns"><button class="btn ghost sm" id="xall">تحديد الكل</button><button class="btn ghost sm" id="xnone">إلغاء الكل</button></span></div>
    <p class="muted" style="font-size:13px;margin:0 0 6px">وزن الدرس = عدد حصصه من مجموع الحصص. «محتوى الدرس» اختياري: إذا لصقت نص الدرس تنكتب الأسئلة منه بالضبط.</p>
    <div style="overflow:auto"><table class="xles"><thead><tr><th></th><th>الدرس</th><th>الحصص</th><th></th></tr></thead><tbody>${x.lessons.map((l, i) => `<tr><td><input type="checkbox" data-sel="${l.id}"${sel.has(l.id) ? ' checked' : ''}></td>
      <td>${esc(l.title)}${l.unit ? `<div class="muted" style="font-size:12px">${esc(l.unit)}</div>` : ''}${l.content ? '<div style="font-size:12px;color:var(--brand)">✓ فيه محتوى ملصوق</div>' : ''}</td>
      <td><input type="number" min="1" max="10" data-per="${i}" value="${l.periods}"></td><td><button class="btn ghost sm" data-cnt="${i}" title="محتوى الدرس">📄</button></td></tr>
      <tr id="xc${i}" style="display:none"><td></td><td colspan="3"><textarea data-content="${i}" rows="4" style="width:100%;box-sizing:border-box" placeholder="الصق هنا نص الدرس من الكتاب أو ملخصه (اختياري)">${esc(l.content)}</textarea></td></tr>`).join('')}</tbody></table></div>
    <details style="margin-top:8px"><summary class="muted" style="cursor:pointer">➕ إضافة دروس</summary><div class="field" style="margin-top:6px"><textarea id="xadd" rows="4" placeholder="درس في كل سطر، ويمكن «اسم الدرس، 2» لعدد الحصص"></textarea></div><button class="btn ghost sm" id="xaddb">إضافة</button></details></div>
  <div class="grid g2"><div class="card"><h3 style="margin-top:0">مستويات الأسئلة</h3>
    ${m.levels.map((l) => `<div class="field"><label><span class="lvtag" style="background:${LV_COLOR[l.key]}">${l.name}</span> <span class="muted" style="font-size:12.5px">${esc(l.desc)}</span></label><input type="number" min="0" max="100" data-lv="${l.key}" value="${x.levels[l.key] || 0}"></div>`).join('')}
    <div id="xlvs" class="muted" style="font-size:13px"></div></div>
  <div class="card"><h3 style="margin-top:0">أقسام الأسئلة</h3>
    <div class="xsec muted" style="font-size:12.5px"><span>النوع</span><span>عدد الفقرات</span><span>درجة الفقرة</span><span>المجموع</span></div>
    ${Object.entries(m.types).map(([t, name]) => { const s = secOf(t); return `<div class="xsec"><span>${esc(name)}</span><input type="number" min="0" max="40" data-cnt-t="${t}" value="${s.count}"><input type="number" min="0.25" max="20" step="0.25" data-mk-t="${t}" value="${s.mark}"><span class="center" data-tot-t="${t}">${s.count * s.mark}</span></div>`; }).join('')}
    <div class="xsum"><div>الفقرات<b id="xn">${EX.spec.items}</b></div><div>الدرجة الكلية<b id="xm">${EX.spec.marks}</b></div></div>
    <button class="btn ghost sm" id="xpre">رجّع الإعدادات المقترحة لنوع الاختبار</button></div></div>
  <div class="card"><div class="head" style="margin:0 0 6px"><h3 style="margin:0">📐 جدول المواصفات</h3><span class="muted" style="font-size:13px">يتحدث مع كل تعديل</span></div><div id="xspec">${specTable()}</div>
    <div class="xbtns" style="margin-top:12px"><button class="btn" id="xgen">✍️ ${x.items.length ? 'أعد بناء الأسئلة من الجدول' : 'اكتب الأسئلة حسب الجدول'}</button>${x.items.length ? `<a class="btn ghost" href="#/exam/${x.id}/items">راجع الأسئلة الحالية (${x.items.length})</a>` : ''}</div>
    ${EX.ai ? '' : '<p class="muted" style="font-size:13px">الكتابة الآلية غير متاحة الآن: بنجهز لك الفقرات فاضية على الجدول (النوع والدرس والمستوى) وتكتب نصها.</p>'}</div>`;

  const refresh = () => { $('#xspec').innerHTML = specTable(); $('#xn').textContent = EX.spec.items; $('#xm').textContent = EX.spec.marks; };
  const lvInfo = () => { const s = lvSum(); $('#xlvs').innerHTML = s === 100 ? 'المجموع 100% ✓' : `<span style="color:#b45309">المجموع ${s}%، نوزعها بالنسبة (الأفضل يكون 100%)</span>`; };
  lvInfo();
  const fields = { duration: Number };
  $('#xt').querySelectorAll('[data-f]').forEach((el) => { el.onchange = () => { const k = el.dataset.f; x[k] = fields[k] ? fields[k](el.value) : el.value; exSoon(k === 'kind' ? () => examView(x.id, 'setup') : null); }; });
  const selSync = () => { x.selected = [...$('#xt').querySelectorAll('[data-sel]')].filter((c) => c.checked).map((c) => c.dataset.sel); exSoon(refresh); };
  $('#xt').querySelectorAll('[data-sel]').forEach((c) => { c.onchange = selSync; });
  $('#xall').onclick = () => { $('#xt').querySelectorAll('[data-sel]').forEach((c) => { c.checked = true; }); selSync(); };
  $('#xnone').onclick = () => { $('#xt').querySelectorAll('[data-sel]').forEach((c) => { c.checked = false; }); x.selected = []; toast('اختر درس واحد على الأقل، وإلا يدخل كل الدروس'); exSoon(refresh); };
  $('#xt').querySelectorAll('[data-per]').forEach((el) => { el.onchange = () => { x.lessons[el.dataset.per].periods = Number(el.value) || 1; exSoon(refresh); }; });
  $('#xt').querySelectorAll('[data-cnt]').forEach((b) => { b.onclick = () => { const r = $(`#xc${b.dataset.cnt}`); r.style.display = r.style.display === 'none' ? '' : 'none'; }; });
  $('#xt').querySelectorAll('[data-content]').forEach((el) => { el.onchange = () => { x.lessons[el.dataset.content].content = el.value; exSoon(); }; });
  $('#xt').querySelectorAll('[data-lv]').forEach((el) => { el.oninput = () => { x.levels[el.dataset.lv] = Number(el.value) || 0; lvInfo(); exSoon(refresh); }; });
  const secSync = (t) => {
    const c = Number($(`[data-cnt-t=${t}]`).value) || 0; const mk = Number($(`[data-mk-t=${t}]`).value) || 1;
    $(`[data-tot-t=${t}]`).textContent = Math.round(c * mk * 100) / 100;
    const s = x.sections.find((z) => z.type === t);
    if (s) Object.assign(s, { count: c, mark: mk }); else x.sections.push({ type: t, count: c, mark: mk });
    exSoon(refresh);
  };
  Object.keys(m.types).forEach((t) => { $(`[data-cnt-t=${t}]`).oninput = () => secSync(t); $(`[data-mk-t=${t}]`).oninput = () => secSync(t); });
  $('#xpre').onclick = () => { const p = m.presets[x.kind]; x.levels = { ...p.levels }; x.sections = p.sections.map((s) => ({ ...s })); x.duration = p.duration; exSoon(() => examView(x.id, 'setup')); };
  $('#xaddb').onclick = async () => {
    const t = $('#xadd').value.trim(); if (!t) return;
    const { items } = await api('/api/exam-parse', { method: 'POST', body: { text: t } });
    x.lessons.push(...items.map((l) => ({ ...l, objectives: [] })));
    if (x.selected.length) x.selected.push(...items.map((l) => l.id));
    await exSave(true); examView(x.id, 'setup');
  };
  $('#xgen').onclick = async (e) => {
    if (EX.spec.items === 0) return toast('حدد عدد الفقرات في أقسام الأسئلة');
    if (x.items.some((it) => it.text.trim()) && !confirm('بنكتب الأسئلة من جديد ونستبدل الحالية. تكمل؟')) return;
    const b = e.target; b.disabled = true; b.textContent = EX.ai ? '⏳ جاري كتابة الأسئلة... (دقيقة تقريباً)' : '⏳ جاري التجهيز...';
    try {
      await exSave(true);
      const d = await api(`/api/exam/${x.id}/generate`, { method: 'POST', body: { mode: 'all' } });
      exApply(d);
      toast(d.source === 'ai' ? (d.missing ? `انكتبت الأسئلة، وباقي ${d.missing} فقرة تكملها` : 'انكتبت الأسئلة ✅ راجعها قبل الطباعة') : 'تجهزت الفقرات على الجدول، اكتب نصها');
      location.hash = `#/exam/${x.id}/items`;
    } catch (err) { toast(err.message); b.disabled = false; b.textContent = '✍️ اكتب الأسئلة حسب الجدول'; }
  };
}

function xItems() {
  const x = EX.x; const m = EX.meta;
  if (!x.items.length) { $('#xt').innerHTML = `<div class="card center"><p>ما فيه أسئلة بعد.</p><a class="btn" href="#/exam/${x.id}/setup">ارجع لجدول المواصفات واكتب الأسئلة</a></div>`; return; }
  const lessonOpts = (sel) => x.lessons.map((l) => `<option value="${l.id}"${l.id === sel ? ' selected' : ''}>${esc(l.title)}</option>`).join('');
  const lvOpts = (sel) => m.levels.map((l) => `<option value="${l.key}"${l.key === sel ? ' selected' : ''}>${l.name}</option>`).join('');
  const empty = x.items.filter((it) => !it.text.trim()).length;
  const order = Object.keys(m.types);
  const groups = order.map((t) => [t, x.items.filter((it) => it.type === t)]).filter(([, g]) => g.length);
  const card = (it, n) => `<div class="xit${it.text.trim() ? '' : ' empty'}" data-id="${it.id}">
    <div class="row"><b>${n})</b><span class="lvtag" style="background:${LV_COLOR[it.level]}">${(m.levels.find((l) => l.key === it.level) || {}).name}</span>
      <select data-k="lesson" title="الدرس">${lessonOpts(it.lesson)}</select><select data-k="level" title="المستوى">${lvOpts(it.level)}</select>
      <label>الدرجة <input type="number" min="0.25" max="20" step="0.25" data-k="mark" value="${it.mark}" style="width:60px"></label>
      <span style="flex:1"></span>${EX.ai ? '<button class="btn ghost sm" data-act="redo" title="إعادة كتابة">🔄</button>' : ''}<button class="btn ghost sm" data-act="del" title="حذف">🗑️</button></div>
    <textarea data-k="text" placeholder="${it.type === 'match' ? 'المصطلح (العمود أ)' : it.type === 'fill' ? 'الجملة مع ............ مكان الفراغ' : 'نص السؤال'}">${esc(it.text)}</textarea>
    ${it.type === 'mcq' ? `<div class="xch">${[0, 1, 2, 3].map((k) => `<label><input type="radio" name="a${it.id}" data-ans="${k}"${it.choices[k] != null && it.choices[k] === it.answer && it.answer ? ' checked' : ''} title="الإجابة الصحيحة"><b>${LETTERS[k]})</b><input type="text" data-ch="${k}" value="${esc(it.choices[k] || '')}"></label>`).join('')}</div><div class="muted" style="font-size:12px;margin-top:4px">حدد الدائرة عند الإجابة الصحيحة</div>`
      : it.type === 'tf' ? `<div class="row" style="margin-top:6px">الإجابة: <select data-k="answer"><option${it.answer === 'صح' ? ' selected' : ''}>صح</option><option${it.answer === 'خطأ' ? ' selected' : ''}>خطأ</option></select></div>`
      : `<div class="field" style="margin:6px 0 0"><label style="font-size:13px">${it.type === 'match' ? 'ما يقابله (العمود ب)' : it.type === 'fill' ? 'الكلمة الناقصة' : 'الإجابة النموذجية ونقاط التصحيح'}</label><textarea data-k="answer" style="min-height:${it.type === 'essay' || it.type === 'short' ? 70 : 40}px">${esc(it.answer)}</textarea></div>`}
  </div>`;
  let n = 0;
  $('#xt').innerHTML = `${empty ? `<div class="xwarn">باقي ${empty} ${empty > 10 ? 'فقرة' : 'فقرات'} بدون نص (بإطار برتقالي).${EX.ai ? ' <button class="btn sm" id="xfill">✍️ اكتبها آلياً</button>' : ''}</div>` : ''}
  <div class="xsum"><div>الفقرات<b>${x.items.length}</b></div><div>الدرجة<b>${EX.total}</b></div>${m.levels.map((l) => `<div>${l.name}<b style="color:${LV_COLOR[l.key]}">${x.items.filter((it) => it.level === l.key).length}</b></div>`).join('')}</div>
  ${groups.map(([t, g]) => `<div class="card"><div class="head" style="margin:0 0 8px"><h3 style="margin:0">${esc(m.types[t])} <span class="muted" style="font-size:13px">(${g.length} فقرة · ${g.reduce((a, it) => a + it.mark, 0)} درجة)</span></h3><button class="btn ghost sm" data-add="${t}">➕ فقرة</button></div>${g.map((it, i) => card(it, i + 1)).join('')}</div>`).join('')}
  <div class="card"><div class="xbtns"><select id="xaddt">${order.map((t) => `<option value="${t}">${esc(m.types[t])}</option>`).join('')}</select><button class="btn ghost" id="xaddq">➕ أضف قسم/فقرة</button><span style="flex:1"></span><button class="btn" id="xsv">💾 حفظ</button><a class="btn ghost" href="#/exam/${x.id}/export">التالي: الطباعة ←</a></div></div>`;

  const itemOf = (el) => x.items.find((it) => it.id === el.closest('.xit').dataset.id);
  $('#xt').querySelectorAll('.xit [data-k]').forEach((el) => {
    el.oninput = el.onchange = () => {
      const it = itemOf(el); const k = el.dataset.k;
      it[k] = k === 'mark' ? Number(el.value) || 1 : el.value;
      if (k === 'text') el.closest('.xit').classList.toggle('empty', !el.value.trim());
      exSoon();
    };
  });
  $('#xt').querySelectorAll('[data-ch]').forEach((el) => {
    el.oninput = () => {
      const it = itemOf(el); const k = Number(el.dataset.ch); const was = it.choices[k];
      while (it.choices.length <= k) it.choices.push('');
      it.choices[k] = el.value;
      if (was === it.answer && was) it.answer = el.value;
      exSoon();
    };
  });
  $('#xt').querySelectorAll('[data-ans]').forEach((el) => { el.onchange = () => { const it = itemOf(el); it.answer = it.choices[Number(el.dataset.ans)] || ''; exSoon(); }; });
  $('#xt').querySelectorAll('[data-act=del]').forEach((b) => { b.onclick = async () => { const it = itemOf(b); x.items = x.items.filter((z) => z !== it); await exSave(true); examView(x.id, 'items'); }; });
  $('#xt').querySelectorAll('[data-act=redo]').forEach((b) => {
    b.onclick = async () => {
      const it = itemOf(b);
      const hint = prompt('ملاحظة لإعادة الكتابة (اختياري): مثلاً «أسهل» أو «سؤال عن مثال من الحياة»', '');
      if (hint === null) return;
      b.disabled = true; b.textContent = '⏳';
      try { await exSave(true); exApply(await api(`/api/exam/${x.id}/item`, { method: 'POST', body: { item: it.id, hint } })); examView(x.id, 'items'); toast('تمت إعادة الكتابة'); } catch (e) { toast(e.message); b.disabled = false; b.textContent = '🔄'; }
    };
  });
  const add = async (t) => {
    const last = [...x.items].reverse().find((it) => it.type === t);
    const sec = x.sections.find((s) => s.type === t);
    const it = { id: exRid(), type: t, lesson: (last || x.items[0] || {}).lesson || (x.lessons[0] || {}).id || '', level: (last || {}).level || 'know', text: '', choices: t === 'mcq' ? ['', '', '', ''] : [], answer: t === 'tf' ? 'صح' : '', mark: (last || sec || {}).mark || 1 };
    const at = last ? x.items.indexOf(last) + 1 : x.items.length;
    x.items.splice(at, 0, it);
    await exSave(true); examView(x.id, 'items');
    setTimeout(() => document.querySelector(`.xit[data-id="${it.id}"] textarea`)?.focus(), 50);
  };
  $('#xt').querySelectorAll('[data-add]').forEach((b) => { b.onclick = () => add(b.dataset.add); });
  $('#xaddq').onclick = () => add($('#xaddt').value);
  $('#xsv').onclick = async () => { try { await exSave(); examView(x.id, 'items'); } catch (e) { toast(e.message); } };
  if ($('#xfill')) $('#xfill').onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = '⏳ جاري الكتابة...';
    try { await exSave(true); const d = await api(`/api/exam/${x.id}/generate`, { method: 'POST', body: { mode: 'empty' } }); exApply(d); examView(x.id, 'items'); toast(d.missing ? `باقي ${d.missing}` : 'اكتملت الفقرات ✅'); } catch (err) { toast(err.message); e.target.disabled = false; }
  };
}

function xExport() {
  const x = EX.x; const m = EX.meta; const o = x.options;
  const empty = x.items.filter((it) => !it.text.trim()).length;
  const noAns = x.items.filter((it) => it.text.trim() && !String(it.answer).trim()).length;
  const objN = x.items.filter((it) => it.type === 'mcq' || it.type === 'tf').length;
  const opt = (k, label, on) => `<label style="display:flex;gap:8px;align-items:center;margin:6px 0"><input type="checkbox" data-o="${k}"${on ? ' checked' : ''}> ${label}</label>`;
  $('#xt').innerHTML = `${empty || noAns ? `<div class="xwarn">${empty ? `${empty} فقرة بدون نص. ` : ''}${noAns ? `${noAns} فقرة بدون إجابة في المفتاح.` : ''} <a href="#/exam/${x.id}/items">أكملها</a></div>` : ''}
  <div class="grid g2"><div class="card"><h3 style="margin-top:0">محتويات الملف</h3>
    ${opt('versions', 'نموذجين (أ) و(ب): نفس الأسئلة بترتيب مختلف للفقرات والخيارات', o.versions === 2)}
    ${opt('key', 'مفتاح الإجابة مع الدرس والمستوى ودرجة كل فقرة', o.key)}
    ${opt('spec', 'جدول المواصفات للتوقيع والاعتماد', o.spec)}
    ${opt('bubble', `ورقة تظليل لفقرات الاختيار والصح والخطأ (${objN} فقرة)`, o.bubble)}
    ${opt('names', 'خانة اسم الطالب والفصل ورقم الجلوس', o.names)}
    <p class="muted" style="font-size:12.5px">الترويسة من بيانات مدرستك في «ملفي» (إدارة التعليم واسم المدرسة).</p></div>
  <div class="card"><h3 style="margin-top:0">اطبع أو نزّل</h3><div class="xbtns" style="flex-direction:column;align-items:stretch">
    <a class="btn" href="/exam/${x.id}/print" target="_blank">🖨️ الملف كامل (PDF)</a>
    <a class="btn ghost" href="/exam/${x.id}/docx">📄 ورقة الأسئلة ومفتاحها Word قابل للتعديل</a>
    <div class="xbtns"><a class="btn ghost sm" href="/exam/${x.id}/print?k=paper" target="_blank">ورقة الأسئلة فقط</a>${o.versions === 2 ? `<a class="btn ghost sm" href="/exam/${x.id}/print?k=b" target="_blank">النموذج (ب)</a>` : ''}<a class="btn ghost sm" href="/exam/${x.id}/print?k=key" target="_blank">المفتاح</a><a class="btn ghost sm" href="/exam/${x.id}/print?k=spec" target="_blank">جدول المواصفات</a>${objN ? `<a class="btn ghost sm" href="/exam/${x.id}/print?k=bubble" target="_blank">ورقة التظليل</a>` : ''}</div></div></div></div>
  <div class="card"><h3 style="margin-top:0">📚 أرسله لسجل المادة</h3>
    <p class="muted" style="font-size:13.5px;margin-top:0">يدخل الاختبار في سجل الشعبة بأسئلته ودرجاته ومربوط بمهارات الدروس، فترصد الدرجات وتطلع لك تحليل النتائج بالمهارات والخطط العلاجية والشاهد لملف الإنجاز.</p>
    ${m.records.length ? `<div class="xbtns"><select id="xrec">${m.records.map((r) => `<option value="${r.id}"${x.rec_id === r.id ? ' selected' : ''}>${esc(r.subject)} ${esc(r.grade)} ${esc(r.section)}</option>`).join('')}</select><button class="btn" id="xsend">إرسال للسجل</button></div><p class="muted" style="font-size:12.5px">لكل شعبة سجل، تقدر ترسل نفس الاختبار لأكثر من شعبة.</p>` : `<p>ما عندك سجل مادة بعد. <a href="#/rec">أنشئ سجل لشعبتك</a> ثم ارجع هنا.</p>`}</div>`;
  $('#xt').querySelectorAll('[data-o]').forEach((c) => { c.onchange = async () => { o[c.dataset.o] = c.dataset.o === 'versions' ? (c.checked ? 2 : 1) : c.checked; await exSave(true); xExport(); }; });
  if ($('#xsend')) $('#xsend').onclick = async (e) => {
    e.target.disabled = true;
    try { const r = await api(`/api/exam/${x.id}/to-record`, { method: 'POST', body: { rec_id: Number($('#xrec').value) } }); x.rec_id = r.rec_id; toast(`انضاف للسجل ✅ (${r.linked} من ${r.items} فقرة مربوطة بمهارة)`); if (window.RC) RC.rec = null; setTimeout(() => { location.hash = `#/rec/${r.rec_id}/tests`; }, 900); } catch (err) { toast(err.message); e.target.disabled = false; }
  };
}

window.examView = examView;
