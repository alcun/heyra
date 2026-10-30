// The orb's journey: as you scroll, the hero's orb winds up (it swells where it is while
// the words and the swell fade away), then drops down the page into the dot above the
// Dock in the scene below, because that's what it is. When it lands, the scene's own dot
// takes over with one gold pulse. Tied to the scroll, so scrolling up plays it back.
//
// Smooth: the path is worked out on screen, so holding and falling are one curve, and it
// follows an eased copy of the scroll, so uneven wheel steps glide. Cheap: only opacity
// and transforms move (never blur), and nothing runs unless the page is scrolling or
// the glide is settling. Off with reduced motion: both orbs simply stay where they are.
(() => {
  const hero = document.querySelector(".hero");
  const stage = hero?.querySelector(".stage");
  const target = document.querySelector("#scene .scene-orb");
  if (!stage || !target || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const leaving = [...hero.querySelectorAll(".hero-inner > :not(.stage), .scroll")];
  const sky = hero.querySelector(".sky");
  for (const el of [stage, sky, ...leaving]) if (el) el.style.willChange = "translate, scale, opacity";
  // The scene draws its resting dot at 0.12 of its canvas; the hero orb at full size.
  const DOT = 0.12;
  // Two beats: the wind-up, then the drop.
  const WIND = 0.24, SWELL = 1.5;
  let from, to, end;
  const centre = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 + scrollX, y: r.top + r.height / 2 + scrollY, w: r.width };
  };
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const out = (t) => 1 - Math.pow(1 - t, 3);

  function draw(y) {
    const p = Math.min(1, Math.max(0, y / end));
    const small = (to.w * DOT) / from.w;
    const release = p < WIND ? 0 : ease((p - WIND) / (1 - WIND));
    const scale = p < WIND ? 1 + (SWELL - 1) * out(p / WIND) : SWELL + (small - SWELL) * release;
    // On screen: held where it started, then carried to wherever the dot is now.
    const startOnScreen = from.y, dotOnScreen = to.y - y;
    const onScreen = startOnScreen + (dotOnScreen - startOnScreen) * release;
    stage.style.translate = `${((to.x - from.x) * release).toFixed(2)}px ${(onScreen + y - from.y).toFixed(2)}px`;
    stage.style.scale = scale.toFixed(4);
    // The swell blooms outward and fades as it winds up; the words drift up and fade.
    const w = out(Math.min(1, p / WIND));
    if (sky) {
      sky.style.scale = (1 + 0.3 * w).toFixed(4);
      sky.style.opacity = (1 - w).toFixed(3);
    }
    const f = out(Math.min(1, p / (WIND * 0.85)));
    for (const el of leaving) {
      el.style.opacity = (1 - f).toFixed(3);
      el.style.translate = `0 ${(-f * 32).toFixed(1)}px`;
    }
    const landed = p >= 0.998;
    stage.style.opacity = landed ? "0" : "1";
    target.style.opacity = landed ? "1" : "0";
    document.body.classList.toggle("orb-landed", landed);
  }

  // Glide towards the real scroll position instead of jumping with each wheel step, and
  // stop once there: no work at all while the page is still.
  let shown = scrollY, running = false;
  function frame() {
    shown += (scrollY - shown) * 0.2;
    if (Math.abs(scrollY - shown) < 0.25) shown = scrollY;
    if (shown <= end + innerHeight || scrollY <= end + innerHeight) draw(shown);
    if (shown !== scrollY) requestAnimationFrame(frame);
    else running = false;
  }
  const wake = () => {
    if (!running) { running = true; requestAnimationFrame(frame); }
  };
  function measure() {
    stage.style.translate = "";
    stage.style.scale = "";
    from = centre(stage);
    to = centre(target);
    // It lands once the dot is well up the screen, so the scene plays with its own orb.
    end = Math.max(1, to.y - innerHeight * 0.95);
    draw(shown);
  }
  addEventListener("scroll", wake, { passive: true });
  addEventListener("resize", measure);
  addEventListener("load", measure);
  document.fonts?.ready.then(measure);
  measure();
})();
