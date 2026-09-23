/* =========================================================
   Smart Leader Thailand — Interactions (Vanilla JS)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('siteHeader');
  const navToggle = document.getElementById('navToggle');
  const nav = document.getElementById('primaryNav');

  /* ---------- Sticky header: เพิ่มเงาเมื่อเลื่อนหน้า ---------- */
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile navigation ---------- */
  const setNav = (open) => {
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'ปิดเมนู' : 'เปิดเมนู');
    document.body.classList.toggle('nav-open', open);
  };

  navToggle.addEventListener('click', () => setNav(!nav.classList.contains('is-open')));
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setNav(false)));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setNav(false);
      navToggle.focus();
    }
  });

  // ปิดเมนูอัตโนมัติเมื่อขยายหน้าจอกลับเป็น Desktop
  window.matchMedia('(min-width: 1181px)').addEventListener('change', (e) => {
    if (e.matches) setNav(false);
  });

  /* ---------- Active nav link ตาม Section ที่กำลังดู ---------- */
  const navLinks = [...document.querySelectorAll('.nav-link:not([data-filter-link])')];
  const sections = navLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) =>
        link.classList.toggle('is-active', link.getAttribute('href') === `#${entry.target.id}`)
      );
    });
  }, { rootMargin: '-45% 0px -50% 0px' });

  sections.forEach((section) => sectionObserver.observe(section));

  /* ---------- Course filter ---------- */
  const tabs = document.querySelectorAll('.filter-tab');
  const courses = document.querySelectorAll('.course-card');
  const emptyState = document.getElementById('courseEmpty');

  const applyFilter = (key) => {
    let visible = 0;

    tabs.forEach((tab) => {
      const active = tab.dataset.filter === key;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    courses.forEach((card) => {
      const match = key === 'all' || card.dataset.category === key;
      card.classList.toggle('is-hidden', !match);
      if (match) {
        visible += 1;
        card.classList.add('is-visible'); // ให้การ์ดที่ถูกกรองแสดงทันที
      }
    });

    emptyState.hidden = visible > 0;
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => applyFilter(tab.dataset.filter)));

  // ลิงก์ที่มี data-filter-link (เมนู Leadership, AI & Future Skills, Category cards)
  document.querySelectorAll('[data-filter-link]').forEach((link) => {
    link.addEventListener('click', () => applyFilter(link.dataset.filterLink));
  });

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');

  revealEls.forEach((el) => {
    if (el.dataset.delay) el.style.setProperty('--reveal-delay', `${el.dataset.delay}ms`);
  });

  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('is-visible');
        // หลัง Animation จบ ให้ hover ตอบสนองทันทีโดยไม่มี delay
        setTimeout(() => el.classList.add('is-revealed'), 900 + Number(el.dataset.delay || 0));
        obs.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach((el) => revealObserver.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible', 'is-revealed'));
  }

  /* ---------- Course detail modal ---------- */
  const modal = document.getElementById('courseModal');
  const modalFields = {
    badge: document.getElementById('modalBadge'),
    title: document.getElementById('modalTitle'),
    sub: document.getElementById('modalSub'),
    desc: document.getElementById('modalDesc'),
    meta: document.getElementById('modalMeta'),
    price: document.getElementById('modalPrice'),
  };
  const modalCta = document.getElementById('modalCta');

  document.querySelectorAll('.js-course-detail').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.course-card');
      modalFields.badge.textContent = card.querySelector('.badge').textContent;
      modalFields.title.textContent = card.querySelector('.course-title').textContent;
      modalFields.sub.textContent = card.querySelector('.course-sub').textContent;
      modalFields.desc.textContent = card.querySelector('.course-desc').textContent;
      modalFields.meta.innerHTML = card.querySelector('.course-meta').innerHTML;
      modalFields.price.textContent = card.querySelector('.price').textContent;
      modalCta.href = `checkout.html?course=${encodeURIComponent(card.dataset.courseId)}`;

      if (typeof modal.showModal === 'function') {
        modal.showModal();
      } else {
        modal.setAttribute('open', ''); // fallback สำหรับเบราว์เซอร์เก่า
      }
    });
  });

  const closeModal = () => (modal.open && typeof modal.close === 'function' ? modal.close() : modal.removeAttribute('open'));

  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalAsk').addEventListener('click', closeModal);

  // คลิกพื้นหลังนอกกล่องเพื่อปิด
  modal.addEventListener('click', (e) => {
    if (e.target !== modal) return;
    const r = modal.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) closeModal();
  });

  /* ---------- Course preview video: แสดง Placeholder ถ้ายังไม่มีไฟล์วิดีโอ ---------- */
  const video = document.getElementById('previewVideo');
  const videoPlaceholder = document.getElementById('videoPlaceholder');
  const showVideoPlaceholder = () => {
    video.hidden = true;
    videoPlaceholder.hidden = false;
  };

  video.querySelectorAll('source').forEach((src) => src.addEventListener('error', showVideoPlaceholder));
  video.addEventListener('error', showVideoPlaceholder);
  // กรณี error เกิดก่อนที่ script จะผูก event
  if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) showVideoPlaceholder();

  /* ---------- Footer year ---------- */
  document.getElementById('year').textContent = new Date().getFullYear();
});
