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
    // buildElementEntity creates blob URLs itself (glTF models, particle sprites). Capture exactly those created during the
    // synchronous build so the mount owns them and revokes them on destroy (not before: the loaders read them asynchronously).
    const realCreate = URL.createObjectURL;
    URL.createObjectURL = function (o) { const u = realCreate.call(URL, o); urls.push(u); return u; };
    try {
      Studio.topLevelElements(rec).forEach((el, idx) => {
        const e = Studio.buildElementEntity(rec, el, idx, "ar", { mediaId: mid });
        if (e) holder.appendChild(e);
      });
    } finally { URL.createObjectURL = realCreate; }
    container.appendChild(holder);
    // Player runtime parity, step 1: opacity and the timeline driver (keyframe motion plays while found, freezes while lost).
    holder.querySelectorAll("[data-el-id]").forEach((n) => { if (n.dataset.opacity) Studio.applyOpacity(n, parseFloat(n.dataset.opacity)); });
    // step 2: parallel tracks (autostart then paused until found) and state/sequence visibility, same calls as the player
    let curSeq = Studio.seqList(rec).length ? Studio.seqList(rec)[0].id : null;
    const trackRunner = Studio.makeTrackRunner(rec, holder);
    const refreshVisibility = () => Studio.applySequence(holder, rec, curSeq, null, (id) => trackRunner.isPlaying(id));
    trackRunner.autoStart(); trackRunner.pauseAll(); refreshVisibility();
    const seqRunner = Studio.makeSeqRunner(rec, (to) => setSequence(to));
    function setSequence(id) {
      if (!Studio.seqList(rec).some((x) => x.id === id)) return;
      curSeq = id; refreshVisibility();
      if (tlDrv) { tlDrv.stateLoop = !!(Studio.seqList(rec).find((x) => x.id === curSeq) || {}).loop; tlDrv.reset(); }
      seqRunner.enter(curSeq);
    }
    const tlDrv = Studio.startTimelineDriver(rec, [...holder.querySelectorAll("[data-el-id]")].filter((n) => {
      const el = rec.elements.find((x) => x.id === n.dataset.elId); return el && !el.track;
    }), { autostart: false });
    if (tlDrv) tlDrv.stateLoop = !!(Studio.seqList(rec).find((x) => x.id === curSeq) || {}).loop;
    seqRunner.enter(curSeq);
    // studio-target-video / track components listen for xrextrasfound/lost on their PARENT (the image-target entity in the player).
    // The scanner has no per-scene target entity, so the mount re-emits them on those parents: found on mount and resume, lost on pause.
    const parents = () => [...new Set([...holder.querySelectorAll("[studio-target-video]")].map((n) => n.parentNode))];
    const emit = (t) => parents().forEach((n) => { try { n.emit ? n.emit(t, {}, false) : n.dispatchEvent(new CustomEvent(t)); } catch (e) {} });
    const ready = async () => {
      const need = () => [...holder.querySelectorAll("[studio-target-video]")].every((n) => n.components && n.components["studio-target-video"]);
      for (let i = 0; i < 40 && !need(); i++) await new Promise((r) => setTimeout(r, 50));
    };
    const all = () => [...holder.querySelectorAll("video,audio"), ...store.querySelectorAll("video,audio"), ...media];
    await ready();
    emit("xrextrasfound"); if (tlDrv) tlDrv.play(); trackRunner.resumeAll();
    // found = visible now, so start media as the player does after found (muted video autoplays; audio may wait for a tap)
    all().forEach((m) => { try { const pr = m.play(); pr && pr.catch && pr.catch(() => {}); } catch (e) {} });
    return {
      state: () => ({ seq: curSeq, tracks: Studio.trackList(rec).map((t) => [t.id, trackRunner.isPlaying(t.id)]) }), setSequence, trackRunner,
      pause() { holder.setAttribute("visible", false); emit("xrextraslost"); if (tlDrv) tlDrv.pause(); trackRunner.pauseAll(); all().forEach((m) => { try { m.pause(); } catch (e) {} }); },
      resume() { holder.setAttribute("visible", true); emit("xrextrasfound"); if (tlDrv) tlDrv.play(); trackRunner.resumeAll(); all().forEach((m) => { try { const p = m.play(); p && p.catch && p.catch(() => {}); } catch (e) {} }); },
      destroy() { if (tlDrv) tlDrv.dispose(); trackRunner.dispose(); seqRunner.cancel(); all().forEach((m) => { try { m.pause(); m.removeAttribute("src"); m.load(); m.remove(); } catch (e) {} }); holder.remove(); store.remove(); urls.forEach((u) => URL.revokeObjectURL(u)); },
    };
  }
  root.ScannerMount = { mountScene };
})(window);
