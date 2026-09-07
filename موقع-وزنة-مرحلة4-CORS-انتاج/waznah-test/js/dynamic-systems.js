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
  tabBtn.innerHTML = `<span class="swatch" style="background:${safeColor(sys.color, '#4E8A7A')}"></span> ${escapeHTML(sys.label)}`;
  tabsSlot.appendChild(tabBtn);

  const panel = document.createElement('div');
  panel.className = 'calc-panel';
  panel.id = 'panel-' + key;

  let fieldsHtml = '';
  if (sys.shape === 'range3tier') {
    fieldsHtml = `
      <div class="field"><label>نوع الماء</label>
        <div class="toggle-group" id="${escapeHTML(key)}-water">
          <button type="button" data-val="low" aria-pressed="true">تحلية / علب (100–120)</button>
          <button type="button" data-val="high" aria-pressed="false">صنبور (120–160)</button>
        </div></div>
      <div class="field"><label>مستوى السكر</label>
        <div class="toggle-group" id="${escapeHTML(key)}-sugar">
          <button type="button" data-val="nosugar" aria-pressed="false">بدون سكر</button>
          <button type="button" data-val="medium" aria-pressed="true">وسط</button>
          <button type="button" data-val="high" aria-pressed="false">حالي</button>
        </div></div>
      <div class="field"><label>كمية الماء (مل)</label>
        <div class="amount-row" id="${escapeHTML(key)}-amount">
          <button class="chip" data-val="250">250</button>
          <button class="chip" data-val="500" aria-pressed="true">500</button>
          <button class="chip" data-val="750">750</button>
          <button class="chip" data-val="1000">1000</button>
          <div class="num-input stepper">
            <button type="button" class="step-btn" data-dir="-1" aria-label="تقليل كمية الماء">−</button>
            <input type="number" id="${escapeHTML(key)}-amount-input" value="500" min="50" step="50">
            <button type="button" class="step-btn" data-dir="1" aria-label="زيادة كمية الماء">+</button>
            <span>مل</span>
          </div></div>
        <div class="hint" id="${escapeHTML(key)}-cup-eq"></div></div>`;
  } else if (sys.shape === 'single') {
    fieldsHtml = `
      <div class="field"><label>إضافة سكر؟</label>
        <div class="toggle-group" id="${escapeHTML(key)}-sugar">
          <button type="button" data-val="yes" aria-pressed="true">نعم</button>
          <button type="button" data-val="no" aria-pressed="false">بدون سكر</button>
        </div></div>
      <div class="field"><label>كمية الماء (مل)</label>
        <div class="amount-row" id="${escapeHTML(key)}-amount">
          <button class="chip" data-val="500">500</button>
          <button class="chip" data-val="1000" aria-pressed="true">1000</button>
          <button class="chip" data-val="1500">1500</button>
          <button class="chip" data-val="2000">2000</button>
          <div class="num-input stepper">
            <button type="button" class="step-btn" data-dir="-1" aria-label="تقليل كمية الماء">−</button>
            <input type="number" id="${escapeHTML(key)}-amount-input" value="1000" min="50" step="50">
            <button type="button" class="step-btn" data-dir="1" aria-label="زيادة كمية الماء">+</button>
            <span>مل</span>
          </div></div>
        <div class="hint" id="${escapeHTML(key)}-cup-eq"></div></div>`;
  } else if (sys.shape === 'tiered_sugar') {
    fieldsHtml = `
      <div class="field"><label>درجة القوة</label>
        <div class="toggle-group" id="${escapeHTML(key)}-strength">
          <button type="button" data-val="nosugar" aria-pressed="false">بدون سكر</button>
          <button type="button" data-val="light" aria-pressed="false">خفيفة</button>
          <button type="button" data-val="medium" aria-pressed="true">مناسبة (وسط)</button>
          <button type="button" data-val="heavy" aria-pressed="false">ثقيلة (نقيلة)</button>
        </div></div>
      <div class="field"><label>كمية الماء (مل)</label>
        <div class="amount-row" id="${escapeHTML(key)}-amount">
          <button class="chip" data-val="500">500</button>
          <button class="chip" data-val="1000" aria-pressed="true">1000</button>
          <button class="chip" data-val="1500">1500</button>
          <button class="chip" data-val="2000">2000</button>
          <div class="num-input stepper">
            <button type="button" class="step-btn" data-dir="-1" aria-label="تقليل كمية الماء">−</button>
            <input type="number" id="${escapeHTML(key)}-amount-input" value="1000" min="50" step="50">
            <button type="button" class="step-btn" data-dir="1" aria-label="زيادة كمية الماء">+</button>
            <span>مل</span>
          </div></div>
        <div class="hint" id="${escapeHTML(key)}-cup-eq"></div></div>`;
  }

  panel.innerHTML = `
    <div class="card">
      <div class="field">
        <label>اسم الشاهي</label>
        <div class="search-select" id="${escapeHTML(key)}-search"></div>
        <div class="suggest-row" id="${escapeHTML(key)}-suggest"></div>
        <div class="fav-chips" id="${escapeHTML(key)}-favs"></div>
      </div>
      ${fieldsHtml}
      <div class="field">
        <label>تعديل يدوي ± (نسبة على الشاهي فقط)</label>
        <div class="slider-row">
          <span class="slider-val" id="${escapeHTML(key)}-adj-val">0%</span>
          <input type="range" id="${escapeHTML(key)}-adj" min="-10" max="10" value="0" step="1">
        </div>
      </div>
    </div>
    <div class="result-card" id="${escapeHTML(key)}-result" aria-live="polite"></div>`;
  panelsSlot.appendChild(panel);

  SYS_DATA[key] = sys.items;

  const state = { item: null, water: 'low', sugar: sys.shape === 'range3tier' ? 'medium' : 'yes',
                   strength: 'medium', amountMl: sys.shape === 'range3tier' ? 500 : 1000, adj: 0 };

  const handle = createSearchSelect(document.getElementById(`${escapeHTML(key)}-search`), sys.items, {
    getLabel: (it) => it.name,
    getSub: (it) => it.grade || it.code || '',
    placeholder: `ابحث بين ${sys.items.length} صنفاً...`,
    onSelect: (it) => { state.item = it; if (sys.shape === 'tiered_sugar') syncTieredToggles(); render(); },
  });
  SYS_HANDLES[key] = handle;
  renderSuggestChips(key);

  const favEl = document.getElementById(`${escapeHTML(key)}-favs`);
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
    wireToggleGroup(document.getElementById(`${escapeHTML(key)}-water`), (v) => { state.water = v; render(); });
  }
  if (sys.shape === 'tiered_sugar') {
    wireToggleGroup(document.getElementById(`${escapeHTML(key)}-strength`), (v) => { state.strength = v; render(); });
  } else {
    wireToggleGroup(document.getElementById(`${escapeHTML(key)}-sugar`), (v) => { state.sugar = v; render(); });
  }
  wireAmount(document.getElementById(`${escapeHTML(key)}-amount`), document.getElementById(`${escapeHTML(key)}-amount-input`),
    (v) => { state.amountMl = v; render(); }, sys.shape === 'range3tier' ? 50 : 100);
  const adjEl = document.getElementById(`${escapeHTML(key)}-adj`);
  adjEl.addEventListener('input', () => {
    state.adj = parseInt(adjEl.value, 10);
    document.getElementById(`${escapeHTML(key)}-adj-val`).textContent = state.adj + '%';
    render();
  });

  function syncTieredToggles() {
    const it = state.item;
    if (!it) return;
    const avail = { nosugar: true, light: !!it.light, medium: !!it.medium, heavy: !!it.heavy };
    const grp = document.getElementById(`${escapeHTML(key)}-strength`);
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
    const box = document.getElementById(`${escapeHTML(key)}-result`);
    const { item } = state;
    document.getElementById(`${escapeHTML(key)}-cup-eq`).textContent = cupEquivalent(state.amountMl);
    if (!item) { box.innerHTML = '<p>اختر صنفاً للبدء.</p>'; return; }

    if (sys.shape === 'range3tier') {
      const [tMin, tMax] = item[state.sugar];
      const waterCoef = state.water === 'low' ? -0.02 : 0.02;
      const scale = (state.amountMl / item.refVol) * (1 + waterCoef) * (1 + state.adj / 100);
      const rMin = round1(tMin * scale), rAvg = round1(mid(tMin, tMax) * scale), rMax = round1(tMax * scale);
      updateGlass(rAvg / 45, `${rAvg} جم`);
      const shareText = () => `وزنية ${escapeHTML(item.name)} (${escapeHTML(sys.label)})\nكمية الماء: ${state.amountMl} مل\nالموصى به: ${rAvg} جم (${rMin}–${rMax})\n— عبر موقع وزنة`;
      box.innerHTML = `
        <div class="result-title">النتيجة</div>
        <div class="result-head">${avatarHtml(item.id, item.name, 52, item.photoUrl)}<div class="result-name">${escapeHTML(item.name)}</div></div>
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
      const shareText = () => `وزنية ${escapeHTML(item.name)} (${escapeHTML(sys.label)})\nكمية الماء: ${state.amountMl} مل\nالشاهي: ${teaG} جم — السكر: ${sugarG} جم — التخدير: ${item.steep} دقيقة\n— عبر موقع وزنة`;
      box.innerHTML = `
        <div class="result-title">النتيجة</div>
        <div class="result-head">${avatarHtml(item.id, item.name, 52, item.photoUrl)}<div class="result-name">${escapeHTML(item.name)}</div></div>
        ${item.code ? `<span class="grade-chip">${escapeHTML(item.code)}</span>` : ''}
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
      const shareText = () => `وزنية ${escapeHTML(item.name)} (${escapeHTML(sys.label)})\nدرجة القوة: ${STRENGTH_LABEL[state.strength]}\nالشاهي: ${teaG}${teaG!=='—'?' جم':''} — السكر: ${sugarG}${sugarG!=='—'?' جم':''}\n— عبر موقع وزنة`;
      box.innerHTML = `
        <div class="result-title">النتيجة — درجة «${STRENGTH_LABEL[state.strength]}»</div>
        <div class="result-head">${avatarHtml(item.id, item.name, 52, item.photoUrl)}<div class="result-name">${escapeHTML(item.name)}</div></div>
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
