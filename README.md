# YT-Qahtani

أداة بحث وتصفح وتحميل محتوى الموقع الإعلامي **mmy.ye** (مواقع الإعلام الحربي اليمني)، تتكوّن من خلفية بايثون وواجهة ويب عربية.

> ملاحظة: ملفات الفيديو المحمّلة لا تُرفع إلى GitHub — تُخزَّن محلياً في مجلدات المؤرشفة.

## البنية

```
.
├── backend/                  # الخلفية (Python / Flask)
│   ├── web.py                # خادم الويب + REST API + سير التحميل الخلفي
│   ├── runner.py             # أدوات سطر الأوامر لتحميل أرشيف الشهداء
│   ├── discover.py           # زحف الفئات والمواضيع والمصادر من الموقع
│   ├── classify.py           # تصنيف عناوين الشهداء
│   ├── common.py             # أدوات مشتركة (جلسة HTTP مهذّبة، JSON، إلخ)
│   └── static/               # واجهة HTML احتياطية (عند غياب frontend/dist)
├── frontend/                 # الواجهة الأمامية (React + TypeScript + Vite)
│   └── src/                  # المكوّنات (CategoryChips, VideoCard, WatchModal …)
├── catalog.json              # فهرس المواضيع/المصادر
├── categories.json           # التصنيفات
├── download_log.json         # سجل تحميل أرشيف الشهداء
├── library_log.json          # سجل المكتبة المحمّلة عبر الويب
└── .gitignore                # يستثني الفيديوهات من git
```

## المتطلبات

- Python 3.9+ مع `flask` و `requests`
- Node.js 20+ (للبناء الأمامي)

```
pip install flask requests
cd frontend && npm install
```

## التشغيل

### الواجهة (الخلفية)

```
cd frontend && npm run build     # بناء الواجهة → frontend/dist
python3 backend/web.py --port 8080
```

ثم افتح: http://127.0.0.1:8080

(إذا لم يوجد `frontend/dist` تُستخدَم الواجهة الاحتياطية `backend/static`.)

### أرشيف الشهداء (سطر الأوامر)

```
python3 backend/runner.py --dry-run    # عرض الخطة فقط
python3 backend/runner.py              # تحميل الملفات الناقصة (قابل للاستئناف)
python3 backend/runner.py --verify     # فحص سلامة الملفات
python3 backend/runner.py --finalize   # تحديث summary.json / README.txt
```

## المزايا

- تصفية حسب التصنيف مع بحث فوري وصفحات مصغّرة
- اختيار الجودة لكل فيديو (240p…1080p+ أو الأفضل تلقائياً)
- طابور تحميل في الخلفية مع استئناف وتقدم مباشر
- تصنيف ذاتي لعناوين الشهداء وتنظيم أرشيفها حسب الشهيد
- جلسة HTTP مهذّبة: زمن انتظار، إعادة محاولة، ودعم `Range`
- واجهة عربية RTL متجاوبة (shadcn/ui + Tailwind)

## نقاط النهاية API الرئيسية

| المسار | الوظيفة |
| --- | --- |
| `/api/meta` | التصنيفات |
| `/api/browse?cat=..&page=..&q=..` | تصفح المواضيع حسب التصنيف مع بحث |
| `/api/post/<id>` | تفاصيل الفيديو ومصادره |
| `/api/playlist` | إنشاء مهمة تحميل (طابور) |
| `/api/queue/<job_id>` | حالة المهمة (تقدم) |
| `/stream/<id>/<q>` | بث الفيديو بدعم Range |
| `/dl/<id>/<q>` | تحميل مباشر كملف مرفق |