// مسارات لوحة المدرسة الذكية
const crypto = require('crypto');
const { db } = require('../db');
const B = require('./board');
const { parseDay } = require('./track');
const { recordHtml, tvHtml, boardReportHtml, REPORTS } = require('./board-export');

function mountBoard(app, { auth, currentUser, schoolOf, license, opsOf, uploadsDir }) {
  const clip = (v, n) => String(v ?? '').slice(0, n);
  const can = (s) => license(s).grants.includes('dashboard');
  const deny = (res) => res.status(402).json({ error: 'لوحة المدرسة متاحة بعد تفعيل باقتها', code: 'license' });
  const dayOf = (d) => (parseDay(d) != null ? d : B.today());
  const int = (v, max = 999) => { const n = parseInt(String(v ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)), 10); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };
  const opsSafe = (s) => { try { return opsOf(s); } catch { return null; } };
  const view = (s, day) => ({ ind: B.indicators(s.id, opsSafe(s), dayOf(day)), staff: B.staff(s.id), classes: B.classes(s.id), team_token: s.team_token || null, tv_token: s.tv_token || null });
  const guard = (req, res) => { const s = schoolOf(req.user.id); if (!can(s)) { deny(res); return null; } return s; };

  app.get('/api/school/board', auth, (req, res) => {
    const s = schoolOf(req.user.id);
    res.json({ ...view(s, req.query.day), licensed: can(s) });
  });
  // إضافة فصول أو منسوبين بالجملة: كل سطر «الاسم، العدد» أو «الاسم، الدور»
  app.post('/api/school/board/:what(classes|staff)', auth, (req, res) => {
    const s = guard(req, res); if (!s) return;
    const lines = String((req.body || {}).text || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 120);
    if (!lines.length) return res.status(400).json({ error: 'اكتب سطر واحد على الأقل' });
    const now = Date.now();
    for (const l of lines) {
      const [a, b] = l.split(/[,،\t|]/).map((x) => x.trim());
      if (!a) continue;
      if (req.params.what === 'classes') db.prepare('INSERT INTO school_classes (school_id, name, students, created_at) VALUES (?, ?, ?, ?)').run(s.id, clip(a, 40), int(b, 80), now);
      else db.prepare('INSERT INTO school_staff (school_id, name, role, created_at) VALUES (?, ?, ?, ?)').run(s.id, clip(a, 80), clip(b, 60), now);
    }
    res.json(view(s));
  });
  app.put('/api/school/board/:what(classes|staff)/:id', auth, (req, res) => {
    const s = guard(req, res); if (!s) return;
    const b = req.body || {};
    if (req.params.what === 'classes') db.prepare('UPDATE school_classes SET name = ?, students = ? WHERE id = ? AND school_id = ?').run(clip(b.name, 40).trim() || '-', int(b.students, 80), Number(req.params.id), s.id);
    else db.prepare('UPDATE school_staff SET name = ?, role = ? WHERE id = ? AND school_id = ?').run(clip(b.name, 80).trim() || '-', clip(b.role, 60), Number(req.params.id), s.id);
    res.json(view(s));
  });
  app.delete('/api/school/board/:what(classes|staff)/:id', auth, (req, res) => {
    const s = guard(req, res); if (!s) return;
    const id = Number(req.params.id);
    if (req.params.what === 'classes') { db.prepare('DELETE FROM school_classes WHERE id = ? AND school_id = ?').run(id, s.id); db.prepare('DELETE FROM school_att WHERE class_id = ? AND school_id = ?').run(id, s.id); }
    else db.prepare('DELETE FROM school_staff WHERE id = ? AND school_id = ?').run(id, s.id);
    res.json(view(s));
  });
  const saveAtt = (sid, b, by) => {
    const day = dayOf(b.day);
    const c = db.prepare('SELECT * FROM school_classes WHERE id = ? AND school_id = ?').get(Number(b.class_id), sid);
    if (!c) return 'الفصل غير موجود';
    const absent = int(b.absent, 80);
    if (c.students && absent > c.students) return `عدد الغياب أكبر من عدد طلاب ${c.name}`;
    db.prepare('INSERT INTO school_att (school_id, day, class_id, absent, late, names, by, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(school_id, day, class_id) DO UPDATE SET absent = excluded.absent, late = excluded.late, names = excluded.names, by = excluded.by, at = excluded.at')
      .run(sid, day, c.id, absent, int(b.late, 80), clip(b.names, 600).trim(), clip(by, 80).trim(), Date.now());
    return null;
  };
  app.put('/api/school/board/att', auth, (req, res) => {
    const s = guard(req, res); if (!s) return;
    const err = saveAtt(s.id, req.body || {}, req.user.full_name || 'قائد المدرسة');
    if (err) return res.status(400).json({ error: err });
    res.json(view(s, (req.body || {}).day));
  });
  // غياب المنسوبين وحصص الانتظار
  app.put('/api/school/board/staff-abs', auth, (req, res) => {
    const s = guard(req, res); if (!s) return;
    const b = req.body || {}; const day = dayOf(b.day);
    const p = db.prepare('SELECT id FROM school_staff WHERE id = ? AND school_id = ?').get(Number(b.staff_id), s.id);
    if (!p) return res.status(400).json({ error: 'اختر المعلم' });
    if (b.remove) { db.prepare('DELETE FROM school_staff_abs WHERE school_id = ? AND day = ? AND staff_id = ?').run(s.id, day, p.id); db.prepare('DELETE FROM school_subs WHERE school_id = ? AND day = ? AND absent_id = ?').run(s.id, day, p.id); }
    else {
      const periods = B.periodsOf(b.periods).join(',');
      db.prepare('INSERT INTO school_staff_abs (school_id, day, staff_id, kind, periods, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(school_id, day, staff_id) DO UPDATE SET kind = excluded.kind, periods = excluded.periods, at = excluded.at').run(s.id, day, p.id, clip(b.kind || 'غياب', 20), periods, Date.now());
      // نجهز صف انتظار لكل حصة، ونعبّي البديل المقترح تلقائياً
      const keep = B.periodsOf(periods);
      db.prepare(`DELETE FROM school_subs WHERE school_id = ? AND day = ? AND absent_id = ?${keep.length ? ` AND period NOT IN (${keep.join(',')})` : ''}`).run(s.id, day, p.id);
      for (const per of keep) {
        if (db.prepare('SELECT 1 FROM school_subs WHERE school_id = ? AND day = ? AND period = ? AND absent_id = ?').get(s.id, day, per, p.id)) continue;
        const sug = B.suggest(s.id, day, per)[0];
        db.prepare('INSERT INTO school_subs (school_id, day, period, absent_id, sub_id, at) VALUES (?, ?, ?, ?, ?, ?)').run(s.id, day, per, p.id, sug ? sug.id : null, Date.now());
      }
    }
    res.json(view(s, day));
  });
  app.put('/api/school/board/subs', auth, (req, res) => {
    const s = guard(req, res); if (!s) return;
    const b = req.body || {}; const day = dayOf(b.day);
    const sub = b.sub_id ? db.prepare('SELECT id FROM school_staff WHERE id = ? AND school_id = ?').get(Number(b.sub_id), s.id) : null;
    db.prepare('UPDATE school_subs SET sub_id = ?, class_name = ?, at = ? WHERE school_id = ? AND day = ? AND period = ? AND absent_id = ?').run(sub ? sub.id : null, clip(b.class_name, 40), Date.now(), s.id, day, int(b.period, 8), Number(b.absent_id));
    res.json(view(s, day));
  });
  app.get('/api/school/board/suggest', auth, (req, res) => {
    const s = guard(req, res); if (!s) return;
    res.json({ list: B.suggest(s.id, dayOf(req.query.day), int(req.query.period, 8)) });
  });
  app.post('/api/school/tv-link', auth, (req, res) => {
    const s = guard(req, res); if (!s) return;
    const token = crypto.randomBytes(12).toString('base64url');
    db.prepare('UPDATE schools SET tv_token = ? WHERE id = ?').run(token, s.id);
    res.json({ token });
  });

  // رصد الحضور من جوال المعلم: نفس رابط الفريق
  const byTeam = (t) => (/^[\w-]{12,40}$/.test(String(t || '')) ? db.prepare('SELECT * FROM schools WHERE team_token = ?').get(String(t)) : null);
  const byTv = (t) => (/^[\w-]{12,40}$/.test(String(t || '')) ? db.prepare('SELECT * FROM schools WHERE tv_token = ?').get(String(t)) : null);
  const bad = (res) => res.status(404).type('html').send('<meta charset="utf-8"><p style="font-family:sans-serif;text-align:center;margin-top:60px">الرابط غير صالح أو تم تغييره. اطلب الرابط الجديد من قائد المدرسة.</p>');
  app.get('/r/:token', (req, res) => { const s = byTeam(req.params.token); if (!s || !can(s)) return bad(res); res.type('html').send(recordHtml({ school: s, token: req.params.token })); });
  app.get('/api/r/:token', (req, res) => {
    const s = byTeam(req.params.token); if (!s || !can(s)) return res.status(404).json({ error: 'الرابط غير صالح' });
    const day = dayOf(req.query.day);
    const rows = B.attOf(s.id, day);
    res.json({ school: s.name || '', day, classes: B.classes(s.id).map((c) => { const r = rows.find((x) => x.class_id === c.id); return { ...c, rec: !!r, absent: r ? r.absent : '', late: r ? r.late : '', names: r ? r.names : '', by: r ? r.by : '' }; }) });
  });
  app.put('/api/r/:token', (req, res) => {
    const s = byTeam(req.params.token); if (!s || !can(s)) return res.status(404).json({ error: 'الرابط غير صالح' });
    const b = req.body || {};
    if (clip(b.by, 80).trim().length < 2) return res.status(400).json({ error: 'اكتب اسمك أول' });
    const err = saveAtt(s.id, b, b.by);
    if (err) return res.status(400).json({ error: err });
    res.json({ ok: true });
  });
  // شاشة العرض لتلفاز المدرسة
  app.get('/tv/:token', (req, res) => { const s = byTv(req.params.token); if (!s || !can(s)) return bad(res); res.type('html').send(tvHtml({ school: s, token: req.params.token })); });
  app.get('/api/tv/:token', (req, res) => {
    const s = byTv(req.params.token); if (!s || !can(s)) return res.status(404).json({ error: 'الرابط غير صالح' });
    const ind = B.indicators(s.id, opsSafe(s));
    res.json({ school: s.name || '', ind: { day: ind.day, list: ind.list, missing: ind.missing.map((c) => c.name), subs: ind.subs.map((x) => ({ period: x.period, absent_name: x.absent_name, sub_name: x.sub_name, class_name: x.class_name })) } });
  });
  // التقارير الست
  app.get('/school/print/board', (req, res) => {
    const u = currentUser(req); if (!u) return res.redirect('/school');
    const s = schoolOf(u.id);
    if (!can(s)) return res.redirect('/school#/license');
    const r = REPORTS[req.query.r] ? req.query.r : 'daily';
    const end = parseDay(req.query.day) != null ? Date.parse(`${req.query.day}T00:00:00Z`) : undefined;
    const n = r === 'daily' ? 1 : r === 'weekly' || r === 'missing' ? 5 : 22;
    const days = B.lastSchoolDays(n, end);
    res.send(boardReportHtml({ school: s, kind: r, data: B.rangeData(s.id, days), ind: B.indicators(s.id, opsSafe(s), days[days.length - 1]), uploadsDir }));
  });
}

module.exports = { mountBoard };
