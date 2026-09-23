/* =========================================================
   Smart Leader Thailand — Checkout (Vanilla JS)
   ========================================================= */

/* ---------- 1. ตั้งค่าการชำระเงิน ----------
   TODO: ใส่ข้อมูลจริงก่อนเปิดใช้งาน — ถ้าเว้นว่างไว้ หน้าเว็บจะแสดงเป็น "รอตั้งค่า" และไม่สร้าง QR */
const PAYMENT_CONFIG = {
  // PromptPay: เบอร์มือถือ 10 หลัก หรือเลขประจำตัวผู้เสียภาษี/บัตรประชาชน 13 หลัก
  promptPayId: '',
  promptPayName: '',

  bank: {
    name: '',        // เช่น ธนาคารกสิกรไทย
    accountName: '',
    accountNo: '',
  },

  // URL สำหรับรับคำสั่งซื้อ (POST multipart/form-data) เช่น API ของเว็บไซต์, Google Apps Script
  // ถ้าเว้นว่าง: ผู้ซื้อจะได้รับคำแนะนำให้ส่งสลิปทาง LINE / อีเมลเอง
  orderEndpoint: '',

  contact: {
    line: '',
    email: '',
  },
};

/* ---------- 2. ข้อมูลคอร์ส ----------
   ต้องตรงกับ data-course-id ใน index.html
   หมายเหตุ: ระยะเวลา จำนวนบทเรียน และราคา เป็นข้อมูลตัวอย่าง — TODO: แก้ไขเป็นข้อมูลจริง */
const COURSES = {
  'modern-leadership-ai': { title: 'ผู้นำยุคใหม่ในโลก AI', badge: 'Leadership', duration: '4 ชั่วโมง', lessons: 12, level: 'Intermediate', price: 499, thumb: 'thumb-1', img: 'images/course-leadership-ai.svg' },
  'ai-for-managers':      { title: 'AI สำหรับหัวหน้างานและผู้จัดการ', badge: 'AI for Work', duration: '3 ชั่วโมง', lessons: 10, level: 'Beginner', price: 499, thumb: 'thumb-2', img: 'images/course-ai-managers.svg' },
  'genai-productivity':   { title: 'Generative AI เพื่อเพิ่ม Productivity', badge: 'AI for Work', duration: '5 ชั่วโมง', lessons: 15, level: 'Beginner', price: 499, thumb: 'thumb-3', img: 'images/course-genai-productivity.svg' },
  'supervisor-skills':    { title: 'ทักษะหัวหน้างานยุคใหม่', badge: 'Supervisor Skills', duration: '4 ชั่วโมง', lessons: 12, level: 'Beginner', price: 499, thumb: 'thumb-4', img: 'images/course-supervisor.svg' },
  'coaching-skills':      { title: 'Coaching Skills for Leader', badge: 'Coaching', duration: '3 ชั่วโมง', lessons: 9, level: 'Intermediate', price: 499, thumb: 'thumb-5', img: 'images/course-coaching.svg' },
  'future-skills':        { title: 'Future Skills for Modern Workplace', badge: 'Future Skills', duration: '2 ชั่วโมง', lessons: 8, level: 'Beginner', price: 499, thumb: 'thumb-6', img: 'images/course-future-skills.svg' },
};

const MAX_SLIP_BYTES = 5 * 1024 * 1024;
const PENDING_TEXT = 'รอตั้งค่า';

/* ---------- 3. PromptPay payload (มาตรฐาน EMVCo / Thai QR) ---------- */
const tlv = (id, value) => id + String(value.length).padStart(2, '0') + value;

// CRC16-CCITT (poly 0x1021, init 0xFFFF)
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function promptPayPayload(id, amount) {
  const digits = id.replace(/\D/g, '');
  let target;
  if (digits.length === 10) {
    // เบอร์มือถือ: 0812345678 -> 0066812345678
    target = tlv('01', ('0000000000000' + '66' + digits.slice(1)).slice(-13));
  } else if (digits.length === 13) {
    target = tlv('02', digits);
  } else {
    return null;
  }

  const payload =
    tlv('00', '01') +
    tlv('01', '12') + // ใช้ครั้งเดียว (มียอดเงินกำหนด)
    tlv('29', tlv('00', 'A000000677010111') + target) +
    tlv('53', '764') +
    tlv('54', amount.toFixed(2)) +
    tlv('58', 'TH') +
    '6304';

  return payload + crc16(payload);
}

/* ---------- 4. Helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const baht = (n) => '฿' + n.toLocaleString('th-TH', { minimumFractionDigits: 0 });
const orEmpty = (v) => v || PENDING_TEXT;

function makeOrderNo() {
  const d = new Date();
  const ymd = [d.getFullYear() % 100, d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, '0')).join('');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SLT-${ymd}-${rand}`;
}

async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const original = btn.innerHTML;
    btn.textContent = 'คัดลอกแล้ว ✓';
    setTimeout(() => (btn.innerHTML = original), 1600);
  } catch {
    window.prompt('คัดลอกข้อความนี้', text);
  }
}

/* ---------- 5. Main ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const form = $('#checkoutForm');
  const courseSelect = $('#courseSelect');
  const panels = $$('.step-panel');
  const stepItems = $$('#stepper li');
  let currentStep = 1;
  let course;

  /* ----- 5.1 เลือกคอร์ส / สรุปคำสั่งซื้อ ----- */
  Object.entries(COURSES).forEach(([id, c]) => {
    courseSelect.add(new Option(c.title, id));
  });

  const requested = new URLSearchParams(location.search).get('course');
  courseSelect.value = COURSES[requested] ? requested : Object.keys(COURSES)[0];

  function renderCourse() {
    course = COURSES[courseSelect.value];
    $('#summaryThumb').className = `summary-thumb ${course.thumb}`;
    $('#summaryThumb').innerHTML = `<img src="${course.img}" alt="">`;
    $('#summaryBadge').textContent = course.badge;
    $('#summaryTitleText').textContent = course.title;
    $('#summaryMeta').innerHTML = `
      <li><svg class="icon"><use href="#i-clock"/></svg> ${course.duration}</li>
      <li><svg class="icon"><use href="#i-book"/></svg> ${course.lessons} บทเรียน</li>
      <li><svg class="icon"><use href="#i-level"/></svg> ${course.level}</li>`;
    $('#linePrice').textContent = baht(course.price);
    $$('[data-total]').forEach((el) => (el.textContent = baht(course.price)));
    $('#paidAmount').value = course.price.toFixed(2);

    const url = new URL(location.href);
    url.searchParams.set('course', courseSelect.value);
    history.replaceState(null, '', url);

    renderQr();
  }

  courseSelect.addEventListener('change', renderCourse);

  /* ----- 5.2 PromptPay QR / ข้อมูลบัญชี ----- */
  function renderQr() {
    const frame = $('#qrFrame');
    const payload = PAYMENT_CONFIG.promptPayId && promptPayPayload(PAYMENT_CONFIG.promptPayId, course.price);

    if (!payload) {
      frame.innerHTML = '<span class="qr-placeholder">QR Code จะแสดงที่นี่<br><small>รอตั้งค่า PromptPay ID</small></span>';
      return;
    }
    if (typeof window.qrcode !== 'function') {
      frame.innerHTML = '<span class="qr-placeholder">โหลด QR Code ไม่สำเร็จ<br><small>กรุณาตรวจสอบอินเทอร์เน็ต หรือเลือกโอนผ่านบัญชีธนาคาร</small></span>';
      return;
    }
    const qr = window.qrcode(0, 'M');
    qr.addData(payload);
    qr.make();
    frame.innerHTML = qr.createSvgTag(6, 12);
    frame.querySelector('svg')?.setAttribute('aria-label', `PromptPay QR ยอด ${baht(course.price)}`);
  }

  $('#ppAccountName').textContent = orEmpty(PAYMENT_CONFIG.promptPayName);
  $('#bankName').textContent = orEmpty(PAYMENT_CONFIG.bank.name);
  $('#bankAccountName').textContent = orEmpty(PAYMENT_CONFIG.bank.accountName);
  $('#bankAccountNo').textContent = orEmpty(PAYMENT_CONFIG.bank.accountNo);
  $('#copyAccount').hidden = !PAYMENT_CONFIG.bank.accountNo;
  $('#copyAccount').addEventListener('click', (e) =>
    copyText(PAYMENT_CONFIG.bank.accountNo.replace(/\D/g, ''), e.currentTarget)
  );

  form.addEventListener('change', (e) => {
    if (e.target.name !== 'payMethod') return;
    $$('[data-pay-panel]').forEach((p) => (p.hidden = p.dataset.payPanel !== e.target.value));
  });

  /* ----- 5.3 ใบกำกับภาษี ----- */
  $('#needInvoice').addEventListener('change', (e) => {
    $('#invoiceFields').hidden = !e.target.checked;
    if (!e.target.checked) ['taxName', 'taxId', 'taxAddress'].forEach((n) => setError(n, ''));
  });

  /* ----- 5.4 แนบสลิป ----- */
  const slipInput = $('#slip');
  const dropzone = $('#dropzone');

  function showSlip(file) {
    const img = $('#slipImg');
    $('#dzEmpty').hidden = !!file;
    $('#dzPreview').hidden = !file;
    if (!file) return;
    $('#slipName').textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    if (file.type.startsWith('image/')) {
      img.src = URL.createObjectURL(file);
      img.hidden = false;
    } else {
      img.hidden = true;
    }
  }

  slipInput.addEventListener('change', () => {
    showSlip(slipInput.files[0]);
    setError('slip', '');
  });

  ['dragenter', 'dragover'].forEach((t) => dropzone.addEventListener(t, (e) => {
    e.preventDefault();
    dropzone.classList.add('is-drag');
  }));
  ['dragleave', 'drop'].forEach((t) => dropzone.addEventListener(t, () => dropzone.classList.remove('is-drag')));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    if (!e.dataTransfer.files.length) return;
    slipInput.files = e.dataTransfer.files;
    slipInput.dispatchEvent(new Event('change'));
  });

  /* ----- 5.5 Validation ----- */
  function setError(name, message) {
    const el = $(`[data-error-for="${name}"]`);
    const input = form.elements[name];
    if (el) el.textContent = message;
    if (input && input.setAttribute) input.setAttribute('aria-invalid', message ? 'true' : 'false');
  }

  const rules = {
    1: () => {
      const v = (n) => form.elements[n].value.trim();
      const errors = {
        fullName: v('fullName') ? '' : 'กรุณากรอกชื่อ-นามสกุล',
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email')) ? '' : 'กรุณากรอกอีเมลให้ถูกต้อง',
        phone: /^0\d{8,9}$/.test(v('phone').replace(/[\s-]/g, '')) ? '' : 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง เช่น 0812345678',
      };
      if ($('#needInvoice').checked) {
        errors.taxName = v('taxName') ? '' : 'กรุณากรอกชื่อสำหรับออกใบกำกับภาษี';
        errors.taxId = /^\d{13}$/.test(v('taxId').replace(/[\s-]/g, '')) ? '' : 'เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก';
        errors.taxAddress = v('taxAddress') ? '' : 'กรุณากรอกที่อยู่';
      }
      return errors;
    },
    2: () => ({}),
    3: () => {
      const file = slipInput.files[0];
      let slip = '';
      if (!file) slip = 'กรุณาแนบสลิปการโอนเงิน';
      else if (file.size > MAX_SLIP_BYTES) slip = 'ไฟล์มีขนาดเกิน 5 MB';
      else if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type)) slip = 'รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ PDF';
      return {
        paidAt: form.elements.paidAt.value ? '' : 'กรุณาระบุวันและเวลาที่โอน',
        slip,
        consent: $('#consent').checked ? '' : 'กรุณายอมรับเงื่อนไขก่อนยืนยัน',
      };
    },
  };

  function validate(step) {
    const errors = rules[step] ? rules[step]() : {};
    let firstInvalid = null;
    Object.entries(errors).forEach(([name, msg]) => {
      setError(name, msg);
      if (msg && !firstInvalid) firstInvalid = form.elements[name];
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  // ล้างข้อความ error เมื่อผู้ใช้แก้ไขช่องนั้น
  form.addEventListener('input', (e) => e.target.name && setError(e.target.name, ''));

  /* ----- 5.6 เปลี่ยนขั้นตอน ----- */
  function goTo(step) {
    currentStep = step;
    panels.forEach((p) => (p.hidden = Number(p.dataset.step) !== step));
    stepItems.forEach((li) => {
      const n = Number(li.dataset.step);
      li.classList.toggle('is-current', n === step);
      li.classList.toggle('is-done', n < step);
      if (n === step) li.setAttribute('aria-current', 'step');
      else li.removeAttribute('aria-current');
    });
    // ห้ามเปลี่ยนคอร์สหลังส่งคำสั่งซื้อแล้ว
    courseSelect.disabled = step === 4;
    $('.checkout-head').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $(`#step${step}Title`).focus({ preventScroll: true });
  }

  $$('[data-next]').forEach((btn) => btn.addEventListener('click', () => {
    if (validate(currentStep)) goTo(currentStep + 1);
  }));
  $$('[data-prev]').forEach((btn) => btn.addEventListener('click', () => goTo(currentStep - 1)));

  /* ----- 5.7 ส่งคำสั่งซื้อ ----- */
  function orderSummaryText(orderNo) {
    const f = form.elements;
    const method = f.payMethod.value === 'promptpay' ? 'PromptPay' : 'โอนผ่านบัญชีธนาคาร';
    const lines = [
      `เลขที่คำสั่งซื้อ: ${orderNo}`,
      `คอร์ส: ${course.title}`,
      `ยอดชำระ: ${baht(course.price)}`,
      `วิธีชำระ: ${method}`,
      `วันเวลาที่โอน: ${f.paidAt.value.replace('T', ' ')}`,
      `ชื่อ: ${f.fullName.value.trim()}`,
      `อีเมล: ${f.email.value.trim()}`,
      `โทร: ${f.phone.value.trim()}`,
    ];
    if (f.company.value.trim()) lines.push(`องค์กร: ${f.company.value.trim()}`);
    if ($('#needInvoice').checked) {
      lines.push(`ใบกำกับภาษี: ${f.taxName.value.trim()} / ${f.taxId.value.trim()}`, `ที่อยู่: ${f.taxAddress.value.trim()}`);
    }
    if (f.note.value.trim()) lines.push(`หมายเหตุ: ${f.note.value.trim()}`);
    return lines.join('\n');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate(3)) return;

    const submitBtn = $('#submitBtn');
    const errorBox = $('#submitError');
    const orderNo = makeOrderNo();
    errorBox.hidden = true;

    let sent = false;
    if (PAYMENT_CONFIG.orderEndpoint) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'กำลังส่งข้อมูล...';
      try {
        const data = new FormData(form);
        data.append('orderNo', orderNo);
        data.append('courseTitle', course.title);
        data.append('amount', course.price.toFixed(2));
        const res = await fetch(PAYMENT_CONFIG.orderEndpoint, { method: 'POST', body: data });
        if (!res.ok) throw new Error(res.status);
        sent = true;
      } catch {
        errorBox.textContent = 'ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง หรือติดต่อทีมงาน';
        errorBox.hidden = false;
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'ยืนยันการชำระเงิน <svg class="icon"><use href="#i-check"/></svg>';
        return;
      }
    }

    $('#orderNo').textContent = orderNo;
    if (sent) {
      $('#step4Title').textContent = 'ได้รับข้อมูลการชำระเงินแล้ว';
      $('#doneLead').textContent = `ทีมงานจะตรวจสอบการชำระเงิน และส่งลิงก์เข้าเรียนไปที่ ${form.elements.email.value.trim()}`;
    } else {
      // ยังไม่มีระบบรับคำสั่งซื้อ: ให้ผู้ซื้อส่งหลักฐานเอง — ไม่แจ้งว่าส่งสำเร็จ
      $('#step4Title').textContent = 'อีกขั้นตอนเดียว: ส่งหลักฐานการชำระเงิน';
      $('#doneLead').textContent = 'คำสั่งซื้อของคุณจะได้รับการยืนยันหลังทีมงานได้รับสลิปและตรวจสอบเรียบร้อย';
      $('#contactLine').textContent = orEmpty(PAYMENT_CONFIG.contact.line);
      $('#contactEmail').textContent = orEmpty(PAYMENT_CONFIG.contact.email);
      $('#orderText').textContent = orderSummaryText(orderNo);
      $('#manualSend').hidden = false;
    }
    goTo(4);
  });

  $('#copyOrder').addEventListener('click', (e) => copyText($('#orderText').textContent, e.currentTarget));

  /* ----- เริ่มต้น ----- */
  renderCourse();
  $('#year').textContent = new Date().getFullYear();
});
