/* DOM mount for ScannerCore: builds a scene's element entities in its own container and
   guarantees teardown (media paused and released, nodes removed). Prototype, not wired to player.html. */
(function (root) {
  function mountScene(rec, container, extraMedia) {
    // A-Frame's entity teardown calls parentEl.remove(child); on a plain element that removes the PARENT itself.
    // So the container must be an A-Frame entity or scene (a plain div would be deleted on scene switch).
    const tag = container && container.tagName ? container.tagName.toLowerCase() : "";
    if (tag !== "a-entity" && tag !== "a-scene") throw new Error("ScannerMount: container must be an a-entity or a-scene, got <" + tag + ">");
    return build(rec, container, extraMedia);
  }
  async function build(rec, container, extraMedia) {
    const holder = document.createElement("a-entity"); holder.dataset.scannerScene = rec.id;
    const media = (extraMedia || []).slice(), urls = [];
    // media is built from the scene's own assets (same attributes as player.js) with ids namespaced by scene id
    const store = document.createElement("div"); store.dataset.scannerMedia = rec.id; store.hidden = true;
    const mid = (e2) => "m-" + rec.id + "-" + e2.id;
    for (const el of rec.elements || []) {
      if (!el.assetId || !rec.assets || !rec.assets[el.assetId]) continue;
      if (el.type !== "video" && el.type !== "sound") continue;
      const url = URL.createObjectURL(rec.assets[el.assetId]); urls.push(url);
      const m = document.createElement(el.type === "video" ? "video" : "audio");
      m.id = mid(el); m.src = url; m.loop = el.loop !== false; m.preload = "auto";
      if (el.type === "video") { m.muted = true; m.setAttribute("playsinline", ""); m.setAttribute("webkit-playsinline", ""); m.setAttribute("crossorigin", "anonymous"); }
      store.appendChild(m);
    }
    // image elements go through the same pipeline as the player (animated GIF support); built before entities so their src ids resolve
    for (const el of rec.elements || []) {
      if (el.type !== "image" || !el.assetId || !rec.assets || !rec.assets[el.assetId]) continue;
      const mm = await Studio.makeImageMedia(rec.assets[el.assetId], mid(el), () => holder.querySelector('[data-el-id="' + el.id + '"]'));
      store.appendChild(mm.node); if (mm.node.src && mm.node.src.indexOf("blob:") === 0) urls.push(mm.node.src);
    }
    container.appendChild(store);
    Studio.topLevelElements(rec).forEach((el, idx) => {
      const e = Studio.buildElementEntity(rec, el, idx, "ar", { mediaId: mid });
      if (e) holder.appendChild(e);
    });
    container.appendChild(holder);
    const all = () => [...holder.querySelectorAll("video,audio"), ...store.querySelectorAll("video,audio"), ...media];
    return {
      pause() { all().forEach((m) => { try { m.pause(); } catch (e) {} }); },
      resume() { all().forEach((m) => { try { const p = m.play(); p && p.catch && p.catch(() => {}); } catch (e) {} }); },
      destroy() { all().forEach((m) => { try { m.pause(); m.removeAttribute("src"); m.load(); m.remove(); } catch (e) {} }); holder.remove(); store.remove(); urls.forEach((u) => URL.revokeObjectURL(u)); },
    };
  }
  root.ScannerMount = { mountScene };
})(window);
