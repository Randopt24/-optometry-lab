# Optometry Lab — Virtual Clinical Simulator

A fully client-side, no-build, no-paid-API 2.5D clinical simulator for optometry
training. Built with plain HTML, CSS and JavaScript (plus inline SVG for the
patient and instruments).

## What's included (working, not mocked)

- **Exam room scene** — patient seated in an exam chair, Snellen chart on the
  wall, an autorefractor and retinoscope on the equipment cart. Everything is
  clickable.
- **Realistic patient** — SVG face with two independently rendered eyes
  (sclera, iris, pupil, catchlight, eyelids) that **blink naturally and
  randomly** the whole time the app is open.
- **Real camera movement** — selecting a device animates the camera
  (a CSS transform on the whole scene) so it zooms from the wide room shot
  into the patient's actual eye. The eye you see inside the instrument
  viewfinder is the *same* SVG eye from the wide shot, just magnified and
  centered behind a vignette/reticle overlay — not a swapped-in image.
- **Visual Acuity exam** — pick OD/OS (the other eye is physically occluded
  on the patient's face), progress line by line down a real Snellen chart
  (letters get smaller each line, exactly like a real chart). Each line's
  pass/fail is *simulated from the patient's hidden refractive error*, letter
  by letter, and the exam stops and reports a real Snellen fraction
  (e.g. `20/40-2`).
- **Autorefraction exam** — press Start and watch the camera move in, the
  instrument swing into position, the eye appear in the device screen,
  a scanning animation run, and three noisy simulated readings average into
  a final Sphere / Cylinder / Axis result pulled from the same hidden
  patient case.
- **Retinoscopy exam** — a close-up of the eye with an animated retinal
  reflex inside the pupil. Add plus/minus lenses in 0.25 D steps; the
  reflex's direction (with/against), speed and brightness all change in
  real time based on how far you are from neutrality. You have to find
  neutrality yourself — the true value is never shown until you check
  (within tolerance) or explicitly ask to reveal it.
- **New Patient** — regenerates a random hidden refractive case (sphere,
  cylinder, axis per eye) that every exam draws from, so results are always
  internally consistent.

## Run it locally

No build step, no dependencies, no server-side code.

```bash
cd optometry-lab
python3 -m http.server 8080
# then open http://localhost:8080
```

Or just double-click `index.html` (a local static server is recommended
over `file://` so relative asset loading behaves consistently across
browsers).

## Deploy to Netlify

**Option A — drag and drop**
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop).
2. Drag the whole `optometry-lab` folder onto the page.
3. Done — Netlify gives you a live URL immediately.

**Option B — Netlify CLI**
```bash
npm install -g netlify-cli
cd optometry-lab
netlify deploy --prod
```

**Option C — Git-based deploy**
1. Push this folder to a GitHub/GitLab repo.
2. In Netlify: "Add new site" → "Import an existing project" → pick the repo.
3. Build command: *(leave empty)*. Publish directory: `.`
4. Deploy.

`netlify.toml` is already included and sets the publish directory to `.`.

## File structure

```
optometry-lab/
├── index.html      # all scenes/panels + inline SVG patient & room
├── styles.css       # visual design, camera/viewfinder/reflex CSS
├── app.js           # camera math, patient case generation, exam logic
├── netlify.toml      # Netlify deploy config
└── README.md
```

## How the simulation logic works (for anyone extending it)

- Each patient case is `{ OD: {sphere, cylinder, axis}, OS: {...} }`,
  generated randomly on load and on "New Patient".
- **Spherical equivalent** `SE = sphere + cylinder/2` drives blur severity.
- **Visual acuity**: a minimum-angle-of-resolution estimate is derived from
  `SE` and cylinder magnitude, compared against each chart line's required
  resolution to probabilistically decide, letter by letter, whether the
  simulated patient reads it correctly.
- **Autorefraction**: reads `sphere/cylinder/axis` directly from the case
  with small randomized instrument noise across 3 simulated readings, then
  averages them — same as a real instrument would report repeatability.
- **Retinoscopy**: neutrality is `lensPower === SE` (within ±0.25 D). The
  reflex animation's direction, sweep speed and brightness are computed
  live from `lensPower - SE` every time you change the lens.

## Notes & scope

- This is an educational simulator, not a medical device and not a
  substitute for clinical training or real patient care.
- Retinoscopy is simplified to a single spherical-equivalent neutralization
  (no separate meridian-by-meridian streak rotation) to keep the
  interaction focused and understandable.
- No external APIs, no analytics, no paid services — everything runs
  entirely in the browser.
