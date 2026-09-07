# تقرير الاختبار — وزنة — 2026-09-07

## نتيجة الاختبار

### نجح
- فحص JavaScript syntax لجميع ملفات التطبيق وWorker: ناجح.
- `app.js` أصبح نقطة دخول خفيفة، والوحدات الأربع تحمل بالتسلسل.
- ملفات البيانات المحلية تحتوي: 68 موكا + 153 إبريق A + 36 إبريق B + 18 درجة = 275 سجل.
- الواجهة لديها fallback إلى `site_data.js` عند تعذر PocketBase.
- `admin.js` لا يستخدم `sessionStorage` أو `localStorage` لحفظ Superuser token.
- الطلبات في وضع BFF تستخدم `credentials: include`.
- الـWorker يفرض Origin مسموحاً على عمليات الكتابة ويضع جلسة PocketBase داخل HttpOnly cookie.

### تعذر الاختبار الحي
الـPocketBase المحدد حالياً هو:
`https://armful-gumming-germless.ngrok-free.dev`
ومن بيئة التنفيذ الحالية فشل DNS (`Could not resolve host`). لذلك لا يمكن إثبات حالة النفق/الخادم الحقيقي أو تنفيذ تسجيل دخول Superuser حقيقي دون endpoint حي قابل للوصول. هذا فشل في البنية التحتية الحالية، وليس دليلاً على فشل كود الواجهة.

## اختبارات مطلوبة عند توفر endpoint حي

1. GET للمجموعات الأربع والتحقق من `200` و`totalItems`.
2. OPTIONS للتحقق من CORS/preflight.
3. دخول BFF بحساب أدمن حقيقي والتحقق من `Set-Cookie: HttpOnly; Secure`.
4. GET/PATCH/DELETE عبر BFF والتحقق من 401 بعد تسجيل الخروج.
5. رفض Origin غير معروف بـ403.
6. اختبار إنشاء/تعديل/حذف سجل وصورة.
7. اختبار `custom_systems` وإنشاء Collection جديدة ثم ظهورها بالموقع.
8. اختبار fallback بانقطاع PocketBase والتأكد من استمرار الموقع على البيانات الثابتة.

## اختبارات Worker المحلية (تم اجتيازها)

- OPTIONS من Origin مسموح: 204 + CORS headers.
- POST بدون Origin: 403.
- POST من Origin غير مسموح: 403.
- تسجيل دخول BFF: 200 + `HttpOnly; Secure; SameSite=Strict`.
- تمرير جلسة Cookie إلى PocketBase: يتحول إلى `Authorization: Bearer ...` على الطلب الداخلي.
- `COOKIE_SAMESITE=None`: يعمل عند تفعيله للـcross-origin.

## Live tunnel retest — 2026-09-07

The provided ngrok forwarding target is:
`https://armful-gumming-germless.ngrok-free.dev -> http://localhost:8090`

An external fetch to the exact public root responded with HTTP 404, which confirms the hostname can be resolved/reached from the external web tool; the root path itself is not a PocketBase health endpoint.

Direct HTTP calls from the sandbox runtime to the same host still fail DNS resolution. Therefore the sandbox cannot perform the final authenticated PocketBase CRUD test itself.

A Windows PowerShell live test was added at `scripts/live-test.ps1`. It tests:
1. PocketBase `/api/health`
2. CORS preflight for the production origin
3. rejection of a foreign origin preflight
4. public collection read
5. optional Superuser authentication without writing the password to disk
