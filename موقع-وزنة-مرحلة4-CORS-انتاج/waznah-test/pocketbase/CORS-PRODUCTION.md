# وزنة — CORS والإنتاج

## نتيجة الاختبار الحي الحالية

القيمة الحالية التي ظهر بها PocketBase هي:

- `Access-Control-Allow-Origin: *`
- preflight من Origin غير مصرح به يرجع `204`

هذه **ليست** إعدادات الإنتاج المطلوبة للموقع. توثيق PocketBase يذكر أن CORS الافتراضي يسمح بكل Origins ويمكن تقييده عبر `--origins`. كما تحذر وثائق CORS من استخدام wildcard مع بيانات الاعتماد. citeturn503035search0turn503035search2

## الإعداد الموصى به للموقع العام

أثناء الاختبار:

```bash
pocketbase serve --origins "https://mohammedb1997.github.io"
```

وعند ربط النطاق النهائي، استخدم النطاق النهائي فقط، مثلاً:

```bash
pocketbase serve --origins "https://waznah.example.com"
```

إذا كان لديك أكثر من Origin موثوق، مرّرها كقائمة حسب إصدار PocketBase الذي تستخدمه، ثم تحقق من الـpreflight من كل أصل على حدة.

## الإدارة

لا تعتمد على CORS كحماية للوحة الإدارة. CORS يتحكم في قدرة المتصفح على قراءة الاستجابة، لكنه لا يجعل endpoint الإداري خاصاً بحد ذاته.

البنية النهائية المقترحة:

```text
Browser
  │
  ├── Public site ───────────────> Public PocketBase API (read-only rules)
  │
  └── Admin UI ── credentials ──> Cloudflare Worker / BFF
                                  │
                                  └── PocketBase (private/restricted origin)
```

استخدم reverse proxy / firewall لجعل PocketBase الإداري غير مكشوف مباشرةً للعامة. توثيق PocketBase يدعم وضعه خلف reverse proxy عند الحاجة إلى تحكم شبكي أدق. citeturn503035search7

## اختبار القبول

يجب أن يعطي الاختبار:

```text
[1] /api/health => 200
[2] allowed origin => 204 + ACAO = https://mohammedb1997.github.io
[3] disallowed origin => لا يوجد ACAO للـevil origin
[4] public collection => 200 (إذا كانت المجموعة public)
```

أما نجاح endpoint:

```text
/api/collections/_superusers/auth-with-password
```

على العنوان العام فهو **تحذير بنيوي** وليس نجاحاً أمنياً. يجب أن يكون PocketBase نفسه خلف طبقة تمنع الوصول المباشر إلى مسارات الإدارة في الإنتاج، مع بقاء الـBFF هو المسار الذي تستخدمه لوحة الإدارة.
