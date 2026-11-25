// باقات الاشتراك: فصل دراسي وسنوي، بنفس أسعار متجر سلة. السنوي هو الأوفر.
// تقدر تغيّر الأسعار من متغيرات البيئة بدون تعديل الكود.
const n = (v, d) => (Number(v) > 0 ? Number(v) : d);
const PLANS = [
  { id: 'term', name: 'فصل دراسي', days: 120, price: n(process.env.PRICE_TERM, 69), per: 'فصل', note: 'يغطي فصل دراسي كامل', buy: 'اشتراك-تطبيق-معياري-للمعلم-فصل-دراسي-ملف-الإنجاز-والشواهد/p1037858310' },
  { id: 'year', name: 'سنوي', days: 365, price: n(process.env.PRICE_YEAR, 99), per: 'سنة', note: 'الأوفر: سنة كاملة بأقل من 9 ريال في الشهر', best: true, buy: 'اشتراك-تطبيق-معياري-للمعلم-سنوي-ملف-الإنجاز-والشواهد/p1502065664' },
];
for (const p of PLANS) p.monthly = Math.round((p.price / p.days) * 30 * 10) / 10;
const year = PLANS.find((p) => p.id === 'year');
const term = PLANS.find((p) => p.id === 'term');
// التوفير مقارنة بشراء ثلاث فصول دراسية منفصلة خلال السنة.
year.saving = Math.max(0, Math.round((1 - year.price / (term.price * 3)) * 100));
module.exports = { PLANS };

// باقات «معياري للمدرسة» للمدارس: ترخيص سنوي مربوط بالرقم الوزاري.
// grants: أنواع الخطط التي تفتحها الباقة.
const SCHOOL_PACKAGES = [
  { id: 'school_improve', buy: 'معياري-للمدرسة-خطة-التحسين-سنة/p618894432', name: 'خطة التحسين', price: n(process.env.PRICE_SCHOOL_IMPROVE, 99), days: 365, grants: ['improvement'] },
  { id: 'school_nafis', buy: 'معياري-للمدرسة-خطة-نافس-العلاجية-سنة/p1992864609', name: 'خطة نافس العلاجية', price: n(process.env.PRICE_SCHOOL_NAFIS, 99), days: 365, grants: ['nafis'] },
  { id: 'school_evidence', buy: 'معياري-للمدرسة-ملف-شواهد-التقويم-سنة/p1083560546', name: 'ملف شواهد التقويم', price: n(process.env.PRICE_SCHOOL_EVIDENCE, 99), days: 365, grants: ['evidence'] },
  { id: 'school_dashboard', buy: 'معياري-للمدرسة-لوحة-المدرسة-الذكية-سنة/p1818169452', name: 'لوحة المدرسة الذكية', price: n(process.env.PRICE_SCHOOL_DASHBOARD, 99), days: 365, grants: ['dashboard'] },
  { id: 'school_bundle', buy: 'معياري-للمدرسة-الباقة-الشاملة-سنة/p134307438', name: 'باقة المدرسة الشاملة', price: n(process.env.PRICE_SCHOOL_BUNDLE, 249), days: 365, grants: ['improvement', 'nafis', 'evidence', 'operational', 'dashboard'], best: true },
  { id: 'school_done', buy: 'معياري-للمدرسة-نعبّيها-لك-سنة/p26327913', name: 'نعبّيها لك', price: n(process.env.PRICE_SCHOOL_DONE, 399), days: 365, grants: ['improvement', 'nafis', 'evidence', 'operational', 'dashboard'], service: true },
];
module.exports.SCHOOL_PACKAGES = SCHOOL_PACKAGES;

// رابط صفحة المنتج في سلة: كل زر اشتراك يودّي للباقة نفسها مباشرة بدل الصفحة الرئيسية للمتجر.
module.exports.buyUrl = (store, p) => (p && p.buy ? `${String(store).replace(/\/+$/, '')}/${encodeURI(p.buy)}` : store);
