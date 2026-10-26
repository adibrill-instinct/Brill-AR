/* Engine adapter for the shared scanner (prototype, not wired to play.html).
   Translates the engine's xrimagefound / xrimagelost events (event.detail.name = target name)
   into ScannerCore.found/lost. Returns a detach function. Unnamed or non-string names are ignored. */
(function (root) {
  function attach(sceneEl, core) {
    const nameOf = (e) => (e && e.detail && typeof e.detail.name === "string") ? e.detail.name : null;
    const onFound = (e) => { const n = nameOf(e); if (n) core.found(n); };
    const onLost = (e) => { const n = nameOf(e); if (n) core.lost(n); };
    sceneEl.addEventListener("xrimagefound", onFound);
    sceneEl.addEventListener("xrimagelost", onLost);
    return () => { sceneEl.removeEventListener("xrimagefound", onFound); sceneEl.removeEventListener("xrimagelost", onLost); };
  }
  root.ScannerEngine = { attach };
})(window);
