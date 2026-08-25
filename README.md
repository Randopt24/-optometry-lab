# Optometry Interactive Lab

موقع تعليمي تفاعلي ثلاثي الأبعاد لورشة بصريات (Optometry). React + Three.js
(عبر React Three Fiber) + React Router. لا يعتمد على أي خدمة أو API مدفوع.

## البنية

```
optometry-lab/
  index.html
  package.json
  vite.config.js
  src/
    main.jsx              # نقطة الدخول
    App.jsx                # التوجيه العام + شاشة التحميل
    styles/globals.css      # نظام التصميم (ألوان، خطوط، مكوّنات مشتركة)
    data/
      workshopSkills.js     # بيانات محاور الورشة الثلاثة
      cases.js               # حالات المرضى الافتراضية (4 حالات)
    components/
      Navbar.jsx / Footer.jsx / LoadingScreen.jsx
      3d/
        HeroScene.jsx        # مشهد 3D لنموذج العين في الصفحة الرئيسية (R3F)
      simulation/
        SimulationContext.jsx  # حالة الحالة الحالية: النتائج المكتشفة والدرجات
        ExamPicker.jsx          # اختيار الفحص داخل حالة مريض
        AutorefractionSim.jsx   # محاكاة جهاز الأوتوريفراكتور (CSS 3D)
        SnellenSim.jsx          # محاكاة لوحة Snellen
        RetinoscopySim.jsx      # محاكاة الريتينوسكوبي
        ScoreSummary.jsx        # شاشة النتيجة والتقييم
      ui/
        SimShell.jsx           # الإطار المشترك لكل شاشة محاكاة (رجوع/الرئيسية/تعليمات)
        SkillCard.jsx
    pages/
      Home.jsx        # Hero + عرض محاور الورشة
      Workshop.jsx
      PatientSimulationPage.jsx   # التوجيه المتداخل لاختيار الحالة والفحوصات
      Cases.jsx
      About.jsx
```

## المرحلة المُنفذة الآن (Phase 1)

- Architecture كامل وقابل للتوسّع.
- الصفحة الرئيسية بمشهد 3D لنموذج عين + حلقات عدسة + جسيمات ضوء.
- قسم الورشة (Autorefraction / Snellen / Retinoscopy) بطاقات تفاعلية.
- تدفّق "اختبر المريض" الكامل: اختيار حالة → اختيار فحص → إجراء الفحص →
  سؤال تفسيري → تقييم نهائي (Score / Time / Feedback).
- محاكاة Autorefraction تفاعلية (Start → Measure → نتيجة → سؤال).
- محاكاة Snellen Chart بأحجام حروف متدرجة وتحديد آخر سطر مقروء.
- محاكاة Retinoscopy باتجاه حركة قابل للاختيار وشريط قوة عدسة وانعكاس متحرك.
- شاشة تحميل، Navbar متجاوب، Footer مع تنويه طبي.
- تصميم متجاوب بالكامل حتى على iPhone.

المرحلة التالية المقترحة: نماذج 3D أكثر واقعية للأجهزة عبر Three.js بدل CSS
3D، وربط اختياري بقاعدة بيانات لحفظ نتائج المتدربين.

## التشغيل محليًا

يتطلب Node.js 18 أو أحدث.

```bash
cd optometry-lab
npm install
npm run dev
```

الموقع سيعمل على `http://localhost:5173`.

## البناء للإنتاج

```bash
npm run build
```

الناتج سيكون في مجلد `dist/`. يمكن معاينته محليًا عبر:

```bash
npm run preview
```

## النشر (استضافة مجانية)

### Vercel
1. ادفع المشروع إلى مستودع GitHub.
2. من [vercel.com](https://vercel.com) اختر "Import Project" وحدد المستودع.
3. Framework Preset: **Vite**. أوامر البناء تُكتشف تلقائيًا
   (`npm run build`, مجلد الإخراج `dist`).

### Netlify
1. ادفع المشروع إلى GitHub.
2. من Netlify اختر "Add new site → Import an existing project".
3. Build command: `npm run build` — Publish directory: `dist`.

### GitHub Pages
1. أضف `"homepage": "https://<user>.github.io/<repo>"` في `package.json` (اختياري).
2. `npm install --save-dev gh-pages` ثم أضف إلى `package.json`:
   ```json
   "scripts": { "deploy": "vite build && gh-pages -d dist" }
   ```
3. `npm run deploy`.

## ملاحظات

- جميع نماذج الأجهزة الحالية مبنية بـ CSS 3D و React Three Fiber بدون أي
  أصول (assets) خارجية مدفوعة أو مرخّصة — لا حاجة لملفات إضافية.
- جميع البيانات (حالات المرضى، نتائج الفحوصات) موجودة في `src/data/` ويمكن
  تعديلها أو التوسّع فيها بسهولة دون لمس منطق الواجهات.
