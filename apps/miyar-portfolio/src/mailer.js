// إرسال الإيميل عن طريق Resend. المفتاح يجي من متغيرات البيئة فقط (RESEND_API_KEY).
const FROM = process.env.MAIL_FROM || 'معياري <noreply@miyariapp.com>';
const enabled = () => !!process.env.RESEND_API_KEY;

async function send({ to, subject, html, text }) {
  if (!enabled()) throw new Error('mail-disabled');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html, text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`resend ${r.status}: ${body.slice(0, 200)}`);
  }
  return r.json();
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// قالب بسيط من اليمين لليسار
function layout(title, bodyHtml) {
  return `<!doctype html><html lang="ar" dir="rtl"><body style="margin:0;background:#F6F7F8;font-family:Tahoma,Arial,sans-serif;color:#1B2226">
<div style="max-width:520px;margin:0 auto;padding:28px 16px"><div style="background:#fff;border-radius:14px;padding:28px;border:1px solid #ECEDEE;text-align:right">
<div style="font-size:22px;font-weight:700;color:#0E7C66;margin-bottom:18px">معياري</div>
<h1 style="font-size:19px;margin:0 0 12px">${esc(title)}</h1>${bodyHtml}</div>
<p style="font-size:12px;color:#8A9296;text-align:center;margin-top:14px">هذي رسالة آلية من معياري، لا ترد عليها.</p></div></body></html>`;
}

function resetCodeMail(name, code) {
  const html = layout('رمز استعادة كلمة المرور', `<p style="line-height:1.8;margin:0 0 16px">أهلاً ${esc(name)}، هذا رمز استعادة كلمة المرور لحسابك في معياري:</p>
<div style="font-size:32px;font-weight:700;letter-spacing:8px;text-align:center;background:#FBF6E6;border-radius:10px;padding:14px;direction:ltr">${esc(code)}</div>
<p style="line-height:1.8;color:#5C6569;margin:16px 0 0">الرمز صالح لمدة 15 دقيقة. إذا ما طلبت استعادة كلمة المرور، تجاهل هذي الرسالة وحسابك بأمان.</p>`);
  const text = `رمز استعادة كلمة المرور في معياري: ${code}\nصالح لمدة 15 دقيقة. إذا ما طلبته تجاهل الرسالة.`;
  return { subject: `رمز استعادة كلمة المرور: ${code}`, html, text };
}

module.exports = { send, enabled, resetCodeMail };
