#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
سكربت نقل بيانات "وزنة" إلى PocketBase
=========================================
شغّله من جهازك (اللي عنده اتصال فعلي برابط PocketBase) بهذا الأمر:

    pip install requests
    python3 migrate_to_pocketbase.py

يسوي تلقائياً:
  1) يسجّل دخول كأدمن (يطلب منك الإيميل وكلمة المرور وقت التشغيل — ما تُكتب بالسكربت).
  2) ينشئ 4 كولكشنز: moka_teas, teapotA_teas, teapotB_teas, tea_grades — كل وحدة فيها
     حقل صورة (photo) جاهز ترفع فيه لاحقاً من لوحة تحكم PocketBase مباشرة، أو تلقائياً
     الآن لو عندك صور محفوظة بمجلد images/ بنفس تسمية دليل_أسماء_الصور.md.
  3) يستورد كل الصفوف (68 + 153 + 36 + 18 = 275 سجل) من pocketbase_data.json.

الملف يحتاج يكون بجانبه ملف pocketbase_data.json (نفس المجلد).
"""

import json
import os
import sys
import getpass

try:
    import requests
except ImportError:
    print("لازم تثبت مكتبة requests أولاً: pip install requests")
    sys.exit(1)

# ------------------------------------------------------------------
# الإعدادات
# ------------------------------------------------------------------
BASE_URL = os.environ.get("POCKETBASE_BASE_URL", "https://armful-gumming-germless.ngrok-free.dev")
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pocketbase_data.json")
IMAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "images")
HEADERS_COMMON = {"ngrok-skip-browser-warning": "1"}  # يتجاوز صفحة تحذير ngrok المجانية

# تعريف الكولكشنز: (اسم الكولكشن -> قائمة الحقول)
# type الأرقام "number"، النصوص "text"، القوائم "select"، والمنطقي "bool"
COLLECTIONS = {
    "moka_teas": [
        {"name": "tea_id", "type": "text", "required": True},
        {"name": "name", "type": "text", "required": True},
        {"name": "pack", "type": "text"},
        {"name": "ref_vol", "type": "number"},
        {"name": "status", "type": "select", "values": ["verified", "estimated"], "maxSelect": 1},
        {"name": "grade", "type": "text"},
        {"name": "nosugar_min", "type": "number"}, {"name": "nosugar_max", "type": "number"},
        {"name": "medium_min", "type": "number"}, {"name": "medium_max", "type": "number"},
        {"name": "high_min", "type": "number"}, {"name": "high_max", "type": "number"},
        {"name": "photo", "type": "file", "maxSelect": 1, "maxSize": 5242880},
    ],
    "teapotA_teas": [
        {"name": "tea_id", "type": "text", "required": True},
        {"name": "name", "type": "text", "required": True},
        {"name": "code", "type": "text"},
        {"name": "tea_with_sugar", "type": "number"},
        {"name": "sugar", "type": "number"},
        {"name": "tea_no_sugar", "type": "number"},
        {"name": "steep", "type": "number"},
        {"name": "photo", "type": "file", "maxSelect": 1, "maxSize": 5242880},
    ],
    "teapotB_teas": [
        {"name": "tea_id", "type": "text", "required": True},
        {"name": "name", "type": "text", "required": True},
        {"name": "steep_min", "type": "number"}, {"name": "steep_max", "type": "number"},
        {"name": "nosugar_min", "type": "number"}, {"name": "nosugar_max", "type": "number"},
        {"name": "light_sugar_min", "type": "number"}, {"name": "light_sugar_max", "type": "number"},
        {"name": "light_tea_min", "type": "number"}, {"name": "light_tea_max", "type": "number"},
        {"name": "medium_sugar_min", "type": "number"}, {"name": "medium_sugar_max", "type": "number"},
        {"name": "medium_tea_min", "type": "number"}, {"name": "medium_tea_max", "type": "number"},
        {"name": "heavy_sugar_min", "type": "number"}, {"name": "heavy_sugar_max", "type": "number"},
        {"name": "heavy_tea_min", "type": "number"}, {"name": "heavy_tea_max", "type": "number"},
        {"name": "photo", "type": "file", "maxSelect": 1, "maxSize": 5242880},
    ],
    "tea_grades": [
        {"name": "code", "type": "text", "required": True},
        {"name": "full", "type": "text"}, {"name": "cat", "type": "text"}, {"name": "size", "type": "text"},
        {"name": "speed", "type": "text"}, {"name": "color", "type": "text"}, {"name": "bitter", "type": "text"},
        {"name": "use", "type": "text"}, {"name": "brew", "type": "text"},
        {"name": "verified", "type": "bool"},
        {"name": "desc", "type": "text"}, {"name": "examples", "type": "text"},
    ],
}


def admin_login():
    print(f"جاري تسجيل الدخول إلى {BASE_URL} ...")
    email = input("إيميل الأدمن (PocketBase superuser): ").strip()
    password = getpass.getpass("كلمة المرور: ")
    # PocketBase 0.23+ يستخدم _superusers، النسخ الأقدم تستخدم admins
    for endpoint in ("/api/collections/_superusers/auth-with-password", "/api/admins/auth-with-password"):
        try:
            r = requests.post(
                BASE_URL + endpoint,
                json={"identity": email, "password": password},
                headers=HEADERS_COMMON, timeout=20,
            )
            if r.status_code == 200:
                token = r.json()["token"]
                print("✅ تم تسجيل الدخول.")
                return token
        except requests.RequestException as e:
            print(f"  تعذّر الوصول عبر {endpoint}: {e}")
    print("❌ فشل تسجيل الدخول من كلا المسارين. تأكد من الإيميل/كلمة المرور ومن أن الرابط شغّال.")
    sys.exit(1)


def collection_exists(token, name):
    r = requests.get(
        f"{BASE_URL}/api/collections/{name}",
        headers={**HEADERS_COMMON, "Authorization": token}, timeout=20,
    )
    return r.status_code == 200


def create_collection(token, name, fields):
    if collection_exists(token, name):
        print(f"  الكولكشن '{name}' موجود مسبقاً — تخطّي الإنشاء.")
        return
    body = {"name": name, "type": "base", "fields": fields}
    r = requests.post(
        f"{BASE_URL}/api/collections",
        json=body, headers={**HEADERS_COMMON, "Authorization": token}, timeout=30,
    )
    if r.status_code in (200, 201):
        print(f"  ✅ تم إنشاء الكولكشن '{name}'.")
    else:
        print(f"  ❌ فشل إنشاء '{name}': {r.status_code} {r.text[:300]}")
        sys.exit(1)


def find_local_image(tea_id):
    for ext in ("jpg", "jpeg", "png", "webp"):
        path = os.path.join(IMAGES_DIR, f"{tea_id}.{ext}")
        if os.path.isfile(path):
            return path
    return None


def import_records(token, collection, rows):
    print(f"  استيراد {len(rows)} سجلاً إلى '{collection}' ...")
    ok, fail = 0, 0
    for row in rows:
        image_path = find_local_image(row.get("tea_id", ""))
        headers = {**HEADERS_COMMON, "Authorization": token}
        try:
            if image_path:
                with open(image_path, "rb") as f:
                    files = {"photo": (os.path.basename(image_path), f, "application/octet-stream")}
                    # PocketBase multipart يحتاج القيم كنصوص
                    data = {k: ("" if v is None else str(v)) for k, v in row.items()}
                    r = requests.post(f"{BASE_URL}/api/collections/{collection}/records",
                                       data=data, files=files, headers=headers, timeout=30)
            else:
                r = requests.post(f"{BASE_URL}/api/collections/{collection}/records",
                                   json=row, headers=headers, timeout=30)
            if r.status_code in (200, 201):
                ok += 1
            else:
                fail += 1
                print(f"    ⚠️ فشل سجل {row.get('tea_id')}: {r.status_code} {r.text[:200]}")
        except requests.RequestException as e:
            fail += 1
            print(f"    ⚠️ خطأ شبكة لسجل {row.get('tea_id')}: {e}")
    print(f"  تم: {ok} نجح، {fail} فشل.")


def main():
    if not os.path.isfile(DATA_FILE):
        print(f"❌ ما لقيت ملف البيانات: {DATA_FILE}")
        sys.exit(1)
    with open(DATA_FILE, encoding="utf-8") as f:
        payload = json.load(f)

    token = admin_login()

    print("\n== إنشاء الكولكشنز ==")
    for name, fields in COLLECTIONS.items():
        create_collection(token, name, fields)

    print("\n== استيراد البيانات ==")
    for name in COLLECTIONS:
        import_records(token, name, payload.get(name, []))

    print("\n🎉 خلصنا. راجع لوحة التحكم:", BASE_URL + "/_/")


if __name__ == "__main__":
    main()
