/* =====================================================================
   محمّل بيانات ديناميكي — يقرأ من PocketBase مباشرة عند كل زيارة.
   لو تعذّر الوصول (النفق مقفول، السيرفر واقف...) يرجع تلقائياً لملف
   site_data.js الثابت المرفق، فالموقع ما يتوقف أبداً.
===================================================================== */
(function () {
  'use strict';

  // غيّر هذا الرابط لو انتقلت لدومين ثابت لاحقاً بدل ngrok المجاني
  // (روابط ngrok المجانية مؤقتة وتتغيّر كل ما تعيد تشغيل النفق).
  var POCKETBASE_BASE_URL = 'https://armful-gumming-germless.ngrok-free.dev';
  var FETCH_TIMEOUT_MS = 6000;

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) { setTimeout(function () { reject(new Error('timeout')); }, ms); }),
    ]);
  }

  function fetchAll(collection) {
    var all = [];
    function page(p) {
      var url = POCKETBASE_BASE_URL + '/api/collections/' + collection + '/records?page=' + p + '&perPage=200';
      return withTimeout(fetch(url, { headers: { 'ngrok-skip-browser-warning': '1' } }), FETCH_TIMEOUT_MS)
        .then(function (res) {
          if (!res.ok) throw new Error('PocketBase HTTP ' + res.status + ' على ' + collection);
          return res.json();
        })
        .then(function (data) {
          all = all.concat(data.items || []);
          if (data.page < data.totalPages) return page(p + 1);
          return all;
        });
    }
    return page(1);
  }

  function fileUrl(collection, record, filename) {
    if (!filename) return null;
    return POCKETBASE_BASE_URL + '/api/files/' + collection + '/' + record.id + '/' + filename;
  }

  function baseKey(name) {
    var n = name.replace(/\b(FBOP1|FBOP|BOP1|BOP|OP1|OPA|OP|Pekoe|PEKOE|Super OPA|CTC|DARJEELING|Assam|assam)\b/gi, '');
    n = n.replace(/شاي|العلبة|علبة|\(|\)|«|»/g, ' ');
    n = n.replace(/\s+/g, ' ').trim();
    return n;
  }

  function buildMatches(moka, teapotA, teapotB) {
    var systems = { moka: moka.map(function (i) { return i.name; }),
                     teapotA: teapotA.map(function (i) { return i.name; }),
                     teapotB: teapotB.map(function (i) { return i.name; }) };
    var index = {};
    Object.keys(systems).forEach(function (sys) {
      systems[sys].forEach(function (n) {
        var k = baseKey(n);
        if (!k) return;
        if (!index[k]) index[k] = { moka: [], teapotA: [], teapotB: [] };
        index[k][sys].push(n);
      });
    });
    var matches = {};
    Object.keys(index).forEach(function (k) {
      var v = index[k];
      var total = Object.keys(v).filter(function (s) { return v[s].length; }).length;
      if (total < 2) return;
      Object.keys(v).forEach(function (sys) {
        v[sys].forEach(function (n) {
          var others = [];
          Object.keys(v).forEach(function (otherSys) {
            if (otherSys === sys) return;
            v[otherSys].forEach(function (on) { others.push({ system: otherSys, name: on }); });
          });
          if (others.length) matches[sys + '::' + n] = others;
        });
      });
    });
    return matches;
  }

  function normalizeCustomItem(shape, r, collectionName) {
    var photoUrl = fileUrl(collectionName, r, r.photo);
    if (shape === 'range3tier') {
      return { id: r.tea_id, name: r.name, pack: r.pack, refVol: r.ref_vol, status: r.status,
               grade: r.grade || '', nosugar: [r.nosugar_min, r.nosugar_max],
               medium: [r.medium_min, r.medium_max], high: [r.high_min, r.high_max], photoUrl: photoUrl };
    }
    if (shape === 'single') {
      return { id: r.tea_id, name: r.name, code: r.code, teaWithSugar: r.tea_with_sugar,
               sugar: r.sugar, teaNoSugar: r.tea_no_sugar, steep: r.steep, photoUrl: photoUrl };
    }
    if (shape === 'tiered_sugar') {
      function tier(prefix) {
        if (r[prefix + '_sugar_min'] == null) return null;
        return [r[prefix + '_sugar_min'], r[prefix + '_sugar_max'], r[prefix + '_tea_min'], r[prefix + '_tea_max']];
      }
      return { id: r.tea_id, name: r.name, steep: [r.steep_min, r.steep_max], nosugar: [r.nosugar_min, r.nosugar_max],
               light: tier('light'), medium: tier('medium'), heavy: tier('heavy'), photoUrl: photoUrl };
    }
    return r;
  }

  function loadCustomSystems() {
    return fetchAll('custom_systems')
      .catch(function () { return []; }) // كولكشن غير موجود = ولا نظام مخصص بعد، مو خطأ
      .then(function (systemRows) {
        if (!systemRows.length) return [];
        return Promise.all(systemRows.map(function (sysRow) {
          return fetchAll(sysRow.collection_name)
            .catch(function () { return []; })
            .then(function (records) {
              return {
                key: sysRow.key, label: sysRow.label, shape: sysRow.shape,
                color: sysRow.color || '#8A9B6E', sourceName: sysRow.source_name || '',
                collectionName: sysRow.collection_name,
                items: records.map(function (r) { return normalizeCustomItem(sysRow.shape, r, sysRow.collection_name); }),
              };
            });
        }));
      });
  }

  function loadFromPocketBase() {
    return Promise.all([
      fetchAll('moka_teas'), fetchAll('teapotA_teas'), fetchAll('teapotB_teas'), fetchAll('tea_grades'), loadCustomSystems(),
    ]).then(function (results) {
      var mokaRows = results[0], aRows = results[1], bRows = results[2], gradeRows = results[3], customSystems = results[4];

      var moka = mokaRows.map(function (r) {
        return {
          id: r.tea_id, name: r.name, pack: r.pack, refVol: r.ref_vol, status: r.status,
          grade: r.grade || '', nosugar: [r.nosugar_min, r.nosugar_max],
          medium: [r.medium_min, r.medium_max], high: [r.high_min, r.high_max],
          photoUrl: fileUrl('moka_teas', r, r.photo),
        };
      });
      var teapotA = aRows.map(function (r) {
        return {
          id: r.tea_id, name: r.name, code: r.code, teaWithSugar: r.tea_with_sugar,
          sugar: r.sugar, teaNoSugar: r.tea_no_sugar, steep: r.steep,
          photoUrl: fileUrl('teapotA_teas', r, r.photo),
        };
      });
      var teapotB = bRows.map(function (r) {
        function tier(prefix) {
          if (r[prefix + '_sugar_min'] == null) return null;
          return [r[prefix + '_sugar_min'], r[prefix + '_sugar_max'], r[prefix + '_tea_min'], r[prefix + '_tea_max']];
        }
        return {
          id: r.tea_id, name: r.name, steep: [r.steep_min, r.steep_max],
          nosugar: [r.nosugar_min, r.nosugar_max],
          light: tier('light'), medium: tier('medium'), heavy: tier('heavy'),
          photoUrl: fileUrl('teapotB_teas', r, r.photo),
        };
      });
      var grades = gradeRows.map(function (r) {
        return { code: r.code, full: r.full, cat: r.cat, size: r.size, speed: r.speed, color: r.color,
                 bitter: r.bitter, use: r.use, brew: r.brew, verified: !!r.verified, desc: r.desc, examples: r.examples };
      });

      if (!moka.length && !teapotA.length && !teapotB.length) throw new Error('PocketBase رجع بدون بيانات');

      return { moka: moka, teapotA: teapotA, teapotB: teapotB, grades: grades, customSystems: customSystems,
               matches: buildMatches(moka, teapotA, teapotB), source: 'pocketbase' };
    });
  }

  function loadStaticFallback() {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'site_data.js';
      s.onload = function () {
        if (window.TEA_DATA) { window.TEA_DATA.source = 'static'; resolve(window.TEA_DATA); }
        else reject(new Error('site_data.js ما حمّل TEA_DATA'));
      };
      s.onerror = function () { reject(new Error('تعذّر تحميل site_data.js الاحتياطي')); };
      document.head.appendChild(s);
    });
  }

  function bootApp() {
    var s = document.createElement('script');
    s.src = 'app.js';
    document.body.appendChild(s);
  }

  function showBanner(text, isError) {
    var el = document.getElementById('data-source-banner');
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
    el.className = isError ? 'data-banner data-banner-error' : 'data-banner data-banner-live';
  }

  loadFromPocketBase()
    .then(function (data) {
      window.TEA_DATA = data;
      showBanner('🟢 متصل مباشرة بقاعدة بيانات PocketBase — أي تحديث هناك ينعكس هنا فوراً.', false);
      bootApp();
    })
    .catch(function (err) {
      console.warn('تعذّر الاتصال بـ PocketBase، رجعنا للنسخة الثابتة:', err.message);
      loadStaticFallback()
        .then(function () {
          showBanner('🟡 تعذّر الاتصال بقاعدة البيانات الحية — يعرض الموقع نسخة محفوظة محلياً.', true);
          bootApp();
        })
        .catch(function (fallbackErr) {
          document.getElementById('calc').innerHTML =
            '<p style="color:#C1572E">تعذّر تحميل بيانات الشاهي من أي مصدر. أعد تحميل الصفحة أو تأكد من الاتصال.</p>';
          console.error(fallbackErr);
        });
    });
})();
