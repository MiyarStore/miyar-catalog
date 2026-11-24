// طباعة «التقييم الذاتي» بسلّم التقدير الرسمي، بترويسة الوزارة
const { letterheadHtml, LH_CSS, esc } = require('./school/export');
const { ROLES, roleKey } = require('./standards');
const RUB = require('./rubric');
const F = require('./fmt');

const CSS = `${LH_CSS}
@page { size: A4; margin: 12mm; }
* { box-sizing: border-box; } body { margin: 0; font-family: 'IBM Plex Sans Arabic', Tahoma, sans-serif; background: #e9eeed; color: #10201e; font-size: 12.5px; }
.toolbar { position: sticky; top: 0; background: #fff; border-bottom: 1px solid #dde5e3; padding: 10px 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; z-index: 3; }
.btn { background: #0f766e; color: #fff; border: 0; border-radius: 10px; padding: 8px 14px; font: inherit; font-weight: 600; cursor: pointer; text-decoration: none; } .btn.ghost { background: #eef4f3; color: #0f3b37; }
.page { background: #fff; width: 210mm; max-width: 100%; margin: 16px auto; padding: 14mm; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
h1 { text-align: center; font-size: 20px; margin: 6px 0 2px; color: #0f3b37; } .center { text-align: center; } .muted { color: #5b6b69; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; } th, td { border: 1px solid #cfd8d6; padding: 6px 7px; vertical-align: top; text-align: right; }
th { background: #0f766e; color: #fff; font-weight: 600; } td.c { text-align: center; white-space: nowrap; }
.info td, .info th { background: none; color: #10201e; } .info th { background: #f1f6f5; width: 26mm; }
.kpi { display: flex; gap: 10px; margin: 12px 0; } .kpi div { flex: 1; border: 1px solid #cfd8d6; border-radius: 10px; padding: 8px; text-align: center; } .kpi b { display: block; font-size: 20px; color: #0f766e; }
.lvl { font-size: 11.5px; } .next { color: #8a5a00; font-size: 11.5px; }
.sign { display: flex; justify-content: space-between; margin-top: 16mm; } .note { font-size: 11px; margin-top: 8px; }
@media print { body { background: #fff; } .toolbar { display: none; } .page { margin: 0; box-shadow: none; width: auto; padding: 0; } tr { break-inside: avoid; } }`;

function build({ u, ratings, counts = {} }) {
  const c = RUB.calc(u.role, ratings);
  const school = { office: u.office, name: u.school, year: u.year, ministry_number: '' };
  const g = F.G(u);
  const who = roleKey(u.role) === 'teacher' ? g.teacher : g.employee;
  const rows = c.rows.map((x) => {
    const lv = x.score && x.levels ? x.levels[x.score - 1] : '';
    const nx = x.score && x.score < 5 && x.levels ? x.levels[x.score] : '';
    return `<tr><td class="c">${x.no}</td><td><b>${esc(x.name)}</b>${lv ? `<div class="lvl muted">${esc(lv)}</div>` : ''}${nx ? `<div class="next">للمستوى ${x.score + 1}: ${esc(nx)}</div>` : ''}</td>
      <td class="c">${x.weight}%</td><td class="c">${x.score || '-'}</td><td class="c">${x.score ? `${Math.round(x.weighted * 100) / 100}` : '-'}</td><td class="c">${counts[x.id] || 0}</td></tr>`;
  }).join('');
  const body = `<div class="page">${letterheadHtml(school, null)}
    <h1>التقييم الذاتي لعناصر الأداء الوظيفي</h1><div class="center muted">${esc(ROLES[roleKey(u.role)].model)} · سلّم التقدير الخماسي الرسمي</div>
    <table class="info"><tr><th>الاسم</th><td>${esc(u.full_name)}</td><th>الوظيفة</th><td>${esc(u.job_title || '')}</td></tr><tr><th>المدرسة</th><td>${esc(u.school || '')}</td><th>العام الدراسي</th><td>${esc(u.year || '')}</td></tr></table>
    <div class="kpi"><div><b>${c.rated ? `${c.value} / 5` : '-'}</b>التقدير العام</div><div><b>${c.band ? c.band.score : '-'}</b>درجة التقدير</div><div><b>${c.band ? esc(c.band.name) : '-'}</b>مستوى الأداء</div><div><b>${c.rated}/${c.total}</b>عنصر مقدّر</div></div>
    <table><thead><tr><th style="width:8mm">م</th><th>عنصر التقييم ومستوى الأداء الحالي</th><th style="width:14mm">الوزن</th><th style="width:14mm">التقدير (1-5)</th><th style="width:16mm">التقدير الموزون</th><th style="width:14mm">الشواهد</th></tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><th colspan="4">المجموع</th><th class="c">${c.rated ? Math.round(c.rows.reduce((a, x) => a + x.weighted, 0) * 100) / 100 : '-'}</th><th></th></tr></tfoot></table>
    <p class="note muted">آلية الاحتساب حسب نماذج تقييم أداء شاغلي الوظائف التعليمية: تقدير العنصر (1 إلى 5) × وزنه النسبي، ثم جمع التقديرات الموزونة للحصول على التقدير العام. مستويات التقدير العام: 5 مثالي، 4 تخطى التوقعات، 3 وافق التوقعات، 2 بحاجة إلى تطوير، 1 غير مرضٍ.${c.complete ? '' : ' التقدير محسوب على العناصر المقدّرة فقط.'} هذا تقدير ذاتي استرشادي، والتقييم المعتمد يجريه المدير المباشر.</p>
    <div class="sign"><div>${who}: ${esc(u.full_name)}<br>التوقيع: ............</div><div>${g.principal}${u.principal ? `: ${esc(u.principal)}` : ''}<br>التوقيع: ............</div></div>
    <p class="note muted center">تاريخ الطباعة: ${F.dual(Date.now())} · ${esc(F.madeBy(u))}</p></div>`;
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>التقييم الذاتي - ${esc(u.full_name)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>
<div class="toolbar"><a class="btn ghost" href="/app#/self">→ رجوع</a><button class="btn" onclick="print()">🖨️ طباعة / حفظ PDF</button></div>${body}</body></html>`;
}
module.exports = { build };
