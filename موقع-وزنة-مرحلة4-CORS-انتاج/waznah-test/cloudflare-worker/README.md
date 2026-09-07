# Waznah Admin BFF

هذا Worker هو الطبقة المقترحة للإنتاج بين `admin.html` وPocketBase.

## متغيرات البيئة

- `PB_URL`: رابط PocketBase الحقيقي، ولا يوضع في Git إذا كان خاصاً.
- `ALLOWED_ORIGINS`: origins المسموح لها بلوحة الإدارة مفصولة بفواصل.
- `COOKIE_NAME`: اختياري، الافتراضي `WZ_ADMIN_SESSION`.

## المسارات

- `POST /auth` يستقبل `identity` و`password`، يصادق في PocketBase، ثم يضع توكن الجلسة في Cookie من نوع HttpOnly.
- `/api/*` يمرر الطلب إلى PocketBase بعد قراءة الجلسة من الـCookie.
- `/logout` يمسح الجلسة.
- `/health` فحص حالة بسيط.

## ملاحظة مهمة للنشر

الأفضل ربط Worker بدومين إدارة مخصص تحت نطاقك ثم وضع الأصل في `ALLOWED_ORIGINS`. لأن GitHub Pages وWorker يكونان origin مختلفين، يستخدم Worker `SameSite=None; Secure` للجلسة. سياسة المتصفح قد تمنع third-party cookies في بعض البيئات؛ لذلك ربط BFF على نفس الموقع/النطاق هو الخيار الأكثر موثوقية.
