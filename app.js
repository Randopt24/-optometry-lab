/* =========================================================================
   OPTOMETRY LAB — VIRTUAL CLINICAL SIMULATOR
   Pure client-side 2.5D simulator. No external services, no build step.
   ========================================================================= */

(function () {
  "use strict";

  /* -------------------------------------------------------------------
     0. DOM REFERENCES
  ------------------------------------------------------------------- */
  const stage = document.getElementById("stage");
  const world = document.getElementById("world");
  const camera = document.getElementById("camera");
  const viewfinder = document.getElementById("viewfinder");
  const ring = document.getElementById("ring");
  const scanLine = document.getElementById("scanLine");
  const reflexOverlay = document.getElementById("reflexOverlay");
  const reflexBar = document.getElementById("reflexBar");
  const scopeIndicator = document.getElementById("scopeIndicator");
  const autorefRigGroup = document.getElementById("autorefRigGroup");
  const statusText = document.getElementById("statusText");

  const eyeEls = { OD: document.getElementById("eye-OD"), OS: document.getElementById("eye-OS") };

  const panels = {
    room: document.getElementById("panel-room"),
    acuity: document.getElementById("panel-acuity"),
    autorefraction: document.getElementById("panel-autorefraction"),
    retinoscopy: document.getElementById("panel-retinoscopy"),
  };

  /* -------------------------------------------------------------------
     1. WORLD / CAMERA GEOMETRY
     The world is authored in a fixed 1200x700 design space. worldScale
     converts design pixels -> real screen pixels so we can size overlay
     elements (like the retinoscopy reflex) to line up exactly with the
     zoomed patient eye, regardless of window size.
  ------------------------------------------------------------------- */
  const WORLD_W = 1200, WORLD_H = 700;
  let worldScale = 1;

  function fitWorld() {
    const rect = stage.getBoundingClientRect();
    worldScale = rect.width / WORLD_W;
    world.style.transform = `scale(${worldScale})`;
    world.style.width = WORLD_W + "px";
    world.style.height = WORLD_H + "px";
    // vertically center if stage is taller than scaled world
    const scaledH = WORLD_H * worldScale;
    const offsetY = Math.max(0, (rect.height - scaledH) / 2);
    world.style.top = offsetY + "px";
  }
  window.addEventListener("resize", fitWorld);

  // Eye centers in world-design coordinates (patient SVG is placed at x=580,y=60 w=420 h=480,
  // viewBox 0 0 420 480 -> 1:1 mapping, so world coords = 580+localX, 60+localY)
  const EYE_WORLD = {
    OD: { x: 580 + 150, y: 60 + 196 }, // 730, 256
    OS: { x: 580 + 270, y: 60 + 196 }, // 850, 256
  };
  const STAGE_CENTER = { x: WORLD_W / 2, y: WORLD_H / 2 }; // 600, 350
  const PUPIL_WORLD_R = 6; // matches svg .pupil radius

  let currentCameraScale = 1;

  function setCamera(scale, targetWorldPt, animate = true) {
    currentCameraScale = scale;
    camera.style.transition = animate
      ? "transform 1.1s cubic-bezier(.65,.05,.24,1)"
      : "none";
    const tx = STAGE_CENTER.x / scale - targetWorldPt.x;
    const ty = STAGE_CENTER.y / scale - targetWorldPt.y;
    camera.style.transform = `scale(${scale}) translate(${tx}px, ${ty}px)`;
  }

  function resetCamera(animate = true) {
    currentCameraScale = 1;
    camera.style.transition = animate
      ? "transform 1.1s cubic-bezier(.65,.05,.24,1)"
      : "none";
    camera.style.transform = "scale(1) translate(0px, 0px)";
  }

  function zoomToEye(eye, scale) {
    setCamera(scale, EYE_WORLD[eye]);
  }

  // sizes/positions the reflex-overlay circle to sit exactly over the (now zoomed) pupil
  function sizeReflexOverlayToPupil() {
    const d = PUPIL_WORLD_R * 2.1 * currentCameraScale * worldScale;
    reflexOverlay.style.width = d + "px";
    reflexOverlay.style.height = d + "px";
  }

  /* -------------------------------------------------------------------
     2. NATURAL BLINKING
  ------------------------------------------------------------------- */
  function blinkOnce() {
    eyeEls.OD.classList.add("blinking");
    eyeEls.OS.classList.add("blinking");
    setTimeout(() => {
      eyeEls.OD.classList.remove("blinking");
      eyeEls.OS.classList.remove("blinking");
    }, 340);
  }
  function scheduleBlink() {
    const delay = 2600 + Math.random() * 3200;
    setTimeout(() => {
      blinkOnce();
      scheduleBlink();
    }, delay);
  }

  /* -------------------------------------------------------------------
     3. PATIENT CASE GENERATION
     Each patient has a hidden refractive condition per eye:
     { sphere, cylinder, axis }.  Spherical equivalent (SE) drives the
     visual acuity + retinoscopy simulations. Autorefraction reads the
     values directly (with small instrument noise), same as real life.
  ------------------------------------------------------------------- */
  const FIRST_NAMES = ["Elena", "Marcus", "Priya", "Daniel", "Yuki", "Fatima", "Owen", "Camila", "Noah", "Ingrid"];
  const LAST_NAMES = ["Reyes", "Whitfield", "Kapoor", "Okafor", "Novak", "Andrade", "Bergström", "Lindqvist", "Haddad", "Moreno"];

  let patient = null;
  let caseCounter = 100;

  function round25(v) {
    return Math.round(v / 0.25) * 0.25;
  }

  function generateEyeRx() {
    // sphere between -6.00 and +3.00, cylinder 0 to -2.50 (minus-cyl convention), axis 0-179
    const sphere = round25(-6 + Math.random() * 9);
    const cylinder = round25(-(Math.random() * 2.5));
    const axis = Math.round(Math.random() * 179);
    return {
      sphere: parseFloat(sphere.toFixed(2)),
      cylinder: parseFloat(cylinder.toFixed(2)),
      axis: axis,
    };
  }

  function se(rx) {
    return rx.sphere + rx.cylinder / 2;
  }

  function generatePatient() {
    caseCounter += 1;
    patient = {
      name: FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)] + " " + LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)],
      id: "Case #" + caseCounter,
      OD: generateEyeRx(),
      OS: generateEyeRx(),
    };
    document.getElementById("patientName").textContent = patient.name;
    document.getElementById("patientId").textContent = patient.id;
    resetFindings();
    setStatus("New patient seated. Case " + patient.id + " loaded.");
  }

  /* -------------------------------------------------------------------
     4. FINDINGS LOG
  ------------------------------------------------------------------- */
  function resetFindings() {
    const list = document.getElementById("findingsList");
    list.innerHTML = '<li class="muted">No findings recorded yet.</li>';
  }
  function addFinding(text) {
    const list = document.getElementById("findingsList");
    if (list.children.length === 1 && list.children[0].classList.contains("muted")) {
      list.innerHTML = "";
    }
    const li = document.createElement("li");
    li.textContent = text;
    list.prepend(li);
  }

  function setStatus(msg) {
    statusText.textContent = msg;
  }

  /* -------------------------------------------------------------------
     5. PANEL / NAVIGATION
  ------------------------------------------------------------------- */
  function showPanel(name) {
    Object.values(panels).forEach((p) => p.classList.add("hidden"));
    panels[name].classList.remove("hidden");
  }

  function goToRoom() {
    showPanel("room");
    resetCamera();
    viewfinder.classList.remove("active");
    scanLine.classList.remove("scanning");
    scopeIndicator.classList.remove("active");
    reflexOverlay.classList.remove("active");
    autorefRigGroup.style.opacity = 0;
    autorefRigGroup.setAttribute("transform", "translate(1060,300) scale(0.001)");
    clearOccluders();
    setStatus("Back in the exam room.");
  }

  function clearOccluders() {
    document.querySelector(".occluder-OD").style.display = "none";
    document.querySelector(".occluder-OS").style.display = "none";
    eyeEls.OD.classList.remove("eye-covered");
    eyeEls.OS.classList.remove("eye-covered");
  }

  function setOcclusion(testedEye) {
    clearOccluders();
    const other = testedEye === "OD" ? "OS" : "OD";
    document.querySelector(".occluder-" + other).style.display = "block";
    eyeEls[other].classList.add("eye-covered");
  }

  document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", goToRoom));
  document.getElementById("newPatientBtn").addEventListener("click", () => {
    generatePatient();
    goToRoom();
  });

  // Room exam-select buttons (HUD)
  document.querySelectorAll(".exam-btn").forEach((btn) => {
    btn.addEventListener("click", () => enterExam(btn.dataset.exam));
  });
  // Clickable equipment inside the SVG room scene
  document.querySelectorAll(".clickable-equip").forEach((el) => {
    el.addEventListener("click", () => enterExam(el.dataset.exam));
  });

  function enterExam(exam) {
    showPanel(exam);
    if (exam === "acuity") startAcuityExam();
    if (exam === "autorefraction") resetAutorefPanel();
    if (exam === "retinoscopy") resetRetinoPanel();
  }

  /* =====================================================================
     6. VISUAL ACUITY EXAM
  ===================================================================== */
  const CHART_LINES = [
    { den: 200, letters: ["E"], size: 84 },
    { den: 100, letters: ["F", "P"], size: 58 },
    { den: 80, letters: ["T", "O", "Z"], size: 46 },
    { den: 60, letters: ["L", "P", "E", "D"], size: 36 },
    { den: 50, letters: ["P", "E", "C", "F", "D"], size: 30 },
    { den: 40, letters: ["E", "D", "F", "C", "Z", "P"], size: 25 },
    { den: 30, letters: ["F", "E", "L", "O", "P", "Z", "D"], size: 20 },
    { den: 25, letters: ["D", "E", "F", "P", "O", "T", "E", "C"], size: 17 },
    { den: 20, letters: ["L", "E", "F", "O", "D", "P", "C", "T"], size: 14 },
    { den: 15, letters: ["F", "D", "P", "L", "T", "C", "E", "O"], size: 12 },
  ];

  let acuityState = { eye: "OD", lineIndex: 0, lastPassedIndex: -1, lastLineResult: null, finished: false };

  function startAcuityExam() {
    acuityState = { eye: "OD", lineIndex: 0, lastPassedIndex: -1, lastLineResult: null, finished: false };
    document.querySelectorAll("#acuityEyeSelect .eye-btn").forEach((b) => b.classList.toggle("active", b.dataset.eye === "OD"));
    document.getElementById("acuityResult").classList.add("hidden");
    document.getElementById("stopAcuityBtn").disabled = true;
    document.getElementById("testLineBtn").disabled = false;
    document.getElementById("testLineBtn").textContent = "Test This Line";
    document.getElementById("patientResponse").textContent = "Ready when you are, doctor.";
    renderChartLine();
    zoomToEye("OD", 2.1);
    setOcclusion("OD");
    setStatus("Testing visual acuity — Right Eye (OD).");
  }

  document.querySelectorAll("#acuityEyeSelect .eye-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#acuityEyeSelect .eye-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      acuityState.eye = btn.dataset.eye;
      acuityState.lineIndex = 0;
      acuityState.lastPassedIndex = -1;
      acuityState.finished = false;
      document.getElementById("acuityResult").classList.add("hidden");
      document.getElementById("testLineBtn").disabled = false;
      document.getElementById("testLineBtn").textContent = "Test This Line";
      document.getElementById("stopAcuityBtn").disabled = true;
      document.getElementById("patientResponse").textContent = "Ready when you are, doctor.";
      renderChartLine();
      zoomToEye(acuityState.eye, 2.1);
      setOcclusion(acuityState.eye);
      setStatus("Testing visual acuity — " + (acuityState.eye === "OD" ? "Right Eye (OD)." : "Left Eye (OS)."));
    });
  });

  function renderChartLine() {
    const line = CHART_LINES[acuityState.lineIndex];
    document.getElementById("denTag").textContent = "20/" + line.den;
    const disp = document.getElementById("lettersDisplay");
    disp.textContent = line.letters.join("  ");
    disp.style.fontSize = line.size + "px";
  }

  // required minimum-angle-of-resolution (arcmin) for a given eye's SE (uncorrected)
  function estimateMAR(rxSE, cylMag) {
    const blur = Math.abs(rxSE);
    return 1 + blur * 2.6 + cylMag * 1.3; // 1 arcmin baseline = perfect 20/20
  }

  document.getElementById("testLineBtn").addEventListener("click", () => {
    const eye = acuityState.eye;
    const rx = patient[eye];
    const SE = se(rx);
    const mar = estimateMAR(SE, Math.abs(rx.cylinder));
    const line = CHART_LINES[acuityState.lineIndex];
    const requiredMAR = line.den / 20; // arcmin needed to resolve this line's letters
    const marginRatio = requiredMAR / mar; // >1 comfortably readable

    // simulate each letter
    let correctCount = 0;
    const total = line.letters.length;
    for (let i = 0; i < total; i++) {
      const pCorrect = Math.max(0.03, Math.min(0.97, 0.5 + (marginRatio - 1) * 2.2));
      if (Math.random() < pCorrect) correctCount++;
    }
    const passed = correctCount / total >= 0.7;
    acuityState.lastLineResult = { line, correctCount, total, passed };

    document.getElementById("patientResponse").textContent =
      `Patient reads ${correctCount} of ${total} letters correctly on the 20/${line.den} line.`;

    blinkOnce();

    if (passed) {
      acuityState.lastPassedIndex = acuityState.lineIndex;
      addFinding(`VA test ${eye}: read 20/${line.den} line (${correctCount}/${total}).`);
      if (acuityState.lineIndex < CHART_LINES.length - 1) {
        acuityState.lineIndex++;
        setTimeout(renderChartLine, 650);
        document.getElementById("stopAcuityBtn").disabled = false;
      } else {
        finishAcuity(true);
      }
    } else {
      addFinding(`VA test ${eye}: failed 20/${line.den} line (${correctCount}/${total}).`);
      finishAcuity(false, correctCount, total);
    }
  });

  document.getElementById("stopAcuityBtn").addEventListener("click", () => finishAcuity(true));

  function finishAcuity(reachedSmallest, missedCount, missedTotal) {
    acuityState.finished = true;
    document.getElementById("testLineBtn").disabled = true;
    document.getElementById("stopAcuityBtn").disabled = true;

    let denToReport, notation;
    if (acuityState.lastPassedIndex === -1) {
      denToReport = 400; // worse than the biggest line on the chart
      notation = `20/${denToReport} (unable to read largest optotype reliably)`;
    } else {
      denToReport = CHART_LINES[acuityState.lastPassedIndex].den;
      if (!reachedSmallest && missedTotal) {
        const missed = missedTotal - missedCount;
        notation = `20/${denToReport}` + (missed > 0 ? ` -${missed}` : "");
      } else {
        notation = `20/${denToReport}` + (denToReport === 15 ? " or better" : "");
      }
    }

    const box = document.getElementById("acuityResult");
    box.classList.remove("hidden");
    box.innerHTML = `<div class="rx-title">Visual Acuity — ${acuityState.eye}</div><div class="rx-line">${notation}</div>`;
    addFinding(`Final VA ${acuityState.eye}: ${notation}`);
    setStatus("Visual acuity recorded for " + acuityState.eye + ": " + notation);
  }

  /* =====================================================================
     7. AUTOREFRACTION EXAM
  ===================================================================== */
  let autorefEye = "OD";

  function resetAutorefPanel() {
    autorefEye = "OD";
    document.querySelectorAll("#autorefEyeSelect .eye-btn").forEach((b) => b.classList.toggle("active", b.dataset.eye === "OD"));
    document.getElementById("measuringBox").classList.add("hidden");
    document.getElementById("progressFill").style.width = "0%";
    document.getElementById("autorefResult").classList.add("hidden");
    document.getElementById("startAutorefBtn").disabled = false;
    viewfinder.classList.remove("active");
    scanLine.classList.remove("scanning");
    autorefRigGroup.style.opacity = 0;
    autorefRigGroup.setAttribute("transform", "translate(1060,300) scale(0.001)");
    clearOccluders();
    resetCamera();
    setStatus("Autorefraction ready.");
  }

  document.querySelectorAll("#autorefEyeSelect .eye-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#autorefEyeSelect .eye-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      autorefEye = btn.dataset.eye;
    });
  });

  document.getElementById("startAutorefBtn").addEventListener("click", () => {
    document.getElementById("startAutorefBtn").disabled = true;
    document.getElementById("autorefResult").classList.add("hidden");
    setOcclusion(autorefEye);
    setStatus("Aligning autorefractor on " + autorefEye + "...");

    // 1. camera moves toward the patient's face / eye
    zoomToEye(autorefEye, 2.9);

    // 2. device rig slides into position in front of the eye
    const eyeWorld = EYE_WORLD[autorefEye];
    setTimeout(() => {
      autorefRigGroup.style.opacity = 1;
      autorefRigGroup.setAttribute("transform", `translate(${eyeWorld.x},${eyeWorld.y}) scale(1)`);
    }, 500);

    // 3 & 4. eye becomes visible inside the device viewing screen + blinks
    setTimeout(() => {
      viewfinder.classList.add("active");
      blinkOnce();
      document.getElementById("measuringBox").classList.remove("hidden");
      document.getElementById("measuringLabel").textContent = "Aligning on pupil…";
    }, 1300);

    // 5. animated measurement
    setTimeout(() => {
      scanLine.classList.add("scanning");
      document.getElementById("measuringLabel").textContent = "Measuring refractive error…";
      let pct = 0;
      const fill = document.getElementById("progressFill");
      const iv = setInterval(() => {
        pct += 4 + Math.random() * 6;
        if (pct >= 100) {
          pct = 100;
          clearInterval(iv);
          scanLine.classList.remove("scanning");
          document.getElementById("measuringLabel").textContent = "Measurement complete.";
          revealAutorefResult(autorefEye);
        }
        fill.style.width = pct + "%";
      }, 140);
      blinkOnce();
    }, 1800);
  });

  function revealAutorefResult(eye) {
    const trueRx = patient[eye];
    // 3 noisy instrument readings, then averaged (mirrors real autorefractors)
    const readings = [];
    for (let i = 0; i < 3; i++) {
      readings.push({
        sphere: trueRx.sphere + (Math.random() - 0.5) * 0.5,
        cylinder: trueRx.cylinder + (Math.random() - 0.5) * 0.3,
        axis: Math.round(trueRx.axis + (Math.random() - 0.5) * 8),
      });
    }
    const avg = {
      sphere: round25(readings.reduce((s, r) => s + r.sphere, 0) / 3),
      cylinder: round25(readings.reduce((s, r) => s + r.cylinder, 0) / 3),
      axis: Math.round(readings.reduce((s, r) => s + r.axis, 0) / 3),
    };

    const fmt = (v) => (v > 0 ? "+" + v.toFixed(2) : v.toFixed(2));
    const box = document.getElementById("autorefResult");
    box.classList.remove("hidden");
    box.innerHTML = `
      <div class="rx-title">Autorefraction — ${eye}</div>
      <div class="rx-line">Sphere: ${fmt(avg.sphere)} D</div>
      <div class="rx-line">Cylinder: ${fmt(avg.cylinder)} D</div>
      <div class="rx-line">Axis: ${avg.axis}&deg;</div>
      <div style="margin-top:8px;color:var(--muted);font-size:11.5px;">3-reading average · instrument confidence: good</div>
    `;
    addFinding(`Autorefraction ${eye}: ${fmt(avg.sphere)} / ${fmt(avg.cylinder)} x ${avg.axis}`);
    document.getElementById("startAutorefBtn").disabled = false;
    setStatus("Autorefraction complete for " + eye + ".");
  }

  /* =====================================================================
     8. RETINOSCOPY EXAM
  ===================================================================== */
  let retino = { eye: "OD", lens: 0, active: false };

  function resetRetinoPanel() {
    retino = { eye: "OD", lens: 0, active: false };
    document.querySelectorAll("#retinoEyeSelect .eye-btn").forEach((b) => b.classList.toggle("active", b.dataset.eye === "OD"));
    document.getElementById("retinoControls").classList.add("hidden");
    document.getElementById("retinoResult").classList.add("hidden");
    document.getElementById("startRetinoBtn").disabled = false;
    document.getElementById("lensValue").textContent = "0.00";
    document.getElementById("reflexMotionLabel").textContent = "Motion: —";
    viewfinder.classList.remove("active");
    reflexOverlay.classList.remove("active");
    reflexBar.className = "reflex-bar";
    scopeIndicator.classList.remove("active");
    clearOccluders();
    resetCamera();
    setStatus("Retinoscopy ready.");
  }

  document.querySelectorAll("#retinoEyeSelect .eye-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (retino.active) return;
      document.querySelectorAll("#retinoEyeSelect .eye-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      retino.eye = btn.dataset.eye;
    });
  });

  document.getElementById("startRetinoBtn").addEventListener("click", () => {
    retino.active = true;
    retino.lens = 0;
    document.getElementById("lensValue").textContent = "0.00";
    document.getElementById("startRetinoBtn").disabled = true;
    document.getElementById("retinoControls").classList.remove("hidden");
    document.getElementById("retinoResult").classList.add("hidden");
    setOcclusion(retino.eye);
    setStatus("Performing retinoscopy on " + retino.eye + "...");

    zoomToEye(retino.eye, 3.4);
    setTimeout(() => {
      viewfinder.classList.add("active");
      reflexOverlay.classList.add("active");
      scopeIndicator.classList.add("active");
      sizeReflexOverlayToPupil();
      updateReflex();
    }, 1200);
  });

  function trueSEFor(eye) {
    return se(patient[eye]);
  }

  function updateReflex() {
    sizeReflexOverlayToPupil();
    const diff = retino.lens - trueSEFor(retino.eye);
    const absDiff = Math.abs(diff);

    if (absDiff < 0.25) {
      reflexBar.className = "reflex-bar neutral";
      reflexBar.style.animation = "none";
      document.getElementById("reflexMotionLabel").textContent = "Motion: NEUTRAL — reflex fills the pupil, no motion";
      return;
    }

    const speed = Math.max(0.5, 1.9 - absDiff * 0.13); // seconds per sweep
    const brightness = Math.max(0.35, 1 - absDiff / 10);
    const widthPct = Math.max(18, Math.min(85, 60 - absDiff * 4));

    reflexBar.style.width = widthPct + "%";
    reflexBar.style.opacity = brightness;

    if (diff > 0) {
      reflexBar.className = "reflex-bar sweep-with";
      document.getElementById("reflexMotionLabel").textContent = `Motion: WITH the sweep (moves same direction) — add plus / reduce minus`;
    } else {
      reflexBar.className = "reflex-bar sweep-against";
      document.getElementById("reflexMotionLabel").textContent = `Motion: AGAINST the sweep (moves opposite direction) — add minus / reduce plus`;
    }
    reflexBar.style.animationDuration = speed + "s";
  }

  function adjustLens(delta) {
    retino.lens = parseFloat((retino.lens + delta).toFixed(2));
    document.getElementById("lensValue").textContent = (retino.lens > 0 ? "+" : "") + retino.lens.toFixed(2);
    updateReflex();
  }
  document.getElementById("lensPlus").addEventListener("click", () => adjustLens(0.25));
  document.getElementById("lensMinus").addEventListener("click", () => adjustLens(-0.25));

  document.getElementById("checkNeutralBtn").addEventListener("click", () => {
    const trueVal = trueSEFor(retino.eye);
    const diff = Math.abs(retino.lens - trueVal);
    const box = document.getElementById("retinoResult");
    box.classList.remove("hidden");
    if (diff <= 0.25) {
      box.innerHTML = `
        <div class="rx-title">Retinoscopy — ${retino.eye} — Neutralized ✓</div>
        <div class="rx-line">Your neutralization: ${(retino.lens > 0 ? "+" : "") + retino.lens.toFixed(2)} D</div>
        <div class="rx-line">True spherical equivalent: ${(trueVal > 0 ? "+" : "") + trueVal.toFixed(2)} D</div>
        <div style="margin-top:6px;color:var(--good);font-size:12.5px;">Great work — reflex neutrality achieved within clinical tolerance.</div>
      `;
      addFinding(`Retinoscopy ${retino.eye}: neutralized at ${(retino.lens > 0 ? "+" : "") + retino.lens.toFixed(2)} D (true SE ${(trueVal > 0 ? "+" : "") + trueVal.toFixed(2)} D).`);
      setStatus("Retinoscopy neutralized for " + retino.eye + ".");
      retino.active = false;
      document.getElementById("startRetinoBtn").disabled = false;
    } else {
      box.innerHTML = `
        <div class="rx-title">Retinoscopy — ${retino.eye} — Not Yet Neutral</div>
        <div class="rx-line">Current lens: ${(retino.lens > 0 ? "+" : "") + retino.lens.toFixed(2)} D</div>
        <div style="margin-top:6px;color:var(--danger);font-size:12.5px;">Keep adjusting — watch the reflex motion for direction cues.</div>
      `;
      setStatus("Still searching for neutrality on " + retino.eye + "...");
    }
  });

  document.getElementById("revealRetinoBtn").addEventListener("click", () => {
    const trueVal = trueSEFor(retino.eye);
    retino.lens = round25(trueVal);
    document.getElementById("lensValue").textContent = (retino.lens > 0 ? "+" : "") + retino.lens.toFixed(2);
    updateReflex();
    const box = document.getElementById("retinoResult");
    box.classList.remove("hidden");
    box.innerHTML = `
      <div class="rx-title">Retinoscopy — ${retino.eye} — Answer Revealed</div>
      <div class="rx-line">True spherical equivalent: ${(trueVal > 0 ? "+" : "") + trueVal.toFixed(2)} D</div>
    `;
    addFinding(`Retinoscopy ${retino.eye}: answer revealed (${(trueVal > 0 ? "+" : "") + trueVal.toFixed(2)} D).`);
    retino.active = false;
    document.getElementById("startRetinoBtn").disabled = false;
  });

  /* -------------------------------------------------------------------
     9. INIT
  ------------------------------------------------------------------- */
  function init() {
    fitWorld();
    generatePatient();
    scheduleBlink();
    resetCamera();
    showPanel("room");
  }

  init();
})();
