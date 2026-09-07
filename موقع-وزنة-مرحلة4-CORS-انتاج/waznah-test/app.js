/* =====================================================================
   وزنة — نقطة دخول التطبيق
   app.js صار Loader خفيف: الوظائف موزعة على Modules مرتبة حسب الاعتماد.
===================================================================== */
(function () {
  'use strict';
  var modules = [
    'js/core.js',
    'js/calculators.js',
    'js/dynamic-systems.js',
    'js/ui.js'
  ];

  function load(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('تعذّر تحميل وحدة: ' + src)); };
      document.body.appendChild(s);
    });
  }

  modules.reduce(function (p, src) { return p.then(function () { return load(src); }); }, Promise.resolve())
    .catch(function (err) {
      console.error('[Waznah] فشل تحميل وحدات التطبيق:', err);
      var calc = document.getElementById('calc');
      if (calc) calc.innerHTML = '<p style="color:#C1572E">تعذّر تشغيل التطبيق. أعد تحميل الصفحة.</p>';
    });
})();
