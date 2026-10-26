/* Builds the multi-target list for the shared scanner (prototype, not wired to play.html).
   For each catalog entry: load the scene record, regenerate its engine target from its stored artwork
   (same deterministic pipeline as player.js) and tag it with the catalog NAME so found-events map back.
   A scene that fails to load or has no artwork is skipped and reported, never fatal. */
(function (root) {
  async function buildTargetData(entries, loadScene) {
    const targets = [], skipped = [];
    for (const e of entries) {
      try {
        const rec = await loadScene(e.scene);
        if (!rec || !rec.assets || !rec.assets.__artwork) throw new Error("no artwork");
        const url = URL.createObjectURL(rec.assets.__artwork);
        try {
          const img = await Studio.loadImage(url);
          const t = await Studio.makeTarget(img);
          targets.push(Studio.targetDataJSON(t.luminance, t.padded, t.thumb, e.name));
        } finally { URL.revokeObjectURL(url); }
      } catch (err) { skipped.push({ name: e.name, reason: String(err && err.message || err) }); }
    }
    return { targets, skipped };
  }
  root.ScannerTargets = { buildTargetData };
})(window);
