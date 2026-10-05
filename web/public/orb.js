// The orb: Heyra's own shader, the same one the Mac app draws with Metal.
// Light woven through a dark sphere as thin glowing sheets (a warped gyroid),
// wound in shells around a leaning axis with a soft spine of light. Talking
// winds it up and brightens it; when you let go it releases, racing outward in
// gold while the words are written.
//
// orb(canvas, { scale }) returns { level(v), writing(on), size(s), stop() }; size
// 1 is the full orb and about 0.12 the resting dot. It draws only while
// on screen and slows right down for prefers-reduced-motion.

const VERT = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
#define STEPS __STEPS__
uniform vec2 res;
uniform float time, voice, wave, twist, writing, scale;
uniform vec2 tilt;

mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, -s, 0.0, s, c, 0.0, 0.0, 0.0, 1.0); }

void main() {
  vec2 frame_uv = (gl_FragCoord.xy * 2.0 - res) / min(res.x, res.y);
  vec2 uv = frame_uv / max(scale, 0.05);
  const float CAM = 2.6;
  const float FOCAL = 1.6;
  vec3 ro = vec3(0.0, 0.0, CAM);
  vec3 rd = normalize(vec3(uv, -FOCAL));
  vec3 gold = vec3(0.85, 0.64, 0.40);
  vec3 cream = vec3(0.96, 0.91, 0.80);
  vec3 lavender = vec3(0.62, 0.59, 0.76);

  vec3 col = vec3(0.0);
  float b = dot(ro, rd);
  float h = b * b - (dot(ro, ro) - 1.0);
  if (h > 0.0) {
    float sh = sqrt(h);
    float t0 = -b - sh;
    float dt = 2.0 * sh / float(STEPS);
    float t = t0 + dt * 0.5;
    mat3 lean = rotZ(0.3 + tilt.x) * rotX(tilt.y);
    for (int i = 0; i < STEPS; i++) {
      vec3 p = lean * (ro + rd * t);
      float r = length(p);
      vec3 q = rotY(twist * r * 3.1 - wave) * p;
      vec3 w = q * 2.4;
      for (int k = 1; k < 6; k++) {
        float fk = float(k);
        w += sin(w.zxy * fk * 1.1 + time * 0.35 * fk) * (0.45 / fk);
      }
      float g = sin(w.x) * cos(w.y) + sin(w.y) * cos(w.z) + sin(w.z) * cos(w.x);
      float sheet = 0.035 / (g * g + 0.035);
      float axis = length(q.xz);
      float spine = exp(-axis * axis * 16.0) * (0.35 + 0.9 * voice + 0.6 * writing);
      float body = 1.0 - smoothstep(0.55, 1.0, r);
      float depth = float(i) / float(STEPS);
      vec3 tint = mix(gold, cream, depth);
      tint = mix(tint, lavender, smoothstep(0.6, 1.0, r) * (1.0 - writing));
      tint = mix(tint, gold, writing * 0.5);
      col += tint * (sheet * 3.2 + spine * 1.2) * body * dt * (56.0 / 72.0);
      t += dt;
    }
  }
  float exposure = 1.5 + 2.4 * voice + 1.2 * writing;
  vec3 inner = 1.0 - exp(-col * exposure);
  // Small, it rests: the light goes out and a gold point remains.
  float awake = smoothstep(0.14, 0.34, scale);
  inner *= awake;

  float rs = FOCAL / sqrt(CAM * CAM - 1.0);
  float d = length(uv);
  float aa = 2.0 / (min(res.x, res.y) * max(scale, 0.05));
  float disc = 1.0 - smoothstep(rs - aa, rs + aa, d);
  inner += mix(gold, cream, 0.5) * smoothstep(rs * 0.8, rs, d) * disc * (0.12 + 0.2 * voice);
  float halo = exp(-max(d - rs, 0.0) * 6.0) * (1.0 - disc) * (0.2 + 0.45 * voice + 0.3 * writing) * awake;
  float pip = (1.0 - smoothstep(rs * 0.13, rs * 0.2, d)) * (1.0 - awake);
  inner += gold * pip;
  vec3 halo_col = mix(gold, cream, 0.3) * halo;

  vec3 rgb = inner * disc + halo_col;
  float a = disc + (1.0 - disc) * clamp(max(halo_col.r, max(halo_col.g, halo_col.b)) * 1.2, 0.0, 1.0);
  float fade = 1.0 - smoothstep(0.86, 1.0, length(frame_uv));
  gl_FragColor = vec4(rgb * fade, a * fade);
}
`;

export function orb(canvas, { scale: startScale = 1 } = {}) {
  const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) {
    canvas.classList.add("no-gl");
    return { level() {}, writing() {}, size() {}, look() {}, hover() {}, stop() {} };
  }
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  // Phones get fewer steps through the sphere: softer, and much cooler to run.
  const steps = matchMedia("(pointer: coarse)").matches ? 36 : 56;
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG.replace("__STEPS__", String(steps))));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = Object.fromEntries(["res", "time", "voice", "wave", "twist", "writing", "scale", "tilt"].map((n) => [n, gl.getUniformLocation(prog, n)]));

  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  let target = 0, smooth = 0, gold = 0, goldTarget = 0, twist = 1, wave = 0, clock = 0;
  let last = performance.now(), frame = 0, visible = true;
  let scale = startScale, scaleTarget = startScale;
  let tx = 0, ty = 0, txTarget = 0, tyTarget = 0, hover = 0, hoverTarget = 0;

  function size() {
    // The shader is soft; 1.25x is plenty and keeps laptops and phones cool.
    const dpr = Math.min(devicePixelRatio || 1, 1.25);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, w, h);
  }

  function draw(now) {
    const dt = Math.min((now - last) / 1000, 0.1) * (calm.matches ? 0.25 : 1);
    last = now;
    smooth += (target - smooth) * (target > smooth ? 0.35 : 0.07);
    gold += (goldTarget - gold) * 0.1;
    twist += ((goldTarget ? 0.35 : 1 + 1.6 * smooth) - twist) * 0.08;
    wave += dt * (goldTarget ? 3.2 : 0.45 + 2 * smooth);
    clock += dt * (0.6 + 1.2 * smooth);
    scale += (scaleTarget - scale) * (scaleTarget > scale ? 0.16 : 0.09);
    tx += (txTarget - tx) * 0.05;
    ty += (tyTarget - ty) * 0.05;
    hover += (hoverTarget - hover) * 0.08;
    size();
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.time, clock);
    gl.uniform1f(u.voice, Math.max(smooth, hover * 0.18));
    gl.uniform2f(u.tilt, tx, ty);
    gl.uniform1f(u.wave, wave);
    gl.uniform1f(u.twist, twist);
    gl.uniform1f(u.writing, gold);
    gl.uniform1f(u.scale, scale);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frame = visible ? requestAnimationFrame(draw) : 0;
  }

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !frame) { last = performance.now(); frame = requestAnimationFrame(draw); }
  }).observe(canvas);
  frame = requestAnimationFrame(draw);

  return {
    level(v) { target = Math.max(0, Math.min(1, v)); },
    writing(on) { goldTarget = on ? 1 : 0; if (on) target = 0; },
    size(s) { scaleTarget = s; },
    // Lean the light toward a point (-1..1 on each axis), and wake a little on hover.
    look(x, y) { if (!calm.matches) { txTarget = -x * 0.35; tyTarget = y * 0.35; } },
    hover(on) { hoverTarget = on ? 1 : 0; },
    stop() { cancelAnimationFrame(frame); frame = 0; visible = false; },
  };
}
