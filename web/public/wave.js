// The bench page's header: a waveform in ordered dither, gold where it's loud.
// Fixed height, so nothing shifts. Still when motion is reduced.
(() => {
  const cv = document.getElementById("wave"), ctx = cv.getContext("2d");
  const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], PX = 3;
  const gold = [217, 168, 106], slate = [138, 154, 166];
  const size = () => { cv.width = Math.max(1, Math.floor(cv.clientWidth / PX)); cv.height = Math.floor(cv.clientHeight / PX); };
  function draw(time) {
    const w = cv.width, h = cv.height, mid = h / 2, img = ctx.createImageData(w, h);
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const env = Math.pow(Math.sin(Math.PI * u), 0.8) * (0.55 + 0.45 * Math.sin(u * 9 + time * 0.0006));
      const amp = env * (0.6 + 0.4 * Math.sin(u * 47 + time * 0.002)) * mid * 0.95;
      for (let y = 0; y < h; y++) {
        const d = Math.abs(y - mid), level = d < amp ? 1 - d / Math.max(amp, 1) : 0;
        if (level * 0.95 > (B[(y % 4) * 4 + (x % 4)] + 0.5) / 16) {
          const c = level > 0.55 ? gold : slate, i = (y * w + x) * 4;
          img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  size(); draw(0);
  addEventListener("resize", () => { size(); draw(performance.now()); });
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const loop = (t) => { draw(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
})();
