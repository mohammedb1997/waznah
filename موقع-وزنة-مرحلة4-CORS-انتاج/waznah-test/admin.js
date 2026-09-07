'use strict';

/* =====================================================================
   إعدادات وحالة عامة
===================================================================== */
var state = {
  baseUrl: '',
  token: '', // للاستخدام المرحلي فقط؛ وضع BFF لا يحفظ توكن PocketBase في المتصفح.
  mode: 'bff',
  systems: [],      // [{key, label, shape, color, sourceName, collectionName, builtin}]
  currentSystem: null,
  currentView: 'teas',
  editingRecordId: null,
  gradesEditingId: null,
};

var Config = {
  // BFF هو الوضع الآمن الافتراضي والإجباري حالياً.
  MODE: 'bff',

  REQUEST_TIMEOUT_MS: 15000,

  // عنوان Cloudflare Worker الخاص بلوحة الإدارة.
  BFF_DEFAULT_URL: 'https://waznah-admin-bff.waznah.workers.dev',
};


var BUILTIN_SYSTEMS = [
  { key: 'moka', label: 'إبريق صانع الشاهي (الموكا)', shape: 'range3tier', color: '#C17817', collectionName: 'moka_teas', builtin: true },
  { key: 'teapotA', label: 'الإبريق العادي (7AMDAN_LAB)', shape: 'single', color: '#8A9B6E', collectionName: 'teapotA_teas', builtin: true },
  { key: 'teapotB', label: 'الإبريق العادي (ملك الشواهي)', shape: 'tiered_sugar', color: '#C1572E', collectionName: 'teapotB_teas', builtin: true },
];

var SHAPE_FIELDS = {
  range3tier: [
    { name: 'tea_id', type: 'text', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'pack', type: 'text' },
    { name: 'ref_vol', type: 'number' },
    { name: 'status', type: 'select', values: ['verified', 'estimated'], maxSelect: 1 },
    { name: 'grade', type: 'text' },
    { name: 'nosugar_min', type: 'number' }, { name: 'nosugar_max', type: 'number' },
    { name: 'medium_min', type: 'number' }, { name: 'medium_max', type: 'number' },
    { name: 'high_min', type: 'number' }, { name: 'high_max', type: 'number' },
    { name: 'photo', type: 'file', maxSelect: 1, maxSize: 5242880 },
  ],
  single: [
    { name: 'tea_id', type: 'text', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'code', type: 'text' },
    { name: 'tea_with_sugar', type: 'number' },
    { name: 'sugar', type: 'number' },
    { name: 'tea_no_sugar', type: 'number' },
    { name: 'steep', type: 'number' },
    { name: 'photo', type: 'file', maxSelect: 1, maxSize: 5242880 },
  ],
  tiered_sugar: [
    { name: 'tea_id', type: 'text', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'steep_min', type: 'number' }, { name: 'steep_max', type: 'number' },
    { name: 'nosugar_min', type: 'number' }, { name: 'nosugar_max', type: 'number' },
    { name: 'light_sugar_min', type: 'number' }, { name: 'light_sugar_max', type: 'number' },
    { name: 'light_tea_min', type: 'number' }, { name: 'light_tea_max', type: 'number' },
    { name: 'medium_sugar_min', type: 'number' }, { name: 'medium_sugar_max', type: 'number' },
    { name: 'medium_tea_min', type: 'number' }, { name: 'medium_tea_max', type: 'number' },
    { name: 'heavy_sugar_min', type: 'number' }, { name: 'heavy_sugar_max', type: 'number' },
    { name: 'heavy_tea_min', type: 'number' }, { name: 'heavy_tea_max', type: 'number' },
    { name: 'photo', type: 'file', maxSelect: 1, maxSize: 5242880 },
  ],
};

var CUSTOM_SYSTEMS_FIELDS = [
  { name: 'key', type: 'text', required: true },
  { name: 'label', type: 'text', required: true },
  { name: 'shape', type: 'select', values: ['range3tier', 'single', 'tiered_sugar'], maxSelect: 1 },
  { name: 'color', type: 'text' },
  { name: 'source_name', type: 'text' },
  { name: 'collection_name', type: 'text', required: true },
];

/* شكل حقول نموذج الإضافة/التعديل (label عربي لكل حقل) لكل شكل حسابي */
var FORM_SCHEMA = {
  range3tier: [
    { key: 'name', label: 'اسم الصنف', type: 'text', required: true },
    { key: 'pack', label: 'التعبئة', type: 'select', options: ['سائب', 'أكياس'] },
    { key: 'ref_vol', label: 'الحجم المرجعي (مل)', type: 'number', value: 500 },
    { key: 'status', label: 'حالة التوثيق', type: 'select', options: ['verified', 'estimated'],
      optionLabels: { verified: 'موثّق', estimated: 'تقديري' } },
    { key: 'grade', label: 'رمز التصنيف (اختياري)', type: 'text' },
    { key: 'nosugar_min', label: 'بدون سكر — أدنى', type: 'number' },
    { key: 'nosugar_max', label: 'بدون سكر — أعلى', type: 'number' },
    { key: 'medium_min', label: 'وسط — أدنى', type: 'number' },
    { key: 'medium_max', label: 'وسط — أعلى', type: 'number' },
    { key: 'high_min', label: 'حالي — أدنى', type: 'number' },
    { key: 'high_max', label: 'حالي — أعلى', type: 'number' },
  ],
  single: [
    { key: 'name', label: 'اسم الصنف', type: 'text', required: true },
    { key: 'code', label: 'رمز التصنيف (اختياري)', type: 'text' },
    { key: 'tea_with_sugar', label: 'شاهي مع سكر لكل لتر (جم)', type: 'number' },
    { key: 'sugar', label: 'سكر لكل لتر (جم)', type: 'number' },
    { key: 'tea_no_sugar', label: 'شاهي بدون سكر لكل لتر (جم)', type: 'number' },
    { key: 'steep', label: 'مدة التخدير (دقيقة)', type: 'number' },
  ],
  tiered_sugar: [
    { key: 'name', label: 'اسم الصنف', type: 'text', required: true },
    { key: 'steep_min', label: 'مدة الخدرة — أدنى', type: 'number' },
    { key: 'steep_max', label: 'مدة الخدرة — أعلى', type: 'number' },
    { key: 'nosugar_min', label: 'بدون سكر — أدنى', type: 'number' },
    { key: 'nosugar_max', label: 'بدون سكر — أعلى', type: 'number' },
    { key: 'light_sugar_min', label: 'خفيفة: سكر أدنى (اختياري)', type: 'number' },
    { key: 'light_sugar_max', label: 'خفيفة: سكر أعلى', type: 'number' },
    { key: 'light_tea_min', label: 'خفيفة: شاهي أدنى', type: 'number' },
    { key: 'light_tea_max', label: 'خفيفة: شاهي أعلى', type: 'number' },
    { key: 'medium_sugar_min', label: 'مناسبة: سكر أدنى', type: 'number' },
    { key: 'medium_sugar_max', label: 'مناسبة: سكر أعلى', type: 'number' },
    { key: 'medium_tea_min', label: 'مناسبة: شاهي أدنى', type: 'number' },
    { key: 'medium_tea_max', label: 'مناسبة: شاهي أعلى', type: 'number' },
    { key: 'heavy_sugar_min', label: 'ثقيلة: سكر أدنى', type: 'number' },
    { key: 'heavy_sugar_max', label: 'ثقيلة: سكر أعلى', type: 'number' },
    { key: 'heavy_tea_min', label: 'ثقيلة: شاهي أدنى', type: 'number' },
    { key: 'heavy_tea_max', label: 'ثقيلة: شاهي أعلى', type: 'number' },
  ],
};

/* أعمدة عرض الجدول (مختصرة) لكل شكل */
var TABLE_COLUMNS = {
  range3tier: [
    { key: 'name', label: 'الاسم' }, { key: 'grade', label: 'التصنيف' },
    { key: 'medium_min', label: 'وسط أدنى' }, { key: 'medium_max', label: 'وسط أعلى' }, { key: 'status', label: 'التوثيق' },
  ],
  single: [
    { key: 'name', label: 'الاسم' }, { key: 'code', label: 'التصنيف' },
    { key: 'tea_with_sugar', label: 'مع سكر' }, { key: 'sugar', label: 'سكر' }, { key: 'tea_no_sugar', label: 'بدون سكر' },
  ],
  tiered_sugar: [
    { key: 'name', label: 'الاسم' }, { key: 'nosugar_min', label: 'بدون سكر أدنى' }, { key: 'nosugar_max', label: 'بدون سكر أعلى' },
  ],
};

/* =====================================================================
   أدوات PocketBase عامة
===================================================================== */
function pbUrl(path) {
  return state.baseUrl.replace(/\/$/, '') + path;
}

function authHeaders(extra) {
  var h = { Accept: 'application/json' };

  // في وضع BFF لا نرسل PocketBase token من المتصفح.
  // الجلسة تتم عبر HttpOnly Cookie.
  if (state.mode === 'direct' && state.token) {
    h.Authorization = state.token;
  }

  return Object.assign(h, extra || {});
}

function escapeHTML(value) {
  return String(value == null ? '' : value).replace(/[&<>'"]/g, function (ch) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[ch];
  });
}

function escapeAttr(value) {
  return escapeHTML(value);
}

function safeColor(value, fallback) {
  var v = String(value || '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) || /^#[0-9a-fA-F]{3}$/.test(v)
    ? v
    : fallback;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise(function (_, reject) {
      setTimeout(function () {
        reject(new Error('انتهت مهلة الاتصال بالخادم.'));
      }, ms);
    })
  ]);
}

function handleUnauthorized(status) {
  if (status !== 401) return false;

  state.token = '';
  state.baseUrl = '';

  document.getElementById('adminApp').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';

  var err = document.getElementById('loginError');
  err.textContent = 'انتهت جلسة الإدارة. سجّل الدخول مرة أخرى.';
  err.style.display = 'block';

  return true;
}

function pbGet(path) {
  return withTimeout(
    fetch(pbUrl(path), {
      headers: authHeaders(),
      credentials: state.mode === 'bff' ? 'include' : 'omit'
    }),
    Config.REQUEST_TIMEOUT_MS
  ).then(function (r) {
    if (!r.ok) {
      if (handleUnauthorized(r.status)) {
        throw new Error('انتهت الجلسة.');
      }

      return r.json().then(function (b) {
        throw new Error(b.message || r.statusText);
      });
    }

    return r.json();
  });
}

function pbSend(path, method, body, isMultipart) {
  var opts = {
    method: method,
    headers: authHeaders(),
    credentials: state.mode === 'bff' ? 'include' : 'omit'
  };

  if (isMultipart) {
    opts.body = body;
  } else {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  return withTimeout(
    fetch(pbUrl(path), opts),
    Config.REQUEST_TIMEOUT_MS
  ).then(function (r) {
    if (!r.ok) {
      if (handleUnauthorized(r.status)) {
        throw new Error('انتهت الجلسة.');
      }

      return r.json().then(function (b) {
        throw new Error(b.message || r.statusText);
      });
    }

    return r.status === 204 ? null : r.json();
  });
}

function collectionExists(name) {
  return fetch(
    pbUrl('/api/collections/' + name),
    {
      headers: authHeaders(),
      credentials: state.mode === 'bff' ? 'include' : 'omit'
    }
  ).then(function (r) {
    return r.ok;
  });
}

function createCollection(name, fields) {
  return pbSend(
    '/api/collections',
    'POST',
    {
      name: name,
      type: 'base',
      fields: fields
    }
  );
}

function slugify(text) {
  // أسماء الكولكشنز بـPocketBase لازم تكون إنجليزية/أرقام/شرطة سفلية فقط
  // (تُستخدم كاسم جدول فعلي).
  // العربي يُترجم صوتياً بشكل تقريبي، وأي حرف غير مدعوم يُحذف.
  // الاسم المعروض بالواجهة يبقى عربياً كامل (label).

  var map = {
    'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'aa', 'ب': 'b',
    'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
    'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z', 'س': 's',
    'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z',
    'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k',
    'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w',
    'ي': 'y', 'ى': 'a', 'ة': 'a', 'ء': 'a'
  };

  var out = '';

  for (var i = 0; i < text.length; i++) {
    out += map[text[i]] || text[i];
  }

  out = out
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 24);

  return out || 'sys';
}

/* =====================================================================
   إعداد واجهة تسجيل الدخول
===================================================================== */

// في وضع BFF:
// - نضع عنوان Worker تلقائياً.
// - نعطّل الحقل حتى لا يستطيع المستخدم توجيه لوحة الإدارة
//   إلى PocketBase أو خادم آخر.
// - في وضع direct فقط يُسمح بإدخال العنوان يدوياً.
(function configureLoginEndpoint() {
  var input = document.getElementById('pbUrlInput');

  if (!input) return;

  if (Config.MODE === 'bff') {
    input.value = Config.BFF_DEFAULT_URL;
    input.disabled = true;
    input.setAttribute('readonly', 'readonly');
    input.setAttribute('aria-readonly', 'true');
    input.title = 'يتم استخدام خادم BFF الآمن تلقائياً.';
  }
})();

/* =====================================================================
   تسجيل الدخول
===================================================================== */
function tryAuth(baseUrl, email, password) {
  if (Config.MODE === 'bff') {
    return withTimeout(
      fetch(
        Config.BFF_DEFAULT_URL.replace(/\/$/, '') + '/auth',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            identity: email,
            password: password
          })
        }
      ),
      Config.REQUEST_TIMEOUT_MS
    ).then(function (r) {
      return r.json().catch(function () {
        return {};
      }).then(function (d) {
        if (!r.ok) {
          throw new Error(d.message || 'فشل تسجيل الدخول.');
        }

        return true;
      });
    });
  }

  // وضع direct موجود فقط للتوافق المؤقت.
  // لن يتم الوصول إليه طالما Config.MODE = 'bff'.
  var endpoints = [
    '/api/collections/_superusers/auth-with-password',
    '/api/admins/auth-with-password'
  ];

  function attempt(i) {
    if (i >= endpoints.length) {
      return Promise.reject(
        new Error(
          'فشل تسجيل الدخول من كلا المسارين — تأكد من الإيميل/كلمة المرور.'
        )
      );
    }

    return withTimeout(
      fetch(
        baseUrl.replace(/\/$/, '') + endpoints[i],
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            identity: email,
            password: password
          })
        }
      ),
      Config.REQUEST_TIMEOUT_MS
    ).then(function (r) {
      if (!r.ok) {
        return attempt(i + 1);
      }

      return r.json().then(function (d) {
        return d.token;
      });
    }).catch(function () {
      return attempt(i + 1);
    });
  }

  return attempt(0);
}

document.getElementById('loginBtn').addEventListener('click', function () {
  var email = document.getElementById('loginEmail').value.trim();
  var password = document.getElementById('loginPassword').value;
  var errEl = document.getElementById('loginError');

  errEl.style.display = 'none';

  // BFF: العنوان ثابت ولا يُؤخذ من إدخال المستخدم.
  var baseUrl = Config.MODE === 'bff'
    ? Config.BFF_DEFAULT_URL
    : document.getElementById('pbUrlInput').value.trim();

  if (!email || !password || !baseUrl) {
    errEl.textContent = 'عبّي كل الحقول أولاً.';
    errEl.style.display = 'block';
    return;
  }

  this.disabled = true;
  this.textContent = 'جاري الدخول...';

  var btn = this;

  tryAuth(baseUrl, email, password)
    .then(function (token) {
      state.baseUrl = baseUrl;
      state.mode = Config.MODE;

      // في BFF لا يتم الاحتفاظ بأي PocketBase token.
      state.token = Config.MODE === 'direct' ? token : '';

      boot();
    })
    .catch(function (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    })
    .finally(function () {
      btn.disabled = false;
      btn.textContent = 'دخول';
    });
});

document.getElementById('logoutBtn').addEventListener('click', function () {
  if (state.mode === 'bff' && state.baseUrl) {
    fetch(
      pbUrl('/logout'),
      {
        method: 'POST',
        credentials: 'include'
      }
    ).finally(function () {
      location.reload();
    });
  } else {
    location.reload();
  }
});

/* =====================================================================
   الإقلاع — يحاول يستخدم جلسة محفوظة أولاً
===================================================================== */
function boot() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminApp').style.display = 'block';

  loadSystems();
}

/*
  لا نعيد استخدام جلسة الإدارة من storage.
  توكن PocketBase لا يتم تخزينه في localStorage أو sessionStorage.
  في وضع BFF تعتمد الجلسة على HttpOnly Cookie فقط.
*/


/* =====================================================================
   تحميل قائمة الأنظمة (الثابتة + المخصصة) وبناء الشريط الجانبي
===================================================================== */
function loadSystems() {
  state.systems = BUILTIN_SYSTEMS.slice();

  pbGet('/api/collections/custom_systems/records?perPage=200')
    .then(function (data) {
      (data.items || []).forEach(function (row) {
        state.systems.push({
          key: 'custom-' + row.key,
          label: row.label,
          shape: row.shape,
          color: row.color || '#4E8A7A',
          sourceName: row.source_name,
          collectionName: row.collection_name,
          builtin: false,
        });
      });
    })
    .catch(function () {
      // لا يوجد كولكشن custom_systems بعد — عادي.
    })
    .finally(function () {
      renderSidebar();

      if (!state.currentSystem && state.systems.length) {
        selectSystem(state.systems[0]);
      }
    });
}

function renderSidebar() {
  var nav = document.getElementById('systemsNav');
  nav.replaceChildren();

  state.systems.forEach(function (s) {
    var btn = document.createElement('button');

    btn.type = 'button';
    btn.className = 'sidebar-link';

    var active =
      state.currentView === 'teas' &&
      state.currentSystem &&
      state.currentSystem.key === s.key;

    if (active) {
      btn.classList.add('active');
    }

    var swatch = document.createElement('span');

    swatch.className = 'swatch';
    swatch.style.backgroundColor =
      safeColor(s.color, '#4E8A7A');

    btn.appendChild(swatch);
    btn.appendChild(
      document.createTextNode(
        String(s.label || 'نظام بدون اسم')
      )
    );

    btn.addEventListener('click', function () {
      selectSystem(s);
    });

    nav.appendChild(btn);
  });

  [].forEach.call(
    document.querySelectorAll('.sidebar-link[data-view]'),
    function (btn) {
      btn.classList.toggle(
        'active',
        state.currentView === btn.dataset.view
      );
    }
  );
}

function selectSystem(sys) {
  state.currentSystem = sys;
  state.currentView = 'teas';

  document.getElementById('viewTeas').style.display = 'block';
  document.getElementById('viewGrades').style.display = 'none';

  document.getElementById('teasTitle').textContent =
    'أصناف: ' + sys.label;

  renderSidebar();
  loadTeasTable();
}

document
  .querySelector('.sidebar-link[data-view="grades"]')
  .addEventListener('click', function () {
    state.currentView = 'grades';

    document.getElementById('viewTeas').style.display = 'none';
    document.getElementById('viewGrades').style.display = 'block';

    renderSidebar();
    loadGradesTable();
  });


/* =====================================================================
   جدول الأصناف
===================================================================== */
var allTeasCache = [];

function loadTeasTable() {
  var statusEl = document.getElementById('teasStatus');

  statusEl.textContent = 'جاري التحميل...';
  statusEl.className = 'admin-status';

  pbGet(
    '/api/collections/' +
    state.currentSystem.collectionName +
    '/records?perPage=500'
  )
    .then(function (data) {
      allTeasCache = data.items || [];

      statusEl.textContent =
        allTeasCache.length + ' صنفاً.';

      renderTeasTable(allTeasCache);
    })
    .catch(function (err) {
      statusEl.textContent =
        'خطأ: ' + err.message;

      statusEl.className =
        'admin-status error';

      renderTeasTable([]);
    });
}

function renderTeasTable(rows) {
  var shape = state.currentSystem.shape;
  var cols = TABLE_COLUMNS[shape];

  document.getElementById('teasTableHead').innerHTML =
    '<th></th>' +
    cols.map(function (c) {
      return '<th>' +
        escapeHTML(c.label) +
        '</th>';
    }).join('') +
    '<th></th>';

  document.getElementById('teasTableBody').innerHTML =
    rows.map(function (r) {
      var collection =
        encodeURIComponent(
          state.currentSystem.collectionName
        );

      var photo = r.photo
        ? '<img class="thumb" alt="" src="' +
          escapeAttr(
            pbUrl(
              '/api/files/' +
              collection +
              '/' +
              encodeURIComponent(r.id) +
              '/' +
              encodeURIComponent(r.photo)
            )
          ) +
          '">'
        : '<span class="thumb" style="display:inline-flex;align-items:center;justify-content:center;background:' +
          escapeAttr(
            safeColor(
              state.currentSystem.color,
              '#4E8A7A'
            )
          ) +
          '22;border-radius:8px;color:' +
          escapeAttr(
            safeColor(
              state.currentSystem.color,
              '#4E8A7A'
            )
          ) +
          ';font-size:11px">' +
          escapeHTML(
            (r.name || '').slice(0, 2)
          ) +
          '</span>';

      var cells = cols.map(function (c) {
        var v = r[c.key];

        if (c.key === 'status') {
          v =
            v === 'estimated'
              ? 'تقديري'
              : (
                v === 'verified'
                  ? 'موثّق'
                  : (v || '')
              );
        }

        return '<td>' +
          escapeHTML(
            v == null ? '' : v
          ) +
          '</td>';
      }).join('');

      return '<tr>' +
        '<td>' + photo + '</td>' +
        cells +
        '<td class="row-actions">' +
        '<button type="button" data-edit="' +
        escapeAttr(r.id) +
        '">تعديل</button>' +
        '<button type="button" data-del="' +
        escapeAttr(r.id) +
        '" class="danger">حذف</button>' +
        '</td>' +
        '</tr>';
    }).join('') ||
    '<tr><td colspan="9" style="color:var(--muted);text-align:center;padding:24px">ما فيه أصناف بعد.</td></tr>';

  [].forEach.call(
    document.querySelectorAll('[data-edit]'),
    function (btn) {
      btn.addEventListener('click', function () {
        openTeaModal(
          allTeasCache.find(function (r) {
            return r.id === btn.dataset.edit;
          })
        );
      });
    }
  );

  [].forEach.call(
    document.querySelectorAll('[data-del]'),
    function (btn) {
      btn.addEventListener('click', function () {
        deleteTea(btn.dataset.del);
      });
    }
  );
}

document
  .getElementById('teasSearch')
  .addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();

    var filtered = q
      ? allTeasCache.filter(function (r) {
          return (r.name || '')
            .toLowerCase()
            .includes(q);
        })
      : allTeasCache;

    renderTeasTable(filtered);
  });

function deleteTea(id) {
  if (!confirm('متأكد تبي تحذف هذا الصنف؟ الإجراء لا يُرجع.')) {
    return;
  }

  pbSend(
    '/api/collections/' +
    state.currentSystem.collectionName +
    '/records/' +
    id,
    'DELETE'
  )
    .then(function () {
      loadTeasTable();
    })
    .catch(function (err) {
      alert('تعذّر الحذف: ' + err.message);
    });
}


/* =====================================================================
   نافذة إضافة/تعديل صنف
===================================================================== */
var teaModal = document.getElementById('teaModal');

function openTeaModal(record) {
  state.editingRecordId =
    record ? record.id : null;

  document.getElementById('teaModalTitle').textContent =
    record ? 'تعديل صنف' : 'إضافة صنف جديد';

  var schema =
    FORM_SCHEMA[state.currentSystem.shape];

  var form =
    document.getElementById('teaForm');

  form.innerHTML =
    schema.map(function (f) {
      var val = record
        ? (
          record[f.key] != null
            ? record[f.key]
            : ''
        )
        : (
          f.value != null
            ? f.value
            : ''
        );

      if (f.type === 'select') {
        var opts = f.options.map(function (o) {
          var lbl =
            f.optionLabels
              ? f.optionLabels[o]
              : o;

          return '<option value="' +
            escapeAttr(o) +
            '"' +
            (
              val === o
                ? ' selected'
                : ''
            ) +
            '>' +
            escapeHTML(lbl) +
            '</option>';
        }).join('');

        return '<div class="field">' +
          '<label>' +
          escapeHTML(f.label) +
          '</label>' +
          '<select name="' +
          escapeAttr(f.key) +
          '">' +
          opts +
          '</select>' +
          '</div>';
      }

      return '<div class="field">' +
        '<label>' +
        escapeHTML(f.label) +
        (
          f.required
            ? ' *'
            : ''
        ) +
        '</label>' +
        '<input type="' +
        escapeAttr(f.type) +
        '" name="' +
        escapeAttr(f.key) +
        '" value="' +
        escapeAttr(val) +
        '"' +
        (
          f.required
            ? ' required'
            : ''
        ) +
        '>' +
        '</div>';
    }).join('') +

    '<div class="field">' +
    '<label>الصورة (اختياري)</label>' +
    '<input type="file" name="photo" accept="image/*">' +
    (
      record && record.photo
        ? '<img class="field-photo-preview" alt="" src="' +
          escapeAttr(
            pbUrl(
              '/api/files/' +
              encodeURIComponent(
                state.currentSystem.collectionName
              ) +
              '/' +
              encodeURIComponent(record.id) +
              '/' +
              encodeURIComponent(record.photo)
            )
          ) +
          '">'
        : ''
    ) +
    '</div>';

  teaModal.style.display = 'flex';
}

document
  .getElementById('addTeaBtn')
  .addEventListener('click', function () {
    openTeaModal(null);
  });

document
  .getElementById('teaForm')
  .addEventListener('submit', function (e) {
    e.preventDefault();

    var shape =
      state.currentSystem.shape;

    var schema =
      FORM_SCHEMA[shape];

    var fd =
      new FormData(e.target);

    var payload =
      new FormData();

    schema.forEach(function (f) {
      var v = fd.get(f.key);

      payload.append(
        f.key,
        v == null ? '' : v
      );
    });

    if (!state.editingRecordId) {
      payload.append(
        'tea_id',
        slugify(state.currentSystem.key)
          .toUpperCase() +
        '-' +
        Date.now()
          .toString(36)
          .toUpperCase()
      );
    }

    var photoFile =
      fd.get('photo');

    if (
      photoFile &&
      photoFile.size > 0
    ) {
      payload.append(
        'photo',
        photoFile
      );
    }

    var saveBtn =
      document.getElementById(
        'teaSaveBtn'
      );

    saveBtn.disabled = true;
    saveBtn.textContent =
      'جاري الحفظ...';

    var url =
      '/api/collections/' +
      state.currentSystem.collectionName +
      '/records' +
      (
        state.editingRecordId
          ? '/' +
            state.editingRecordId
          : ''
      );

    pbSend(
      url,
      state.editingRecordId
        ? 'PATCH'
        : 'POST',
      payload,
      true
    )
      .then(function () {
        closeModals();
        loadTeasTable();
      })
      .catch(function (err) {
        alert(
          'تعذّر الحفظ: ' +
          err.message
        );
      })
      .finally(function () {
        saveBtn.disabled = false;
        saveBtn.textContent =
          'حفظ';
      });
  });


/* =====================================================================
   نافذة نظام جديد
===================================================================== */
var systemModal =
  document.getElementById(
    'systemModal'
  );

document
  .getElementById('newSystemBtn')
  .addEventListener('click', function () {
    document
      .getElementById('systemForm')
      .reset();

    systemModal.style.display =
      'flex';
  });

document
  .getElementById('systemForm')
  .addEventListener('submit', function (e) {
    e.preventDefault();

    var label =
      document
        .getElementById('sysLabel')
        .value
        .trim();

    var sourceName =
      document
        .getElementById('sysSourceName')
        .value
        .trim();

    var shape =
      document
        .getElementById('sysShape')
        .value;

    var color =
      document
        .getElementById('sysColor')
        .value;

    if (!label) return;

    var key =
      slugify(label) +
      '_' +
      Date.now().toString(36);

    var collectionName =
      key + '_teas';

    var submitBtn =
      e.target
        .closest('.modal-card')
        .querySelector('[type=submit]');

    submitBtn.disabled = true;
    submitBtn.textContent =
      'جاري الإنشاء...';

    ensureCustomSystemsCollection()
      .then(function () {
        return createCollection(
          collectionName,
          SHAPE_FIELDS[shape]
        );
      })
      .then(function () {
        return pbSend(
          '/api/collections/custom_systems/records',
          'POST',
          {
            key: key,
            label: label,
            shape: shape,
            color: color,
            source_name: sourceName,
            collection_name: collectionName,
          }
        );
      })
      .then(function () {
        closeModals();
        loadSystems();
      })
      .catch(function (err) {
        alert(
          'تعذّر إنشاء النظام: ' +
          err.message
        );
      })
      .finally(function () {
        submitBtn.disabled = false;
        submitBtn.textContent =
          'إنشاء النظام';
      });
  });

function ensureCustomSystemsCollection() {
  return collectionExists(
    'custom_systems'
  ).then(function (exists) {
    if (exists) return null;

    return createCollection(
      'custom_systems',
      CUSTOM_SYSTEMS_FIELDS
    );
  });
}


/* =====================================================================
   الدرجات (grades)
===================================================================== */
var allGradesCache = [];

function loadGradesTable() {
  var statusEl =
    document.getElementById(
      'gradesStatus'
    );

  statusEl.textContent =
    'جاري التحميل...';

  pbGet(
    '/api/collections/tea_grades/records?perPage=200'
  )
    .then(function (data) {
      allGradesCache =
        data.items || [];

      statusEl.textContent =
        allGradesCache.length +
        ' درجة.';

      document.getElementById(
        'gradesTableBody'
      ).innerHTML =
        allGradesCache.map(function (r) {
          return '<tr>' +
            '<td>' +
            escapeHTML(r.code) +
            '</td>' +
            '<td>' +
            escapeHTML(r.full || '') +
            '</td>' +
            '<td>' +
            (
              r.verified
                ? 'نعم'
                : 'لا'
            ) +
            '</td>' +
            '<td class="row-actions">' +
            '<button type="button" data-gedit="' +
            escapeAttr(r.id) +
            '">تعديل</button>' +
            '<button type="button" data-gdel="' +
            escapeAttr(r.id) +
            '" class="danger">حذف</button>' +
            '</td>' +
            '</tr>';
        }).join('') ||
        '<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:24px">لا توجد درجات بعد.</td></tr>';

      [].forEach.call(
        document.querySelectorAll(
          '[data-gedit]'
        ),
        function (btn) {
          btn.addEventListener(
            'click',
            function () {
              openGradeModal(
                allGradesCache.find(
                  function (r) {
                    return r.id ===
                      btn.dataset.gedit;
                  }
                )
              );
            }
          );
        }
      );

      [].forEach.call(
        document.querySelectorAll(
          '[data-gdel]'
        ),
        function (btn) {
          btn.addEventListener(
            'click',
            function () {
              if (
                !confirm(
                  'حذف هذي الدرجة؟'
                )
              ) {
                return;
              }

              pbSend(
                '/api/collections/tea_grades/records/' +
                btn.dataset.gdel,
                'DELETE'
              ).then(
                loadGradesTable
              );
            }
          );
        }
      );
    })
    .catch(function (err) {
      statusEl.textContent =
        'خطأ: ' + err.message;

      statusEl.className =
        'admin-status error';
    });
}

var gradeModal =
  document.getElementById(
    'gradeModal'
  );

var gradeFieldMap = {
  gCode: 'code',
  gFull: 'full',
  gCat: 'cat',
  gSize: 'size',
  gSpeed: 'speed',
  gColor: 'color',
  gBitter: 'bitter',
  gUse: 'use',
  gBrew: 'brew',
  gDesc: 'desc',
  gExamples: 'examples'
};

function openGradeModal(record) {
  state.gradesEditingId =
    record ? record.id : null;

  document.getElementById(
    'gradeModalTitle'
  ).textContent =
    record
      ? 'تعديل درجة'
      : 'إضافة درجة';

  Object.keys(
    gradeFieldMap
  ).forEach(function (elId) {
    document.getElementById(
      elId
    ).value =
      record
        ? (
          record[
            gradeFieldMap[elId]
          ] || ''
        )
        : '';
  });

  document.getElementById(
    'gVerified'
  ).checked =
    record
      ? !!record.verified
      : false;

  gradeModal.style.display =
    'flex';
}

document
  .getElementById('addGradeBtn')
  .addEventListener(
    'click',
    function () {
      openGradeModal(null);
    }
  );

document
  .getElementById('gradeForm')
  .addEventListener(
    'submit',
    function (e) {
      e.preventDefault();

      var payload = {
        verified:
          document.getElementById(
            'gVerified'
          ).checked
      };

      Object.keys(
        gradeFieldMap
      ).forEach(function (elId) {
        payload[
          gradeFieldMap[elId]
        ] =
          document.getElementById(
            elId
          ).value;
      });

      var url =
        '/api/collections/tea_grades/records' +
        (
          state.gradesEditingId
            ? '/' +
              state.gradesEditingId
            : ''
        );

      pbSend(
        url,
        state.gradesEditingId
          ? 'PATCH'
          : 'POST',
        payload
      )
        .then(function () {
          closeModals();
          loadGradesTable();
        })
        .catch(function (err) {
          alert(
            'تعذّر الحفظ: ' +
            err.message
          );
        });
    }
  );


/* =====================================================================
   إغلاق النوافذ المنبثقة
===================================================================== */
function closeModals() {
  [].forEach.call(
    document.querySelectorAll(
      '.modal-overlay'
    ),
    function (m) {
      m.style.display = 'none';
    }
  );
}

[].forEach.call(
  document.querySelectorAll(
    '[data-close]'
  ),
  function (btn) {
    btn.addEventListener(
      'click',
      closeModals
    );
  }
);

[].forEach.call(
  document.querySelectorAll(
    '.modal-overlay'
  ),
  function (m) {
    m.addEventListener(
      'click',
      function (e) {
        if (e.target === m) {
          closeModals();
        }
      }
    );
  }
);