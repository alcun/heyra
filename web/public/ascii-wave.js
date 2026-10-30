// A slow, dithered swell made from type. The centre stays quiet for the orb.
(() => {
  const canvas = document.getElementById("ascii-wave");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const glyphs = ".:o*%#@";
  let width = 0;
  let height = 0;
  let visible = true;
  let frame = 0;
  let last = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(0);
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    ctx.font = '500 17px "Martian Mono", ui-monospace, monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cellX = 14;
    const cellY = 17;
    const drift = reducedMotion.matches ? 0 : time * 0.00042;
    for (let row = 0, y = cellY / 2; y < height; row++, y += cellY) {
      for (let col = 0, x = cellX / 2; x < width; col++, x += cellX) {
        const envelope = 0.55 + 0.45 * Math.sin(Math.PI * x / width);
        const swell = Math.sin(x * 0.007 - drift) * 48 * envelope
          + Math.sin(x * 0.014 + drift * 0.6) * 14;
        const centre = height * 0.49 + swell;
        const distance = Math.abs(y - centre);
        const thickness = (64 + 14 * Math.sin(x * 0.011 + drift * 0.7)) * envelope;
        if (distance > thickness) continue;
        const strength = 1 - distance / thickness;
        const grain = (Math.sin(col * 17.13 + row * 78.77) * 43758.55) % 1;
        const shade = Math.max(0, Math.min(1, strength * 0.82 + Math.abs(grain) * 0.18));
        const glyph = glyphs[Math.min(glyphs.length - 1, Math.floor(shade * glyphs.length))];
        const gold = (col * 7 + row * 11) % 29 === 0;
        const alpha = (0.13 + strength * 0.2) * envelope;
        ctx.fillStyle = gold ? `rgba(217,168,106,${alpha * 0.7})` : `rgba(138,154,166,${alpha})`;
        ctx.fillText(glyph, x, y);
      }
    }
  }

  function tick(time) {
    if (!visible || reducedMotion.matches) { frame = 0; return; }
    if (time - last >= 50) { draw(time); last = time; }
    frame = requestAnimationFrame(tick);
  }

  function refresh() {
    cancelAnimationFrame(frame);
    frame = 0;
    draw(0);
    if (visible && !reducedMotion.matches) frame = requestAnimationFrame(tick);
  }

  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    refresh();
  }).observe(canvas);
  reducedMotion.addEventListener("change", refresh);
})();
