/* السجلات اليومية: انتظار، مناوبة، تعاميم، لجان، تواصل، مبادرات */
const LG = { kinds: null, logs: [], summary: null };
const lgToday = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const lgHd = (s) => { if (!s) return ''; try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(s + 'T12:00:00Z')); } catch { return s; } };

if (!document.getElementById('logs-css')) {
  const st = document.createElement('style'); st.id = 'logs-css';
  st.textContent = `.lg-kinds{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;margin-bottom:16px}.lg-k{display:flex;gap:10px;align-items:center;text-decoration:none;color:inherit}.lg-k .ic{font-size:26px}.lg-k b{display:block}
  .lg-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:start;padding:10px 0;border-bottom:1px solid var(--line)}.lg-row:last-child{border:0}.lg-d{font-size:12.5px;color:var(--muted);min-width:84px}.lg-t{font-size:14px}.lg-t .muted{font-size:12.5px}
  .lg-acts{display:flex;gap:4px;flex-wrap:wrap}.st-open{background:#fef3c7;color:#92400e}.st-closed{background:#dcfce7;color:#166534}.lg-pill{display:inline-block;border-radius:99px;padding:1px 9px;font-size:12px}
  .lg-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin:6px 0 12px}.lg-bar .field{margin:0}.imp{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0}.imp div{border:1px solid var(--line);border-radius:10px;padding:6px;text-align:center;font-size:12px}.imp b{display:block;font-size:18px;color:var(--brand)}
  @media(max-width:600px){.lg-row{grid-template-columns:1fr}.lg-acts{justify-content:flex-start}}`;
  document.head.appendChild(st);
}

async function lgLoad(kind) {
  const d = await api(`/api/logs${kind ? `?kind=${kind}` : ''}`);
  Object.assign(LG, d);
  if (d.summary) S.logs = d.summary;
}

function lgField(f, v) {
  const req = f.req ? 'required' : '';
  const lab = `<label>${esc(f.label)}${f.req ? '' : ''}</label>`;
  if (f.type === 'textarea') return `<div class="field" style="grid-column:1/-1">${lab}<textarea name="${f.key}" rows="2" ${req} placeholder="${esc(f.ph || '')}">${esc(v ?? '')}</textarea></div>`;
  if (f.type === 'select') {
    const opts = f.stdPick ? S.standards.map((s) => [String(s.id), `${s.no}. ${s.name}`]) : f.opts.map((o) => [o, o]);
    const cur = v == null || v === '' ? (f.stdPick ? String((S.standards.find((s) => s.no === 5) || S.standards[0]).id) : '') : String(v);
    return `<div class="field">${lab}<select name="${f.key}" ${req}>${f.stdPick ? '' : '<option value="">اختر</option>'}${opts.map(([k, t]) => `<option value="${esc(k)}" ${cur === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
  }
  if (f.type === 'number') return `<div class="field">${lab}<input name="${f.key}" type="number" inputmode="decimal" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} step="${f.step || 1}" ${req} value="${v ?? ''}"></div>`;
  if (f.type === 'date') return `<div class="field">${lab}<input name="${f.key}" type="date" ${req} value="${esc(v || '')}"></div>`;
  return `<div class="field">${lab}<input name="${f.key}" ${req} maxlength="200" placeholder="${esc(f.ph || '')}" value="${esc(v ?? '')}"></div>`;
}

function lgForm(K, r) {
  const d = (r && r.data) || {};
  return `<form id="lgf" class="card"><h3 style="margin-top:0">${r ? '✏️ تعديل' : '➕ إضافة إلى السجل'}</h3>
    <div class="grid g3"><div class="field"><label>${K.single ? 'تاريخ البدء' : 'التاريخ'}</label><input name="__date" type="date" required value="${esc((r && r.date) || lgToday())}"></div>
    ${K.fields.map((f) => lgField(f, d[f.key])).join('')}
    ${K.follow ? `<div class="field"><label>الحالة</label><select name="__status"><option value="open" ${!r || r.status !== 'closed' ? 'selected' : ''}>مفتوحة (تحتاج متابعة)</option><option value="closed" ${r && r.status === 'closed' ? 'selected' : ''}>مغلقة</option></select></div>
    <div class="field"><label>موعد المتابعة (اختياري)</label><input name="__follow" type="date" value="${esc((r && r.follow_up) || '')}"></div>` : ''}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn">${r ? 'حفظ التعديل' : 'حفظ'}</button>${r ? `<a class="btn ghost" href="#/logs/${K.key}">إلغاء</a><button type="button" class="btn ghost" id="lgdel" style="color:#b91c1c">حذف</button>` : ''}</div></form>`;
}

function lgBind(K, r) {
  const f = $('#lgf');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(f));
    const body = { kind: K.key, date: fd.__date, status: fd.__status, follow_up: fd.__follow, data: {} };
    for (const x of K.fields) body.data[x.key] = fd[x.key];
    try {
      await api(r ? `/api/logs/${r.id}` : '/api/logs', { method: r ? 'PUT' : 'POST', body });
      toast(r ? 'تم الحفظ ✅' : 'تمت الإضافة ✅');
      if (r) location.hash = `#/logs/${K.key}`; else logsView(K.key);
    } catch (err) { toast(err.message); }
  };
  if (r && $('#lgdel')) $('#lgdel').onclick = async () => { if (!confirm('حذف هذا السجل؟')) return; await api(`/api/logs/${r.id}`, { method: 'DELETE' }); toast('تم الحذف'); location.hash = `#/logs/${K.key}`; };
}

const lgLine = (K, r) => {
  const d = r.data;
  const main = { wait: `الحصة ${d.period} · ${d.cls} · ${d.activity}`, duty: `${d.type}${d.place ? ` · ${d.place}` : ''}`, circular: `${d.no ? `${d.no} · ` : ''}${d.subject}`, committee: `${d.type}: ${d.title}${d.role ? ` (${d.role})` : ''}`, contact: `${d.party}${d.student ? ` (${d.student})` : ''} · ${d.reason}${d.channel ? ` · ${d.channel}` : ''}`, initiative: d.title }[K.key];
  const sub = { wait: d.done, duty: d.notes, circular: d.action, committee: d.decisions || d.topics, contact: d.summary + (d.outcome ? ` ← ${d.outcome}` : ''), initiative: d.goal }[K.key];
  return `<div class="lg-row"><div class="lg-d">${esc(lgHd(r.date))}</div><div class="lg-t"><div>${esc(main)}${K.follow ? ` <span class="lg-pill ${r.status === 'closed' ? 'st-closed' : 'st-open'}">${r.status === 'closed' ? 'مغلقة' : `مفتوحة${r.follow_up ? ` · متابعة ${esc(lgHd(r.follow_up))}` : ''}`}</span>` : ''}</div>${sub ? `<div class="muted">${esc(sub)}</div>` : ''}
    ${r.impact ? (r.impact.diff == null ? `<div class="muted" style="font-size:12.5px">${esc(r.impact.text)}</div>` : `<div class="imp"><div><b>${r.impact.pre}%</b>القبلي</div><div><b>${r.impact.post}%</b>البعدي</div><div><b><bdi dir="ltr">${r.impact.diff > 0 ? '+' : ''}${r.impact.diff}</bdi></b>نقطة مئوية</div></div>`) : ''}</div>
    <div class="lg-acts">${K.follow && r.status !== 'closed' ? `<button class="btn soft sm" onclick="lgClose(${r.id})">✔️ أغلق</button>` : ''}${K.single ? `<a class="btn ghost sm" target="_blank" href="/print/logs/item/${r.id}">🖨️ تقرير</a><button class="btn soft sm" onclick="lgEvidence({id:${r.id}})">📎 شاهد</button>` : ''}<a class="btn ghost sm" href="#/logs/${K.key}/${r.id}">✏️</a></div></div>`;
};

window.lgClose = async (id) => { const r = LG.logs.find((x) => x.id === id); if (!r) return; try { await api(`/api/logs/${id}`, { method: 'PUT', body: { ...r, status: 'closed' } }); toast('أُغلقت ✅'); logsView(r.kind); } catch (e) { toast(e.message); } };
window.lgEvidence = async (body) => {
  try { const { evidence } = await api('/api/logs/evidence', { method: 'POST', body }); await loadEvs(); toast('انضاف الشاهد ✅ راجعه وعدّله إذا تبي'); location.hash = `#/edit/${evidence.id}`; } catch (e) { toast(e.message); }
};

async function logsHome() {
  const s = LG.summary;
  view.innerHTML = `${banner()}<div class="head"><div><h1 style="margin:0">🗂️ السجلات اليومية</h1><p class="muted" style="margin:4px 0 0">سجّل أعمالك اليومية بدقيقة، وكل سجل ينطبع بترويسة الوزارة ويتحول لشاهد على عنصره بضغطة.</p></div></div>
  ${s.due.length ? `<div class="card" style="border:2px solid #f59e0b;margin-bottom:14px"><h3 style="margin-top:0">🔔 متابعات مستحقة (${s.due.length})</h3>${s.due.map((r) => lgLine(LG.kinds.contact, r)).join('')}</div>` : ''}
  <div class="lg-kinds">${Object.values(LG.kinds).map((K) => `<a class="card lg-k" href="#/logs/${K.key}"><span class="ic">${K.icon}</span><span><b>${esc(K.name)}</b><span class="muted" style="font-size:12.5px">${s.counts[K.key] ? `${s.counts[K.key]} سجل` : 'ابدأ أول سجل'}${K.key === 'contact' && s.open ? ` · ${s.open} مفتوحة` : ''}</span></span></a>`).join('')}</div>
  <p class="muted" style="font-size:12.5px">💡 لا تكتب أسماء الطلاب في السجلات، استخدم رمزاً أو رقماً. النماذج المطبوعة من إعدادك لتوثيق عملك، وليست نماذج رسمية صادرة عن الوزارة.</p>`;
}

async function logsKind(kind, id) {
  const K = LG.kinds[kind];
  if (!K) { location.hash = '#/logs'; return; }
  const r = id ? LG.logs.find((x) => x.id === Number(id)) : null;
  if (id && !r) { location.hash = `#/logs/${kind}`; return; }
  const q = new URLSearchParams((location.hash.split('?')[1]) || '');
  const from = q.get('from') || '', to = q.get('to') || '';
  const rows = LG.logs.filter((x) => (!from || x.date >= from) && (!to || x.date <= to));
  const qs = new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  view.innerHTML = `${banner()}<div class="head"><div><a href="#/logs" class="muted" style="text-decoration:none">→ السجلات</a><h1 style="margin:4px 0 0">${K.icon} ${esc(K.name)}</h1><div class="muted" style="font-size:13px">${esc(K.hint)}</div></div></div>
  ${lgForm(K, r)}
  ${r ? '' : `<div class="card" style="margin-top:14px"><div class="head" style="margin:0 0 4px"><h3 style="margin:0">السجل (${rows.length})</h3>
    ${K.single ? '' : `<div style="display:flex;gap:6px;flex-wrap:wrap"><a class="btn ghost sm" target="_blank" href="/print/logs/${kind}${qs ? `?${qs}` : ''}">🖨️ طباعة السجل</a>${rows.length ? `<button class="btn soft sm" id="lgev">📎 حوّله لشاهد</button>` : ''}</div>`}</div>
    ${K.single ? '' : `<form class="lg-bar" id="lgfl"><div class="field"><label class="muted" style="font-size:12px">من</label><input type="date" name="from" value="${esc(from)}"></div><div class="field"><label class="muted" style="font-size:12px">إلى</label><input type="date" name="to" value="${esc(to)}"></div><button class="btn ghost sm">تصفية</button>${from || to ? `<a class="btn ghost sm" href="#/logs/${kind}">الكل</a>` : ''}</form>`}
    ${rows.map((x) => lgLine(K, x)).join('') || '<p class="muted">ما فيه سجلات بعد.</p>'}</div>`}`;
  lgBind(K, r);
  if ($('#lgfl')) $('#lgfl').onsubmit = (e) => { e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const s = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString(); location.hash = `#/logs/${kind}${s ? `?${s}` : ''}`; };
  if ($('#lgev')) $('#lgev').onclick = () => lgEvidence({ kind, from, to });
}

window.logsView = async (kind, id) => {
  view.innerHTML = '<p class="muted">جاري التحميل...</p>';
  try { await lgLoad(kind); } catch (e) { view.innerHTML = `<p>${esc(e.message)}</p>`; return; }
  return kind ? logsKind(kind, id) : logsHome();
};
