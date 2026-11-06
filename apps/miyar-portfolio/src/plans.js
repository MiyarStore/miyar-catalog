// باقات الاشتراك. السنوي هو الأساس، والشهري سعره أعلى عمداً حتى يكون السنوي أوفر بوضوح.
// تقدر تغيّر الأسعار من متغيرات البيئة بدون تعديل الكود.
const n = (v, d) => (Number(v) > 0 ? Number(v) : d);
const PLANS = [
  { id: 'month', name: 'شهري', days: 30, price: n(process.env.PRICE_MONTH, 19), per: 'شهر', note: 'مناسب لو تبغى تجرّب' },
  { id: 'term', name: 'فصل دراسي', days: 120, price: n(process.env.PRICE_TERM, 39), per: 'فصل', note: 'يغطي فصل دراسي كامل' },
  { id: 'year', name: 'سنوي', days: 365, price: n(process.env.PRICE_YEAR, 59), per: 'سنة', note: 'الأوفر: أقل من 5 ريال في الشهر', best: true },
];
for (const p of PLANS) p.monthly = Math.round((p.price / p.days) * 30 * 10) / 10;
const year = PLANS.find((p) => p.id === 'year');
const month = PLANS.find((p) => p.id === 'month');
year.saving = Math.max(0, Math.round((1 - year.price / (month.price * 12)) * 100));
module.exports = { PLANS };
