// تنسيقات مشتركة للنماذج المطبوعة: التاريخ الهجري (أم القرى) مع الميلادي، وصيغة المعلم والمعلمة، وتذييل النماذج.
const toDate = (d) => {
  if (!d) return null;
  const dt = d instanceof Date ? d : typeof d === 'number' ? new Date(d) : new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? `${d}T12:00:00Z` : d);
  return isNaN(dt) ? null : dt;
};
const fmt = (cal, opts) => (d) => { const dt = toDate(d); if (!dt) return ''; try { return new Intl.DateTimeFormat(`ar-SA-u-ca-${cal}`, { timeZone: 'UTC', ...opts }).format(dt); } catch { return ''; } };
const hijri = fmt('islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' });
const hijriShort = fmt('islamic-umalqura', { day: 'numeric', month: 'short' });
const greg = fmt('gregory', { day: 'numeric', month: 'numeric', year: 'numeric' });
// «١٥ جمادى الأولى ١٤٤٨ هـ الموافق ٦/١١/٢٠٢٦م»
const dual = (d) => { const h = hijri(d); if (!h) return d ? String(d) : ''; const g = greg(d); return g ? `${h} الموافق ${g}م` : h; };

// صيغة النص حسب جنس صاحب الملف
const G = (u) => {
  const f = u && u.gender === 'f';
  return {
    f,
    teacher: f ? 'المعلمة' : 'المعلم',
    employee: f ? 'الموظفة' : 'الموظف',
    supervisor: f ? 'المشرفة التربوية' : 'المشرف التربوي',
    deputy: f ? 'الوكيلة' : 'الوكيل',
    principal: f ? 'مديرة المدرسة' : 'مدير المدرسة',
    student: f ? 'الطالبة' : 'الطالب',
    students: f ? 'الطالبات' : 'الطلاب',
    prepared: f ? 'أعدّته' : 'أعدّه',
  };
};

// تذييل يوضح أن النموذج من إعداد صاحب الملف وليس نموذجاً رسمياً صادراً عن الوزارة
const madeBy = (u) => `نموذج ${G(u).prepared} ${u && u.full_name ? `صاحب${G(u).f ? 'ة' : ''} الملف` : 'صاحب الملف'} لتوثيق العمل، وليس نموذجاً رسمياً صادراً عن وزارة التعليم.`;

module.exports = { toDate, hijri, hijriShort, greg, dual, G, madeBy };
