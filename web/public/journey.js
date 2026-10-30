// The orb's journey: as you scroll, the hero's orb shrinks and glides down the page
// into the dot above the Dock in the scene below, because that's what it is. The words
// and the swell around it drift off as it leaves; when it lands, the scene's own dot
// takes over with one gold pulse. Tied to the scroll, so scrolling up plays it back.
// Off with reduced motion: then both orbs simply stay where they are.
(() => {
  const hero = document.querySelector(".hero");
  const stage = hero?.querySelector(".stage");
  const target = document.querySelector("#scene .scene-orb");
  if (!stage || !target || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const drifting = [...hero.querySelectorAll(".hero-inner > :not(.stage), .scroll")];
  const sky = hero.querySelector(".sky");
  // The scene draws its resting dot at 0.12 of its canvas; the hero orb at full size.
  const DOT = 0.12;
  let from, to, end, last = -1;
  const centre = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 + scrollX, y: r.top + r.height / 2 + scrollY, w: r.width };
  };
  function measure() {
    stage.style.translate = "";
    stage.style.scale = "";
    from = centre(stage);
    to = centre(target);
    // It lands when the dot is a little below the middle of the screen.
    end = Math.max(1, to.y - innerHeight * 0.62);
    last = -1;
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const out = (t) => 1 - Math.pow(1 - t, 3);
  // Two beats: first it swells towards you (the wind-up), then it lets go and drops.
  const WIND = 0.24, SWELL = 1.5;
  function frame() {
    const p = Math.min(1, Math.max(0, scrollY / end));
    if (p !== last) {
      last = p;
      const small = (to.w * DOT) / from.w;
      let scale, e;
      if (p < WIND) {
        e = 0;
        scale = 1 + (SWELL - 1) * out(p / WIND);
      } else {
        e = ease((p - WIND) / (1 - WIND));
        scale = SWELL + (small - SWELL) * e;
      }
      // During the wind-up it holds its place on screen (moving down as fast as the page
      // goes up); then it drops from there to the dot.
      const held = Math.min(scrollY, WIND * end);
      const dy = p < WIND ? scrollY : held + (to.y - from.y - held) * e;
      stage.style.translate = `${(to.x - from.x) * e}px ${dy}px`;
      stage.style.scale = String(scale);
      // The swell blooms outward and dissolves as the orb winds up.
      const w = Math.min(1, p / WIND);
      if (sky) {
        sky.style.scale = String(1 + 0.35 * out(w));
        sky.style.opacity = String(1 - w);
        sky.style.filter = w > 0 ? `blur(${(w * 10).toFixed(1)}px)` : "";
      }
      const landed = p >= 0.999;
      stage.style.opacity = landed ? "0" : "1";
      target.style.opacity = landed ? "1" : "0";
      document.body.classList.toggle("orb-landed", landed);
      // The words and the swell leave in the first third of the journey.
      const f = Math.min(1, p / (WIND * 0.9));
      for (const el of drifting) {
        el.style.opacity = String(1 - f);
        el.style.filter = f > 0 ? `blur(${(f * 8).toFixed(1)}px)` : "";
        el.style.translate = `0 ${(-f * 28).toFixed(1)}px`;
      }
    }
    requestAnimationFrame(frame);
  }
  measure();
  addEventListener("resize", measure);
  addEventListener("load", measure);
  document.fonts?.ready.then(measure);
  requestAnimationFrame(frame);
})();
