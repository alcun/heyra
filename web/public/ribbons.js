// The hero's light: Siri-like ribbons in gold, amber and bronze. Each ribbon is a sine
// that swells in the middle and thins to nothing at the edges; they're drawn with
// "lighter" blending, so where they cross they glow. They breathe slowly, pause when the
// hero's off screen, and hold still when motion is reduced.
(() => {
  const cv = document.getElementById("ribbons");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  const ribbons = [
    { color: [217, 168, 106], amp: 0.34, freq: 1.6, speed: 0.00042, phase: 0.0, width: 0.07 },
    { color: [236, 150, 70], amp: 0.26, freq: 2.3, speed: -0.00055, phase: 1.7, width: 0.05 },
    { color: [180, 112, 62], amp: 0.4, freq: 1.2, speed: 0.0003, phase: 3.1, width: 0.09 },
    { color: [245, 214, 160], amp: 0.18, freq: 3.1, speed: 0.0007, phase: 4.4, width: 0.03 },
    { color: [200, 132, 80], amp: 0.22, freq: 2.7, speed: -0.00036, phase: 5.6, width: 0.045 },
  ];
  let w = 0, h = 0, dpr = 1;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = cv.clientWidth; h = cv.clientHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  // Fullest in the middle, nothing at the edges.
  const taper = (u) => Math.pow(Math.sin(Math.PI * u), 2.2);
  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = "lighter";
    const mid = h / 2, steps = 160;
    for (const r of ribbons) {
      const breathe = 0.75 + 0.25 * Math.sin(t * 0.0004 + r.phase * 2);
      const top = [], bottom = [];
      for (let i = 0; i <= steps; i++) {
        const u = i / steps, x = u * w, env = taper(u);
        const y = mid + Math.sin(u * Math.PI * 2 * r.freq + t * r.speed * 6 + r.phase) * r.amp * h * 0.5 * env * breathe;
        const thick = r.width * h * env * (0.6 + 0.4 * breathe);
        top.push([x, y - thick]); bottom.push([x, y + thick]);
      }
      const [cr, cg, cb] = r.color;
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},0)`);
      grad.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.4)`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = grad;
      ctx.shadowColor = `rgba(${cr},${cg},${cb},0.9)`;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.moveTo(top[0][0], top[0][1]);
      for (const [x, y] of top) ctx.lineTo(x, y);
      for (let i = bottom.length - 1; i >= 0; i--) ctx.lineTo(bottom[i][0], bottom[i][1]);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.shadowBlur = 0;
  }
  size(); draw(0);
  addEventListener("resize", () => { size(); draw(performance.now()); });
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let running = false, frame = 0;
  const loop = (t) => { draw(t); frame = requestAnimationFrame(loop); };
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting && !running) { running = true; frame = requestAnimationFrame(loop); }
    else if (!entry.isIntersecting && running) { running = false; cancelAnimationFrame(frame); }
  }).observe(cv);
})();
