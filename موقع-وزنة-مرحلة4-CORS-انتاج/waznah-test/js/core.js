// =====================================================================
// وزنة — منطق الحاسبات الثلاث (يطابق معادلات ملف الإكسل الأصلي تماماً)
// =====================================================================
'use strict';

// تحصين موحّد للنصوص القادمة من PocketBase قبل إدراجها داخل HTML.
function escapeHTML(value) {
  return String(value == null ? '' : value).replace(/[&<>\"']/g, function (ch) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[ch];
  });
}
function safeUrl(value) {
  try {
    const u = new URL(String(value || ''), document.baseURI);
    if (u.protocol === 'https:' || u.protocol === 'http:') return u.href;
  } catch (e) {}
  return '';
}

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
function safeColor(value, fallback) {
  const v = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v) ? v : fallback;
}
function avatarColors(name) {
  return AVATAR_PALETTE[hashStr(name) % AVATAR_PALETTE.length];
}
function avatarHtml(id, name, size, photoUrl) {
  size = size || 44;
  const { bg, fg } = avatarColors(name);
  const initials = getInitials(name);
  const src = safeUrl(photoUrl || `images/${encodeURIComponent(id)}.jpg`);
  return `
    <span class="avatar" style="width:${size}px;height:${size}px;background:${safeColor(bg, '#8A9B6E')};color:${safeColor(fg, '#12160D')};font-size:${Math.round(size * 0.36)}px">
      <img src="${escapeHTML(src)}" alt="" loading="lazy"
           onerror="this.style.display='none'"
           onload="this.style.display='block'; this.nextElementSibling.style.display='none';">
      <span class="avatar-fallback">${escapeHTML(initials)}</span>
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
    `<button type="button" class="fav-chip" data-name="${escapeHTML(n)}">${escapeHTML(n)}</button>`
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
    `<button type="button" class="hint-link" data-jump-sys="${escapeHTML(o.system)}" data-jump-name="${escapeHTML(o.name)}">«${escapeHTML(o.name)}» في ${escapeHTML(SYS_LABEL[o.system] || o.system)}</button>`
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
    <input type="text" autocomplete="off" placeholder="${escapeHTML(placeholder || 'اكتب للبحث عن صنف...')}" aria-label="ابحث عن اسم الشاهي">
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
        ${avatarHtml(it.id, escapeHTML(getLabel(it)), 28, it.photoUrl)}
        <span class="opt-text">
          <span>${escapeHTML(getLabel(it))}</span>
          ${getSub && getSub(it) ? `<span class="badge">${escapeHTML(getSub(it))}</span>` : ''}
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
