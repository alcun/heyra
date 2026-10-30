// Sound on the left becomes words on the right, with the orb at the crossing.
(() => {
  const canvas = document.getElementById("ascii-wave");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const symbols = ".:o*%#@";
  const words = ["say", "it", "and", "see", "the", "words"];
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
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const drift = reducedMotion.matches ? 0 : time * 0.00065;
    for (const side of [-1, 1]) {
      const sound = side === -1;
      const cellX = sound ? 16 : 60;
      const cellY = sound ? 19 : 18;
      ctx.font = sound
        ? '500 19px "Martian Mono", ui-monospace, monospace'
        : '500 14px "Martian Mono", ui-monospace, monospace';
      for (let row = 0, y = cellY / 2; y < height; row++, y += cellY) {
        for (let col = 0, localX = cellX / 2; localX < width / 2; col++, localX += cellX) {
          const x = sound ? localX : width / 2 + localX;
          const envelope = 0.7 + 0.3 * Math.sin(Math.PI * x / width);
          const fromCentre = Math.abs(x - width / 2);
          const swell = side * (
            Math.sin(fromCentre * 0.006 - drift) * 76 * envelope
            + Math.sin(fromCentre * 0.013 + drift * 0.6) * 25
          );
          const centre = height * 0.49 + swell;
          const distance = Math.abs(y - centre);
          const thickness = (92 + 22 * Math.sin(x * 0.01 + drift * 0.7)) * envelope;
          if (distance > thickness) continue;
          const strength = 1 - distance / thickness;
          const grain = Math.abs((Math.sin(col * 17.13 + row * 78.77) * 43758.55) % 1);
          const shade = Math.max(0, Math.min(1, strength * 0.82 + grain * 0.18));
          const clearHeadline = Math.max(0, Math.min(1, (y - height * 0.22) / (height * 0.16)));
          const alpha = (0.2 + shade * 0.43) * envelope * clearHeadline;
          if (alpha === 0) continue;
          if (sound) {
            const glyph = symbols[Math.min(symbols.length - 1, Math.floor(shade * symbols.length))];
            const gold = (col * 7 + row * 11) % 13 === 0;
            ctx.fillStyle = gold ? `rgba(217,168,106,${alpha * 0.85})` : `rgba(138,154,166,${alpha})`;
            ctx.fillText(glyph, x, y);
          } else {
            const word = words[(col + row * 2) % words.length];
            ctx.fillStyle = `rgba(205,211,214,${alpha * 1.3})`;
            ctx.fillText(word, x, y);
          }
        }
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
