/* Engine adapter for the shared scanner (prototype).
   Translates the engine's xrimagefound / xrimageupdated / xrimagelost events (event.detail.name = target name)
   into ScannerCore.found/lost and, when a pose entity is given, moves that entity like xrextras-named-image-target does:
   position.copy(detail.position), quaternion.copy(detail.rotation), uniform scale = detail.scale; hidden until found and again on lost.
   The pose follows the most recently found target only. Unnamed or non-string names are ignored. Returns a detach function. */
(function (root) {
  function attach(sceneEl, core, poseEl) {
    const nameOf = (e) => (e && e.detail && typeof e.detail.name === "string") ? e.detail.name : null;
    let active = null;
    const o3 = poseEl && poseEl.object3D;
    if (o3) o3.visible = false;
    const applyPose = (d) => {
      if (!o3 || !d || !d.position || !d.rotation || !(d.scale > 0)) return;
      o3.position.copy(d.position); o3.quaternion.copy(d.rotation); o3.scale.set(d.scale, d.scale, d.scale); o3.visible = true;
    };
    const onFound = (e) => { const n = nameOf(e); if (!n) return; active = n; applyPose(e.detail); core.found(n); };
    const onUpdated = (e) => { const n = nameOf(e); if (n && n === active) applyPose(e.detail); };
    const onLost = (e) => { const n = nameOf(e); if (!n) return; if (n === active) { active = null; if (o3) o3.visible = false; } core.lost(n); };
    sceneEl.addEventListener("xrimagefound", onFound);
    sceneEl.addEventListener("xrimageupdated", onUpdated);
    sceneEl.addEventListener("xrimagelost", onLost);
    return () => { sceneEl.removeEventListener("xrimagefound", onFound); sceneEl.removeEventListener("xrimageupdated", onUpdated); sceneEl.removeEventListener("xrimagelost", onLost); };
  }
  root.ScannerEngine = { attach };
})(window);
