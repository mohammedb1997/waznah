/* =====================================================================
   المفضلة — ربط شرائح الاختيار السريع بكل نظام
===================================================================== */
/* المفضلة — ربط شرائح الاختيار السريع بكل نظام */

['moka', 'teapotA', 'teapotB'].forEach(sys => {
  renderFavChips(sys);
  renderSuggestChips(sys);
  const el = document.getElementById(sys + '-favs');
  if (!el) return;
  el.addEventListener('click', (e) => {
    const chip = e.target.closest('.fav-chip');
    if (!chip) return;
    const item = SYS_DATA[sys].find(it => it.name === chip.dataset.name);
    if (item) SYS_HANDLES[sys].setValue(item);
  });
});

/* =====================================================================
   دليل درجات الأوراق — يُبنى مرة واحدة من TEA_DATA.grades
===================================================================== */
function renderGradesGlossary() {
  const grid = document.getElementById('grades-grid');
  if (!grid || !TEA_DATA.grades) return;
  grid.innerHTML = TEA_DATA.grades.map(g => `
    <div class="grade-card" id="grade-${g.code}">
      <div class="grade-card-head">
        <span class="grade-code">${g.code}</span>
        <span class="status-badge ${g.verified ? 'verified' : 'estimated'}">${g.verified ? 'موثّق' : 'تقديري'}</span>
      </div>
      <h4>${escapeHTML(g.full || g.code)}</h4>
      <p class="grade-cat">${escapeHTML(g.cat || '')}</p>
      <p class="grade-desc">${escapeHTML(g.desc || '')}</p>
      <div class="grade-meta">
        <div><span>سرعة الاستخلاص</span><b>${escapeHTML(g.speed || '—')}</b></div>
        <div><span>احتمالية المرارة</span><b>${escapeHTML(g.bitter || '—')}</b></div>
        <div><span>مدة النقع</span><b>${escapeHTML(g.brew || '—')}</b></div>
      </div>
      ${g.examples ? `<p class="grade-examples">${escapeHTML(g.examples)}</p>` : ''}
    </div>
  `).join('');
}
renderGradesGlossary();

function highlightGrade(code) {
  const card = document.getElementById('grade-' + code);
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card.classList.add('pulse');
  setTimeout(() => card.classList.remove('pulse'), 1600);
}

/* =====================================================================
   قائمة الجوال (الروابط العلوية) — كانت تختفي بدون بديل على الشاشات الصغيرة
===================================================================== */
const mobileToggle = document.getElementById('mobileNavToggle');
const mobileNav = document.getElementById('mobileNav');
if (mobileToggle && mobileNav) {
  mobileToggle.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    mobileToggle.setAttribute('aria-expanded', String(open));
  });
  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    mobileNav.classList.remove('open');
    mobileToggle.setAttribute('aria-expanded', 'false');
  }));
}
