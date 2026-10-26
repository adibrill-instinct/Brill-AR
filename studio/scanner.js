"use strict";
/* Shared scanner page (PROTOTYPE). One camera session, several catalog targets: the engine's found-event NAME picks the scene.
   Catalog + scenes come from a same-folder directory (default scanner-demo/: generated demo scenes only; no user art).
   Recognition itself is the engine's; this page only wires catalog -> targets -> events -> scene mount. */
(async () => {
  const status = document.getElementById("scan-status"), errBox = document.getElementById("err");
  const fail = (t) => { errBox.style.display = "grid"; errBox.textContent = t; };
  const STATE = { scanning: "מכוונים אל תמונה…", loading: "טוען חוויה…", tracking: "מזהה", lost: "התמונה אבדה - כוונו שוב", "unknown-target": "תמונה לא מוכרת", "scene-error": "החוויה לא נטענה" };
  const say = (s) => { status.textContent = STATE[s] || s; };
  // the catalog directory is a plain relative folder name (no URLs, no traversal)
  const dirParam = new URLSearchParams(location.search).get("dir") || "scanner-demo";
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(dirParam)) return fail("תיקיית קטלוג לא חוקית.");
  const dir = dirParam + "/";
  let raw;
  try { const r = await fetch(dir + "catalog.json"); if (!r.ok) throw new Error("catalog " + r.status); raw = await r.json(); } catch (e) { return fail("הקטלוג לא נטען."); }
  const cat = ScannerCore.cleanCatalog(raw);
  if (!cat.entries.length) return fail("הקטלוג ריק.");
  const recs = new Map();
  const loadScene = async (id) => {
    if (recs.has(id)) return recs.get(id);
    const r = await fetch(dir + encodeURIComponent(id) + ".json"); if (!r.ok) throw new Error("scene " + id + " " + r.status);
    const rec = await Studio.importJSON(await r.text(), { save: false }); rec.elements.forEach(Studio.normEl); recs.set(id, rec); return rec;
  };
  const { targets, skipped } = await ScannerTargets.buildTargetData(cat.entries, loadScene);
  window.__scannerBoot = { entries: cat.entries.length, targets: targets.map((t) => t.name), skipped };
  if (!targets.length) return fail("אין תמונות לזיהוי בקטלוג.");

  const scene = document.createElement("a-scene");
  window.HTMLElement.prototype.setAttribute.call(scene, "gltf-model", "dracoDecoderPath: " + Studio.DECODER_DRACO_PATH + "; meshoptDecoderPath: " + Studio.DECODER_MESHOPT_PATH);
  scene.setAttribute("xrextras-gesture-detector", ""); scene.setAttribute("landing-page", ""); scene.setAttribute("xrextras-loading", ""); scene.setAttribute("xrextras-runtime-error", "");
  scene.setAttribute("renderer", "colorManagement:true"); scene.setAttribute("xrweb", "disableWorldTracking: true");
  const cam = document.createElement("a-camera"); cam.setAttribute("position", "0 0 0"); cam.setAttribute("raycaster", "objects: .cantap"); cam.setAttribute("cursor", "fuse: false; rayOrigin: mouse;"); scene.appendChild(cam);
  const l1 = document.createElement("a-light"); l1.setAttribute("type", "directional"); l1.setAttribute("intensity", "0.5"); l1.setAttribute("position", "1 1 1");
  const l2 = document.createElement("a-light"); l2.setAttribute("type", "ambient"); l2.setAttribute("intensity", "1"); scene.appendChild(l1); scene.appendChild(l2);
  const container = document.createElement("a-entity"); container.id = "scanner-container"; scene.appendChild(container);
  const core = ScannerCore.create({
    catalog: cat.entries, loadScene,
    validate: (rec) => { if (!Array.isArray(rec.elements)) throw new Error("bad scene"); },
    mount: (rec) => ScannerMount.mountScene(rec, container),
    onState: (s, x) => { say(s); document.body.dataset.scanState = s; document.body.dataset.scanTarget = (x && x.name) || ""; },
  });
  window.__scanner = core;
  ScannerEngine.attach(scene, core);
  document.body.appendChild(scene);
  say("scanning");
  const setup = () => { XR8.XrController.configure({ imageTargetData: targets }); window.__scannerConfigured = targets.length; };
  window.XR8 ? setup() : window.addEventListener("xrloaded", setup);
})().catch((e) => { console.error(e); const b = document.getElementById("err"); b.style.display = "grid"; b.textContent = "שגיאה בסורק: " + e.message; });
