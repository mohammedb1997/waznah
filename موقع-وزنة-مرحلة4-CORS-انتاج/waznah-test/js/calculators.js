const glassLiquid = document.getElementById('pourGlassLiquid');
const glassFoam = document.getElementById('pourGlassFoam');
const glassCaptionVal = document.getElementById('glassCaptionVal');

function updateGlass(strengthRatio, label) {
  // strengthRatio: 0..1 تقريبي لتمثيل نسبة "قوة" الوزنة الحالية بصرياً فقط
  const r = Math.max(0.1, Math.min(1, strengthRatio));
  const bottomY = 272;   // قاع الكأس تقريباً
  const topY = 34;       // أعلى مستوى يمكن أن يصله السائل
  const maxFill = bottomY - topY;
  const y = bottomY - r * maxFill;
  const h = bottomY - y + 6;
  glassLiquid.setAttribute('y', y);
  glassLiquid.setAttribute('height', h);
  glassFoam.setAttribute('cy', y);
  glassFoam.style.opacity = r > 0.14 ? 0.9 : 0;
  if (label) glassCaptionVal.textContent = label;
}

/* =====================================================================
   النظام 1 — إبريق صانع الشاهي (الموكا)
===================================================================== */
const mokaState = { item: null, water: 'low', sugar: 'medium', amountMl: 500, adj: 0 };

const mokaSelectHandle = createSearchSelect(document.getElementById('moka-search'), TEA_DATA.moka, {
  getLabel: (it) => it.name,
  getSub: (it) => it.grade || '',
  placeholder: 'مثال: شاي الوزة، شاي 999...',
  onSelect: (it) => { mokaState.item = it; renderMoka(); }
});
SYS_HANDLES.moka = mokaSelectHandle;
wireToggleGroup(document.getElementById('moka-water'), (v) => { mokaState.water = v; renderMoka(); });
wireToggleGroup(document.getElementById('moka-sugar'), (v) => { mokaState.sugar = v; renderMoka(); });
wireAmount(document.getElementById('moka-amount'), document.getElementById('moka-amount-input'), (v) => { mokaState.amountMl = v; renderMoka(); }, 50);
const mokaAdjEl = document.getElementById('moka-adj');
mokaAdjEl.addEventListener('input', () => {
  mokaState.adj = parseInt(mokaAdjEl.value, 10);
  document.getElementById('moka-adj-val').textContent = mokaState.adj + '%';
  renderMoka();
});

function renderMoka() {
  const { item, water, sugar, amountMl, adj } = mokaState;
  const box = document.getElementById('moka-result');
  document.getElementById('moka-cup-eq').textContent = cupEquivalent(amountMl);
  if (!item) { box.innerHTML = '<p>اختر صنفاً للبدء.</p>'; return; }

  const [tMin, tMax] = item[sugar];
  const waterCoef = water === 'low' ? -0.02 : 0.02;
  const scale = (amountMl / item.refVol) * (1 + waterCoef) * (1 + adj / 100);
  const rMin = round1(tMin * scale);
  const rAvg = round1(mid(tMin, tMax) * scale);
  const rMax = round1(tMax * scale);

  updateGlass(rAvg / 45, `${rAvg} جم`);

  let gradeHtml = '';
  if (item.grade && GRADE_BY_CODE[item.grade]) {
    const g = GRADE_BY_CODE[item.grade];
    gradeHtml = `
      <div class="grade-box">
        <h4>تصنيف الورقة</h4>
        <span class="grade-chip">${escapeHTML(item.grade)} — ${g.full}</span>
        <p>سرعة الاستخلاص: ${g.speed} · احتمالية المرارة: ${g.bitter}</p>
        <p>مدة النقع المقترحة: ${g.brew}</p>
        <a class="grade-link" href="#grades" data-jump="${escapeHTML(item.grade)}">تفاصيل أكثر عن ${escapeHTML(item.grade)} ⟵</a>
      </div>`;
  }

  const shareText = () =>
    `وزنية ${escapeHTML(item.name)} (إبريق صانع الشاهي/الموكا)\nنوع الماء: ${water === 'low' ? 'تحلية/علب' : 'صنبور'} — سكر: ${{nosugar:'بدون سكر',medium:'وسط',high:'حالي'}[sugar]} — ${amountMl} مل ماء\nالوزنة الموصى بها: ${rAvg} جم (من ${rMin} إلى ${rMax})\n— عبر موقع وزنة`;

  box.innerHTML = `
    <div class="result-title">النتيجة</div>
    <div class="result-head">${avatarHtml(item.id, item.name, 52, item.photoUrl)}<div class="result-name">${escapeHTML(item.name)}</div></div>
    <span class="status-badge ${item.status}">${item.status === 'verified' ? 'موثّق من الملف الأصلي' : 'تقديري — يحتاج معايرة فعلية'}</span>
    <div class="result-rows">
      <div class="result-row"><span class="r-label">الحد الأدنى</span><span class="r-value">${rMin}<span class="r-sub"> جم</span></span></div>
      <div class="result-row primary"><span class="r-label">الموصى به</span><span class="r-value">${rAvg}<span class="r-sub"> جم</span></span></div>
      <div class="result-row"><span class="r-label">الحد الأعلى</span><span class="r-value">${rMax}<span class="r-sub"> جم</span></span></div>
    </div>
    <div class="range-note">الوزنية الأساسية بالمصدر (لكل ${item.refVol} مل): ${tMin}–${tMax} جم لمستوى «${{nosugar:'بدون سكر', medium:'وسط', high:'حالي'}[sugar]}».</div>
    ${gradeHtml}
    ${renderMatchHint('moka', item.name)}
    ${actionsHtml('moka')}
  `;
  wireResultActions(box, 'moka', shareText);
  wireHintLinks(box);
  box.querySelector('.fav-btn') && box.querySelector('.fav-btn').replaceChildren(document.createTextNode(isFav('moka', item.name) ? '★ محفوظة' : '☆ حفظ بالمفضلة'));
  box.querySelectorAll('[data-jump]').forEach(a => a.addEventListener('click', () => setTimeout(() => highlightGrade(a.dataset.jump), 300)));
}

/* =====================================================================
   النظام 2 — الإبريق العادي (مصدر @7AMDAN_LAB)
===================================================================== */
const teapotAState = { item: null, sugar: 'yes', waterMl: 1000, adj: 0 };

const teapotASelectHandle = createSearchSelect(document.getElementById('teapotA-search'), TEA_DATA.teapotA, {
  getLabel: (it) => it.name,
  getSub: (it) => it.code || '',
  placeholder: 'ابحث بين 153 صنفاً...',
  onSelect: (it) => { teapotAState.item = it; renderTeapotA(); }
});
SYS_HANDLES.teapotA = teapotASelectHandle;
wireToggleGroup(document.getElementById('teapotA-sugar'), (v) => { teapotAState.sugar = v; renderTeapotA(); });
wireAmount(document.getElementById('teapotA-amount'), document.getElementById('teapotA-amount-input'), (v) => { teapotAState.waterMl = v; renderTeapotA(); }, 100);
const teapotAAdjEl = document.getElementById('teapotA-adj');
teapotAAdjEl.addEventListener('input', () => {
  teapotAState.adj = parseInt(teapotAAdjEl.value, 10);
  document.getElementById('teapotA-adj-val').textContent = teapotAState.adj + '%';
  renderTeapotA();
});

function renderTeapotA() {
  const { item, sugar, waterMl, adj } = teapotAState;
  const liters = waterMl / 1000;
  const box = document.getElementById('teapotA-result');
  document.getElementById('teapotA-cup-eq').textContent = cupEquivalent(waterMl);
  if (!item) { box.innerHTML = '<p>اختر صنفاً للبدء.</p>'; return; }

  const base = sugar === 'yes' ? item.teaWithSugar : item.teaNoSugar;
  const teaG = round1(base * liters * (1 + adj / 100));
  const sugarG = sugar === 'yes' ? round1(item.sugar * liters) : 0;

  updateGlass(teaG / 18, `${teaG} جم`);

  const shareText = () =>
    `وزنية ${escapeHTML(item.name)} (الإبريق العادي — مصدر @7AMDAN_LAB)\n${sugar === 'yes' ? 'مع سكر' : 'بدون سكر'} — ${waterMl} مل ماء\nالشاهي: ${teaG} جم${sugar==='yes' ? ` — السكر: ${sugarG} جم` : ''} — مدة التخدير: ${item.steep} دقيقة\n— عبر موقع وزنة`;

  box.innerHTML = `
    <div class="result-title">النتيجة</div>
    <div class="result-head">${avatarHtml(item.id, item.name, 52, item.photoUrl)}<div class="result-name">${escapeHTML(item.name)}</div></div>
    ${item.code ? `<span class="grade-chip">${escapeHTML(item.code)}</span>` : ''}
    <div class="result-rows">
      <div class="result-row primary"><span class="r-label">وزن الشاهي</span><span class="r-value">${teaG}<span class="r-sub"> جم</span></span></div>
      <div class="result-row"><span class="r-label">وزن السكر</span><span class="r-value">${sugarG}<span class="r-sub"> جم</span></span></div>
      <div class="result-row"><span class="r-label">مدة التخدير المقترحة</span><span class="r-value">${item.steep}<span class="r-sub"> دقيقة</span></span></div>
    </div>
    <div class="range-note">القيمة الأساسية بالمصدر لكل لتر: ${base} جم شاهي${sugar === 'yes' ? ` + ${item.sugar} جم سكر` : ''}.</div>
    ${renderMatchHint('teapotA', item.name)}
    ${actionsHtml('teapotA')}
  `;
  wireResultActions(box, 'teapotA', shareText);
  wireHintLinks(box);
  box.querySelector('.fav-btn') && box.querySelector('.fav-btn').replaceChildren(document.createTextNode(isFav('teapotA', item.name) ? '★ محفوظة' : '☆ حفظ بالمفضلة'));
}

/* =====================================================================
   النظام 3 — الإبريق العادي (مصدر ملك الشواهي)
===================================================================== */
const teapotBState = { item: null, strength: 'medium', waterMl: 1000, adj: 0 };

const teapotBToggle = document.getElementById('teapotB-strength');

const teapotBSelectHandle = createSearchSelect(document.getElementById('teapotB-search'), TEA_DATA.teapotB, {
  getLabel: (it) => it.name,
  placeholder: 'ابحث بين 36 صنفاً...',
  onSelect: (it) => { teapotBState.item = it; syncTeapotBToggles(); renderTeapotB(); }
});
SYS_HANDLES.teapotB = teapotBSelectHandle;

function syncTeapotBToggles() {
  const it = teapotBState.item;
  if (!it) return;
  const avail = { nosugar: true, light: !!it.light, medium: !!it.medium, heavy: !!it.heavy };
  [...teapotBToggle.children].forEach(btn => {
    const v = btn.dataset.val;
    btn.disabled = !avail[v];
    if (btn.disabled && btn.getAttribute('aria-pressed') === 'true') {
      btn.setAttribute('aria-pressed', 'false');
    }
  });
  const stillActive = getToggleVal(teapotBToggle);
  if (!stillActive) {
    const fallback = ['medium', 'heavy', 'light', 'nosugar'].find(v => avail[v]);
    const btn = [...teapotBToggle.children].find(b => b.dataset.val === fallback);
    if (btn) btn.setAttribute('aria-pressed', 'true');
    teapotBState.strength = fallback;
  }
}
wireToggleGroup(teapotBToggle, (v) => { teapotBState.strength = v; renderTeapotB(); });
wireAmount(document.getElementById('teapotB-amount'), document.getElementById('teapotB-amount-input'), (v) => { teapotBState.waterMl = v; renderTeapotB(); }, 100);
const teapotBAdjEl = document.getElementById('teapotB-adj');
teapotBAdjEl.addEventListener('input', () => {
  teapotBState.adj = parseInt(teapotBAdjEl.value, 10);
  document.getElementById('teapotB-adj-val').textContent = teapotBState.adj + '%';
  renderTeapotB();
});

function renderTeapotB() {
  const { item, strength, waterMl, adj } = teapotBState;
  const liters = waterMl / 1000;
  const box = document.getElementById('teapotB-result');
  document.getElementById('teapotB-cup-eq').textContent = cupEquivalent(waterMl);
  if (!item) { box.innerHTML = '<p>اختر صنفاً للبدء.</p>'; return; }

  let teaG = '—', sugarG = '—', rangeNote = 'لا تتوفر بيانات لهذه الدرجة لهذا الصنف في المصدر الأصلي.';
  if (strength === 'nosugar') {
    const [tMin, tMax] = item.nosugar;
    teaG = round1(mid(tMin, tMax) * liters * (1 + adj / 100));
    sugarG = 0;
    rangeNote = `مدى المصدر (بدون سكر، لكل لتر): ${tMin}–${tMax} جم شاهي.`;
  } else {
    const tier = item[strength];
    if (tier) {
      const [sMin, sMax, tMin, tMax] = tier;
      teaG = round1(mid(tMin, tMax) * liters * (1 + adj / 100));
      sugarG = round1(mid(sMin, sMax) * liters);
      rangeNote = `مدى المصدر لكل لتر — شاهي: ${tMin}–${tMax} جم، سكر: ${sMin}–${sMax} جم.`;
    }
  }

  const steepLabel = item.steep[0] === item.steep[1] ? item.steep[0] : `${item.steep[0]}–${item.steep[1]}`;

  updateGlass(typeof teaG === 'number' ? teaG / 16 : 0.1, typeof teaG === 'number' ? `${teaG} جم` : '—');

  const shareText = () =>
    `وزنية ${escapeHTML(item.name)} (الإبريق العادي — مصدر ملك الشواهي)\nدرجة القوة: ${STRENGTH_LABEL[strength]} — ${waterMl} مل ماء\nالشاهي: ${teaG}${teaG!=='—'?' جم':''} — السكر: ${sugarG}${sugarG!=='—'?' جم':''} — الخدرة: ${steepLabel} دقيقة\n— عبر موقع وزنة`;

  box.innerHTML = `
    <div class="result-title">النتيجة — درجة «${STRENGTH_LABEL[strength]}»</div>
    <div class="result-head">${avatarHtml(item.id, item.name, 52, item.photoUrl)}<div class="result-name">${escapeHTML(item.name)}</div></div>
    <div class="result-rows">
      <div class="result-row primary"><span class="r-label">وزن الشاهي</span><span class="r-value">${teaG}<span class="r-sub">${teaG !== '—' ? ' جم' : ''}</span></span></div>
      <div class="result-row"><span class="r-label">وزن السكر</span><span class="r-value">${sugarG}<span class="r-sub">${sugarG !== '—' && sugarG !== 0 ? ' جم' : (sugarG === 0 ? ' جم' : '')}</span></span></div>
      <div class="result-row"><span class="r-label">مدة الخدرة المقترحة</span><span class="r-value">${steepLabel}<span class="r-sub"> دقيقة</span></span></div>
    </div>
    <div class="range-note">${rangeNote}</div>
    ${renderMatchHint('teapotB', item.name)}
    ${actionsHtml('teapotB')}
  `;
  wireResultActions(box, 'teapotB', shareText);
  wireHintLinks(box);
  box.querySelector('.fav-btn') && box.querySelector('.fav-btn').replaceChildren(document.createTextNode(isFav('teapotB', item.name) ? '★ محفوظة' : '☆ حفظ بالمفضلة'));
}

/* =====================================================================
   تبديل التبويبات — عبر تفويض الأحداث (event delegation) عشان يشتغل
   تلقائياً حتى مع تبويبات ديناميكية تُضاف بعد تحميل الصفحة.
===================================================================== */
const RENDER_FNS = {
  moka: renderMoka,
  teapotA: renderTeapotA,
  teapotB: () => { syncTeapotBToggles(); renderTeapotB(); },
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.setAttribute('aria-selected', 'false'));
  btn.setAttribute('aria-selected', 'true');
  document.querySelectorAll('.calc-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + btn.dataset.tab);
  if (panel) panel.classList.add('active');
  const fn = RENDER_FNS[btn.dataset.tab];
  if (fn) fn();
});

/* initial paint */
renderMoka();
renderTeapotA();
syncTeapotBToggles();
renderTeapotB();

