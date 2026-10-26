/* DOM mount for ScannerCore: builds a scene's element entities in its own container and
   guarantees teardown (media paused and released, nodes removed). Prototype, not wired to player.html. */
(function (root) {
  function mountScene(rec, container, extraMedia) {
    const holder = document.createElement("a-entity"); holder.dataset.scannerScene = rec.id;
    const media = (extraMedia || []).slice();
    Studio.topLevelElements(rec).forEach((el, idx) => {
      const e = Studio.buildElementEntity(rec, el, idx, "ar");
      if (e) holder.appendChild(e);
    });
    container.appendChild(holder);
    const all = () => [...holder.querySelectorAll("video,audio"), ...media];
    return {
      pause() { all().forEach((m) => { try { m.pause(); } catch (e) {} }); },
      resume() { all().forEach((m) => { try { const p = m.play(); p && p.catch && p.catch(() => {}); } catch (e) {} }); },
      destroy() { all().forEach((m) => { try { m.pause(); m.removeAttribute("src"); m.load(); m.remove(); } catch (e) {} }); holder.remove(); },
    };
  }
  root.ScannerMount = { mountScene };
})(window);
