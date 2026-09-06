// =====================================================================
// وزنة — منطق الحاسبات الثلاث (يطابق معادلات ملف الإكسل الأصلي تماماً)
// =====================================================================
'use strict';

const round1 = (n) => Math.round(n * 10) / 10;
const mid = (a, b) => (a + b) / 2;
const STRENGTH_LABEL = { nosugar: 'بدون سكر', light: 'خفيفة', medium: 'مناسبة (وسط)', heavy: 'ثقيلة (نقيلة)' };
const SYS_LABEL = { moka: 'إبريق صانع الشاهي (الموكا)', teapotA: 'الإبريق العادي (7AMDAN_LAB)', teapotB: 'الإبريق العادي (ملك الشواهي)' };

const GRADE_BY_CODE = {};
(TEA_DATA.grades || []).forEach(g => { GRADE_BY_CODE[g.code] = g; });

const SYS_DATA = { moka: TEA_DATA.moka, teapotA: TEA_DATA.teapotA, teapotB: TEA_DATA.teapotB };
const SYS_HANDLES = {};

/* ---------------------------------------------------------------
   الصورة الرمزية لكل صنف — لون + حرف مبني من اسمه، وجاهز يستبدل
   نفسه تلقائياً بصورة حقيقية لو حطيتها بمجلد images/ بنفس معرّف الصنف
   (مثال: images/T001.jpg) — بدون أي تعديل على الكود.
--------------------------------------------------------------- */
const AVATAR_PALETTE = [
  { bg: '#C17817', fg: '#1B1206' }, // amber
  { bg: '#8A9B6E', fg: '#12160D' }, // sage
  { bg: '#C1572E', fg: '#1B0E08' }, // rust
  { bg: '#E8A94C', fg: '#1B1206' }, // honey
  { bg: '#6C7A96', fg: '#0E1118' }, // slate blue
  { bg: '#A6763E', fg: '#160F07' }, // clay
  { bg: '#7C6A9B', fg: '#120E18' }, // muted plum
  { bg: '#4E8A7A', fg: '#0A1512' }, // teal
];
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function getInitials(name) {
  let n = name.replace(/^شاي\s+/, '').trim();
  if (!n) n = name.trim();
  let firstWord = n.split(/\s+/)[0];
  // تجاهل "ال" التعريف لو الكلمة أطول منها، عشان تتنوع الحروف بدل ما تتكرر
  if (firstWord.length > 3 && firstWord.startsWith('ال')) firstWord = firstWord.slice(2);
  return firstWord.slice(0, 2);
}
function avatarColors(name) {
  return AVATAR_PALETTE[hashStr(name) % AVATAR_PALETTE.length];
}
function avatarHtml(id, name, size, photoUrl) {
  size = size || 44;
  const { bg, fg } = avatarColors(name);
  const initials = getInitials(name);
  const src = photoUrl || `images/${id}.jpg`;
  return `
    <span class="avatar" style="width:${size}px;height:${size}px;background:${bg};color:${fg};font-size:${Math.round(size * 0.36)}px">
      <img src="${src}" alt="" loading="lazy"
           onerror="this.style.display='none'"
           onload="this.style.display='block'; this.nextElementSibling.style.display='none';">
      <span class="avatar-fallback">${initials}</span>
    </span>`;
}

/* ---------------------------------------------------------------
   المفضلة (localStorage) — بدون أي خادم، محفوظة على هذا الجهاز فقط
--------------------------------------------------------------- */
const FAV_KEY = (sys) => `wazna_fav_${sys}`;
function getFavs(sys) { try { return JSON.parse(localStorage.getItem(FAV_KEY(sys)) || '[]'); } catch (e) { return []; } }
function setFavs(sys, arr) { try { localStorage.setItem(FAV_KEY(sys), JSON.stringify(arr)); } catch (e) {} }
function toggleFav(sys, name) {
  const favs = getFavs(sys);
  const i = favs.indexOf(name);
  if (i === -1) favs.unshift(name); else favs.splice(i, 1);
  setFavs(sys, favs.slice(0, 12));
  renderFavChips(sys);
}
function isFav(sys, name) { return getFavs(sys).includes(name); }
function renderFavChips(sys) {
  const el = document.getElementById(sys + '-favs');
  if (!el) return;
  const favs = getFavs(sys);
  if (!favs.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = `<span class="favs-label">المفضلة:</span>` + favs.map(n =>
    `<button type="button" class="fav-chip" data-name="${n.replace(/"/g, '&quot;')}">${n}</button>`
  ).join('');
}

/* ---------------------------------------------------------------
   تلميح التطابق بين الأنظمة (بدون أي دمج فعلي للأرقام)
--------------------------------------------------------------- */
function renderMatchHint(sys, name) {
  const key = `${sys}::${name}`;
  const others = (TEA_DATA.matches || {})[key];
  if (!others || !others.length) return '';
  const links = others.map(o =>
    `<button type="button" class="hint-link" data-jump-sys="${o.system}" data-jump-name="${o.name.replace(/"/g, '&quot;')}">«${o.name}» في ${SYS_LABEL[o.system]}</button>`
  ).join('، ');
  return `<div class="match-hint">👀 لقينا اسماً مشابهاً: ${links} — مو بالضرورة نفس المنتج، اضغط للمقارنة بنفسك.</div>`;
}
function wireHintLinks(box) {
  box.querySelectorAll('.hint-link').forEach(btn => {
    btn.addEventListener('click', () => {
      const sys = btn.dataset.jumpSys, name = btn.dataset.jumpName;
      document.querySelector(`.tab-btn[data-tab="${sys}"]`).click();
      const item = SYS_DATA[sys].find(it => it.name === name);
      if (item) SYS_HANDLES[sys].setValue(item);
      document.getElementById('calc').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ---------------------------------------------------------------
   أزرار نسخ / مشاركة النتيجة
--------------------------------------------------------------- */
function actionsHtml(sys) {
  return `
    <div class="result-actions">
      <button type="button" class="icon-btn" data-action="copy" data-sys="${sys}">📋 نسخ النتيجة</button>
      <button type="button" class="icon-btn" data-action="share" data-sys="${sys}">📤 واتساب</button>
      <button type="button" class="icon-btn" data-action="print" data-sys="${sys}">🖨️ طباعة</button>
      <button type="button" class="icon-btn fav-btn" data-action="fav" data-sys="${sys}">☆ حفظ بالمفضلة</button>
    </div>`;
}
function wireResultActions(box, sys, getShareText) {
  box.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = getShareText();
      if (btn.dataset.action === 'copy') {
        copyText(text).then(ok => flashBtn(btn, ok ? '✅ تم النسخ' : '❌ تعذّر النسخ'));
      } else if (btn.dataset.action === 'share') {
        window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
      } else if (btn.dataset.action === 'print') {
        window.print();
      } else if (btn.dataset.action === 'fav') {
        const state = { moka: mokaState, teapotA: teapotAState, teapotB: teapotBState }[sys];
        if (state.item) { toggleFav(sys, state.item.name); flashBtn(btn, isFav(sys, state.item.name) ? '★ محفوظة' : '☆ حفظ بالمفضلة'); }
      }
    });
  });
}
function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => copyFallback(text));
  }
  return Promise.resolve(copyFallback(text));
}
function copyFallback(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}
function flashBtn(btn, text) {
  const original = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = original; }, 1600);
}

/* ---------------------------------------------------------------
   مكوّن: قائمة منسدلة قابلة للبحث (نعيد استخدامه للأنظمة الثلاثة)
--------------------------------------------------------------- */
function createSearchSelect(container, items, opts) {
  const { getLabel, getSub, placeholder, onSelect } = opts;
  container.innerHTML = `
    <input type="text" autocomplete="off" placeholder="${placeholder || 'اكتب للبحث عن صنف...'}" aria-label="ابحث عن اسم الشاهي">
    <div class="panel" role="listbox"></div>
  `;
  const input = container.querySelector('input');
  const panel = container.querySelector('.panel');
  let activeIndex = -1;
  let filtered = items;

  function renderList(list) {
    filtered = list;
    activeIndex = -1;
    if (list.length === 0) {
      panel.innerHTML = `<div class="empty">ما لقينا صنفاً مطابقاً</div>`;
      return;
    }
    panel.innerHTML = list.slice(0, 60).map((it, i) => `
      <div class="opt" data-idx="${i}" role="option">
        ${avatarHtml(it.id, getLabel(it), 28, it.photoUrl)}
        <span class="opt-text">
          <span>${getLabel(it)}</span>
          ${getSub && getSub(it) ? `<span class="badge">${getSub(it)}</span>` : ''}
        </span>
      </div>
    `).join('');
  }

  function openPanel() { panel.classList.add('open'); }
  function closePanel() { panel.classList.remove('open'); }

  function selectItem(it) {
    input.value = getLabel(it);
    closePanel();
    onSelect(it);
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    const list = q
      ? items.filter(it => getLabel(it).toLowerCase().includes(q.toLowerCase()))
      : items;
    renderList(list);
    openPanel();
  });
  input.addEventListener('focus', () => { renderList(items); openPanel(); });
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) closePanel();
  });
  panel.addEventListener('click', (e) => {
    const opt = e.target.closest('.opt');
    if (!opt) return;
    selectItem(filtered[+opt.dataset.idx]);
  });
  input.addEventListener('keydown', (e) => {
    if (!panel.classList.contains('open')) return;
    const opts = [...panel.querySelectorAll('.opt')];
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIndex = Math.min(activeIndex + 1, opts.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIndex = Math.max(activeIndex - 1, 0); }
    else if (e.key === 'Enter') { e.preventDefault(); if (opts[activeIndex]) selectItem(filtered[activeIndex]); return; }
    else if (e.key === 'Escape') { closePanel(); return; }
    else return;
    opts.forEach(o => o.classList.remove('active'));
    if (opts[activeIndex]) { opts[activeIndex].classList.add('active'); opts[activeIndex].scrollIntoView({ block: 'nearest' }); }
  });

  // initial default selection
  renderList(items);
  if (items[0]) selectItem(items[0]);

  return { setValue: selectItem };
}

/* ---------------------------------------------------------------
   مكوّن: مجموعة أزرار تبديل (toggle group)
--------------------------------------------------------------- */
function wireToggleGroup(container, onChange) {
  container.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      [...container.children].forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      onChange(btn.dataset.val);
    });
  });
}
function getToggleVal(container) {
  const active = container.querySelector('[aria-pressed="true"]');
  return active ? active.dataset.val : null;
}

/* ---------------------------------------------------------------
   مكوّن: صف كمية سريعة + إدخال رقمي مرتبط
--------------------------------------------------------------- */
function wireAmount(rowEl, inputEl, onChange, step) {
  step = step || 50;
  rowEl.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      rowEl.querySelectorAll('.chip').forEach(c => c.removeAttribute('aria-pressed'));
      chip.setAttribute('aria-pressed', 'true');
      inputEl.value = chip.dataset.val;
      onChange(parseFloat(chip.dataset.val));
    });
  });
  function clearChipSelection() {
    rowEl.querySelectorAll('.chip').forEach(c => c.removeAttribute('aria-pressed'));
  }
  inputEl.addEventListener('input', () => {
    clearChipSelection();
    const v = parseFloat(inputEl.value);
    if (!isNaN(v) && v > 0) onChange(v);
  });
  const stepMin = parseFloat(inputEl.min) || step;
  rowEl.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = parseInt(btn.dataset.dir, 10);
      let v = (parseFloat(inputEl.value) || 0) + dir * step;
      v = Math.max(stepMin, v);
      inputEl.value = v;
      clearChipSelection();
      onChange(v);
    });
  });
}

function cupEquivalent(ml) {
  const cups = ml / 240;
  return `≈ ${cups < 0.1 ? '<0.1' : (Math.round(cups * 10) / 10)} كوب شاي (240 مل تقريباً)`;
}

/* ---------------------------------------------------------------
   اقتراحات شائعة — نقطة بداية سريعة لأول زيارة (قبل ما تصير عنده مفضلة)
--------------------------------------------------------------- */
const POPULAR = {
  moka: ['شاي 999', 'شاي النهرين', 'شاي الوزة FBOP1', 'شاي أبو جبل'],
  teapotA: ['999 شاي', 'شاي النهرين', 'شاي الوزة', 'شاي ابو جبل'],
  teapotB: ['999', 'النهرين', 'الوزة حديد مربع'],
};
function renderSuggestChips(sys) {
  const el = document.getElementById(sys + '-suggest');
  if (!el) return;
  const popular = POPULAR[sys];
  if (!popular) { el.innerHTML = ''; return; } // نظام ديناميكي جديد — ما فيه قائمة شائعة معروفة له بعد
  const names = popular.filter(n => SYS_DATA[sys].some(it => it.name === n));
  if (!names.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<span class="suggest-label">جرّب:</span>` + names.map(n =>
    `<button type="button" class="suggest-chip" data-name="${n.replace(/"/g, '&quot;')}">${n}</button>`
  ).join('');
  el.querySelectorAll('.suggest-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const item = SYS_DATA[sys].find(it => it.name === chip.dataset.name);
      if (item) SYS_HANDLES[sys].setValue(item);
    });
  });
}
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
        <span class="grade-chip">${item.grade} — ${g.full}</span>
        <p>سرعة الاستخلاص: ${g.speed} · احتمالية المرارة: ${g.bitter}</p>
        <p>مدة النقع المقترحة: ${g.brew}</p>
        <a class="grade-link" href="#grades" data-jump="${item.grade}">تفاصيل أكثر عن ${item.grade} ⟵</a>
      </div>`;
  }

  const shareText = () =>
    `وزنية ${item.name} (إبريق صانع الشاهي/الموكا)\nنوع الماء: ${water === 'low' ? 'تحلية/علب' : 'صنبور'} — سكر: ${{nosugar:'بدون سكر',medium:'وسط',high:'حالي'}[sugar]} — ${amountMl} مل ماء\nالوزنة الموصى بها: ${rAvg} جم (من ${rMin} إلى ${rMax})\n— عبر موقع وزنة`;

  box.innerHTML = `
    <div class="result-title">النتيجة</div>
    <div class="result-head">${avatarHtml(item.id, item.name, 52, item.photoUrl)}<div class="result-name">${item.name}</div></div>
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
    `وزنية ${item.name} (الإبريق العادي — مصدر @7AMDAN_LAB)\n${sugar === 'yes' ? 'مع سكر' : 'بدون سكر'} — ${waterMl} مل ماء\nالشاهي: ${teaG} جم${sugar==='yes' ? ` — السكر: ${sugarG} جم` : ''} — مدة التخدير: ${item.steep} دقيقة\n— عبر موقع وزنة`;

  box.innerHTML = `
    <div class="result-title">النتيجة</div>
    <div class="result-head">${avatarHtml(item.id, item.name, 52, item.photoUrl)}<div class="result-name">${item.name}</div></div>
    ${item.code ? `<span class="grade-chip">${item.code}</span>` : ''}
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
    `وزنية ${item.name} (الإبريق العادي — مصدر ملك الشواهي)\nدرجة القوة: ${STRENGTH_LABEL[strength]} — ${waterMl} مل ماء\nالشاهي: ${teaG}${teaG!=='—'?' جم':''} — السكر: ${sugarG}${sugarG!=='—'?' جم':''} — الخدرة: ${steepLabel} دقيقة\n— عبر موقع وزنة`;

  box.innerHTML = `
    <div class="result-title">النتيجة — درجة «${STRENGTH_LABEL[strength]}»</div>
    <div class="result-head">${avatarHtml(item.id, item.name, 52, item.photoUrl)}<div class="result-name">${item.name}</div></div>
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

/* =====================================================================
   أنظمة ديناميكية — أي نظام إبريق/مصدر جديد يُسجَّل من لوحة التحكم
   (custom_systems بـPocketBase) يظهر هنا تلقائياً كتبويب كامل، بنفس
   منطق الحساب لأحد الأشكال الثلاثة المعروفة (مدى ثلاثي / قيمة واحدة /
   مدى مع سكر منفصل) — بدون أي تعديل يدوي على الكود.
===================================================================== */
function buildDynamicPanel(sys) {
  const key = 'custom-' + sys.key;
  const tabsSlot = document.getElementById('dynamic-tabs-slot');
  const panelsSlot = document.getElementById('dynamic-panels-slot');
  if (!tabsSlot || !panelsSlot) return;

  const tabBtn = document.createElement('button');
  tabBtn.className = 'tab-btn';
  tabBtn.setAttribute('role', 'tab');
  tabBtn.setAttribute('aria-selected', 'false');
  tabBtn.dataset.tab = key;
  tabBtn.innerHTML = `<span class="swatch" style="background:${sys.color}"></span> ${sys.label}`;
  tabsSlot.appendChild(tabBtn);

  const panel = document.createElement('div');
  panel.className = 'calc-panel';
  panel.id = 'panel-' + key;

  let fieldsHtml = '';
  if (sys.shape === 'range3tier') {
    fieldsHtml = `
      <div class="field"><label>نوع الماء</label>
        <div class="toggle-group" id="${key}-water">
          <button type="button" data-val="low" aria-pressed="true">تحلية / علب (100–120)</button>
          <button type="button" data-val="high" aria-pressed="false">صنبور (120–160)</button>
        </div></div>
      <div class="field"><label>مستوى السكر</label>
        <div class="toggle-group" id="${key}-sugar">
          <button type="button" data-val="nosugar" aria-pressed="false">بدون سكر</button>
          <button type="button" data-val="medium" aria-pressed="true">وسط</button>
          <button type="button" data-val="high" aria-pressed="false">حالي</button>
        </div></div>
      <div class="field"><label>كمية الماء (مل)</label>
        <div class="amount-row" id="${key}-amount">
          <button class="chip" data-val="250">250</button>
          <button class="chip" data-val="500" aria-pressed="true">500</button>
          <button class="chip" data-val="750">750</button>
          <button class="chip" data-val="1000">1000</button>
          <div class="num-input stepper">
            <button type="button" class="step-btn" data-dir="-1" aria-label="تقليل كمية الماء">−</button>
            <input type="number" id="${key}-amount-input" value="500" min="50" step="50">
            <button type="button" class="step-btn" data-dir="1" aria-label="زيادة كمية الماء">+</button>
            <span>مل</span>
          </div></div>
        <div class="hint" id="${key}-cup-eq"></div></div>`;
  } else if (sys.shape === 'single') {
    fieldsHtml = `
      <div class="field"><label>إضافة سكر؟</label>
        <div class="toggle-group" id="${key}-sugar">
          <button type="button" data-val="yes" aria-pressed="true">نعم</button>
          <button type="button" data-val="no" aria-pressed="false">بدون سكر</button>
        </div></div>
      <div class="field"><label>كمية الماء (مل)</label>
        <div class="amount-row" id="${key}-amount">
          <button class="chip" data-val="500">500</button>
          <button class="chip" data-val="1000" aria-pressed="true">1000</button>
          <button class="chip" data-val="1500">1500</button>
          <button class="chip" data-val="2000">2000</button>
          <div class="num-input stepper">
            <button type="button" class="step-btn" data-dir="-1" aria-label="تقليل كمية الماء">−</button>
            <input type="number" id="${key}-amount-input" value="1000" min="50" step="50">
            <button type="button" class="step-btn" data-dir="1" aria-label="زيادة كمية الماء">+</button>
            <span>مل</span>
          </div></div>
        <div class="hint" id="${key}-cup-eq"></div></div>`;
  } else if (sys.shape === 'tiered_sugar') {
    fieldsHtml = `
      <div class="field"><label>درجة القوة</label>
        <div class="toggle-group" id="${key}-strength">
          <button type="button" data-val="nosugar" aria-pressed="false">بدون سكر</button>
          <button type="button" data-val="light" aria-pressed="false">خفيفة</button>
          <button type="button" data-val="medium" aria-pressed="true">مناسبة (وسط)</button>
          <button type="button" data-val="heavy" aria-pressed="false">ثقيلة (نقيلة)</button>
        </div></div>
      <div class="field"><label>كمية الماء (مل)</label>
        <div class="amount-row" id="${key}-amount">
          <button class="chip" data-val="500">500</button>
          <button class="chip" data-val="1000" aria-pressed="true">1000</button>
          <button class="chip" data-val="1500">1500</button>
          <button class="chip" data-val="2000">2000</button>
          <div class="num-input stepper">
            <button type="button" class="step-btn" data-dir="-1" aria-label="تقليل كمية الماء">−</button>
            <input type="number" id="${key}-amount-input" value="1000" min="50" step="50">
            <button type="button" class="step-btn" data-dir="1" aria-label="زيادة كمية الماء">+</button>
            <span>مل</span>
          </div></div>
        <div class="hint" id="${key}-cup-eq"></div></div>`;
  }

  panel.innerHTML = `
    <div class="card">
      <div class="field">
        <label>اسم الشاهي</label>
        <div class="search-select" id="${key}-search"></div>
        <div class="suggest-row" id="${key}-suggest"></div>
        <div class="fav-chips" id="${key}-favs"></div>
      </div>
      ${fieldsHtml}
      <div class="field">
        <label>تعديل يدوي ± (نسبة على الشاهي فقط)</label>
        <div class="slider-row">
          <span class="slider-val" id="${key}-adj-val">0%</span>
          <input type="range" id="${key}-adj" min="-10" max="10" value="0" step="1">
        </div>
      </div>
    </div>
    <div class="result-card" id="${key}-result" aria-live="polite"></div>`;
  panelsSlot.appendChild(panel);

  SYS_DATA[key] = sys.items;

  const state = { item: null, water: 'low', sugar: sys.shape === 'range3tier' ? 'medium' : 'yes',
                   strength: 'medium', amountMl: sys.shape === 'range3tier' ? 500 : 1000, adj: 0 };

  const handle = createSearchSelect(document.getElementById(`${key}-search`), sys.items, {
    getLabel: (it) => it.name,
    getSub: (it) => it.grade || it.code || '',
    placeholder: `ابحث بين ${sys.items.length} صنفاً...`,
    onSelect: (it) => { state.item = it; if (sys.shape === 'tiered_sugar') syncTieredToggles(); render(); },
  });
  SYS_HANDLES[key] = handle;
  renderSuggestChips(key);

  const favEl = document.getElementById(`${key}-favs`);
  if (favEl) {
    renderFavChips(key);
    favEl.addEventListener('click', (e) => {
      const chip = e.target.closest('.fav-chip');
      if (!chip) return;
      const item = SYS_DATA[key].find(it => it.name === chip.dataset.name);
      if (item) SYS_HANDLES[key].setValue(item);
    });
  }

  if (sys.shape === 'range3tier') {
    wireToggleGroup(document.getElementById(`${key}-water`), (v) => { state.water = v; render(); });
  }
  if (sys.shape === 'tiered_sugar') {
    wireToggleGroup(document.getElementById(`${key}-strength`), (v) => { state.strength = v; render(); });
  } else {
    wireToggleGroup(document.getElementById(`${key}-sugar`), (v) => { state.sugar = v; render(); });
  }
  wireAmount(document.getElementById(`${key}-amount`), document.getElementById(`${key}-amount-input`),
    (v) => { state.amountMl = v; render(); }, sys.shape === 'range3tier' ? 50 : 100);
  const adjEl = document.getElementById(`${key}-adj`);
  adjEl.addEventListener('input', () => {
    state.adj = parseInt(adjEl.value, 10);
    document.getElementById(`${key}-adj-val`).textContent = state.adj + '%';
    render();
  });

  function syncTieredToggles() {
    const it = state.item;
    if (!it) return;
    const avail = { nosugar: true, light: !!it.light, medium: !!it.medium, heavy: !!it.heavy };
    const grp = document.getElementById(`${key}-strength`);
    [...grp.children].forEach(b => {
      b.disabled = !avail[b.dataset.val];
      if (b.disabled && b.getAttribute('aria-pressed') === 'true') b.setAttribute('aria-pressed', 'false');
    });
    if (!getToggleVal(grp)) {
      const fallback = ['medium', 'heavy', 'light', 'nosugar'].find(v => avail[v]);
      const btn = [...grp.children].find(b => b.dataset.val === fallback);
      if (btn) btn.setAttribute('aria-pressed', 'true');
      state.strength = fallback;
    }
  }

  function render() {
    const box = document.getElementById(`${key}-result`);
    const { item } = state;
    document.getElementById(`${key}-cup-eq`).textContent = cupEquivalent(state.amountMl);
    if (!item) { box.innerHTML = '<p>اختر صنفاً للبدء.</p>'; return; }

    if (sys.shape === 'range3tier') {
      const [tMin, tMax] = item[state.sugar];
      const waterCoef = state.water === 'low' ? -0.02 : 0.02;
      const scale = (state.amountMl / item.refVol) * (1 + waterCoef) * (1 + state.adj / 100);
      const rMin = round1(tMin * scale), rAvg = round1(mid(tMin, tMax) * scale), rMax = round1(tMax * scale);
      updateGlass(rAvg / 45, `${rAvg} جم`);
      const shareText = () => `وزنية ${item.name} (${sys.label})\nكمية الماء: ${state.amountMl} مل\nالموصى به: ${rAvg} جم (${rMin}–${rMax})\n— عبر موقع وزنة`;
      box.innerHTML = `
        <div class="result-title">النتيجة</div>
        <div class="result-head">${avatarHtml(item.id, item.name, 52, item.photoUrl)}<div class="result-name">${item.name}</div></div>
        <span class="status-badge ${item.status === 'estimated' ? 'estimated' : 'verified'}">${item.status === 'estimated' ? 'تقديري' : 'موثّق'}</span>
        <div class="result-rows">
          <div class="result-row"><span class="r-label">الحد الأدنى</span><span class="r-value">${rMin}<span class="r-sub"> جم</span></span></div>
          <div class="result-row primary"><span class="r-label">الموصى به</span><span class="r-value">${rAvg}<span class="r-sub"> جم</span></span></div>
          <div class="result-row"><span class="r-label">الحد الأعلى</span><span class="r-value">${rMax}<span class="r-sub"> جم</span></span></div>
        </div>
        ${renderMatchHint(key, item.name)}
        ${actionsHtml(key)}`;
      wireResultActions(box, key, shareText);
      wireHintLinks(box);
    } else if (sys.shape === 'single') {
      const base = state.sugar === 'yes' ? item.teaWithSugar : item.teaNoSugar;
      const teaG = round1(base * (state.amountMl / 1000) * (1 + state.adj / 100));
      const sugarG = state.sugar === 'yes' ? round1(item.sugar * (state.amountMl / 1000)) : 0;
      updateGlass(teaG / 18, `${teaG} جم`);
      const shareText = () => `وزنية ${item.name} (${sys.label})\nكمية الماء: ${state.amountMl} مل\nالشاهي: ${teaG} جم — السكر: ${sugarG} جم — التخدير: ${item.steep} دقيقة\n— عبر موقع وزنة`;
      box.innerHTML = `
        <div class="result-title">النتيجة</div>
        <div class="result-head">${avatarHtml(item.id, item.name, 52, item.photoUrl)}<div class="result-name">${item.name}</div></div>
        ${item.code ? `<span class="grade-chip">${item.code}</span>` : ''}
        <div class="result-rows">
          <div class="result-row primary"><span class="r-label">وزن الشاهي</span><span class="r-value">${teaG}<span class="r-sub"> جم</span></span></div>
          <div class="result-row"><span class="r-label">وزن السكر</span><span class="r-value">${sugarG}<span class="r-sub"> جم</span></span></div>
          <div class="result-row"><span class="r-label">مدة التخدير</span><span class="r-value">${item.steep}<span class="r-sub"> دقيقة</span></span></div>
        </div>
        ${renderMatchHint(key, item.name)}
        ${actionsHtml(key)}`;
      wireResultActions(box, key, shareText);
      wireHintLinks(box);
    } else if (sys.shape === 'tiered_sugar') {
      const liters = state.amountMl / 1000;
      let teaG = '—', sugarG = '—', rangeNote = 'لا تتوفر بيانات لهذه الدرجة.';
      if (state.strength === 'nosugar') {
        const [tMin, tMax] = item.nosugar;
        teaG = round1(mid(tMin, tMax) * liters * (1 + state.adj / 100)); sugarG = 0;
        rangeNote = `مدى المصدر (بدون سكر): ${tMin}–${tMax} جم شاهي لكل لتر.`;
      } else {
        const tier = item[state.strength];
        if (tier) {
          const [sMin, sMax, tMin, tMax] = tier;
          teaG = round1(mid(tMin, tMax) * liters * (1 + state.adj / 100));
          sugarG = round1(mid(sMin, sMax) * liters);
          rangeNote = `مدى المصدر لكل لتر — شاهي: ${tMin}–${tMax} جم، سكر: ${sMin}–${sMax} جم.`;
        }
      }
      const steepLabel = item.steep[0] === item.steep[1] ? item.steep[0] : `${item.steep[0]}–${item.steep[1]}`;
      updateGlass(typeof teaG === 'number' ? teaG / 16 : 0.1, typeof teaG === 'number' ? `${teaG} جم` : '—');
      const shareText = () => `وزنية ${item.name} (${sys.label})\nدرجة القوة: ${STRENGTH_LABEL[state.strength]}\nالشاهي: ${teaG}${teaG!=='—'?' جم':''} — السكر: ${sugarG}${sugarG!=='—'?' جم':''}\n— عبر موقع وزنة`;
      box.innerHTML = `
        <div class="result-title">النتيجة — درجة «${STRENGTH_LABEL[state.strength]}»</div>
        <div class="result-head">${avatarHtml(item.id, item.name, 52, item.photoUrl)}<div class="result-name">${item.name}</div></div>
        <div class="result-rows">
          <div class="result-row primary"><span class="r-label">وزن الشاهي</span><span class="r-value">${teaG}<span class="r-sub">${teaG !== '—' ? ' جم' : ''}</span></span></div>
          <div class="result-row"><span class="r-label">وزن السكر</span><span class="r-value">${sugarG}<span class="r-sub">${sugarG === 0 || (sugarG !== '—') ? ' جم' : ''}</span></span></div>
          <div class="result-row"><span class="r-label">مدة الخدرة</span><span class="r-value">${steepLabel}<span class="r-sub"> دقيقة</span></span></div>
        </div>
        <div class="range-note">${rangeNote}</div>
        ${renderMatchHint(key, item.name)}
        ${actionsHtml(key)}`;
      wireResultActions(box, key, shareText);
      wireHintLinks(box);
    }
  }

  RENDER_FNS[key] = () => { if (sys.shape === 'tiered_sugar') syncTieredToggles(); render(); };
  if (sys.shape === 'tiered_sugar') syncTieredToggles();
  render();
}

function renderDynamicSystems() {
  const list = TEA_DATA.customSystems || [];
  list.forEach(sys => { if (sys.items && sys.items.length) buildDynamicPanel(sys); });
}
renderDynamicSystems();

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
      <h4>${g.full || g.code}</h4>
      <p class="grade-cat">${g.cat || ''}</p>
      <p class="grade-desc">${g.desc || ''}</p>
      <div class="grade-meta">
        <div><span>سرعة الاستخلاص</span><b>${g.speed || '—'}</b></div>
        <div><span>احتمالية المرارة</span><b>${g.bitter || '—'}</b></div>
        <div><span>مدة النقع</span><b>${g.brew || '—'}</b></div>
      </div>
      ${g.examples ? `<p class="grade-examples">${g.examples}</p>` : ''}
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
