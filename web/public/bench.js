// The bench page's moving parts. Pick a kind of speech and the bars slide into their
// new order; pick a clip and play it. Everything shown is already in the markup.
const data = JSON.parse(document.getElementById("bench-data").textContent);
const ROW = 46;

// ---- pick your speech ----
const rank = document.getElementById("rank");
const point = document.getElementById("rank-point");
const bars = new Map([...rank.querySelectorAll(".bar")].map((el) => [el.dataset.id, el]));
const chips = [...document.querySelectorAll(".chip[data-view]")];

function show(view) {
  const value = (m) => (view === "average" ? m.average : m.v[view]);
  const order = [...data.models]
    .filter((m) => bars.has(m.id))
    .sort((a, b) => (value(a) ?? Infinity) - (value(b) ?? Infinity));
  order.forEach((m, i) => {
    const el = bars.get(m.id);
    const v = value(m);
    el.style.transform = `translateY(${i * ROW}px)`;
    el.querySelector(".pos").textContent = i + 1;
    el.querySelector(".b").style.width = v == null ? "0" : `${Math.min(100, (v / data.rankMax) * 100).toFixed(2)}%`;
    el.querySelector(".v").textContent = v == null ? "–" : v.toFixed(1);
    el.classList.toggle("lead", i === 0 && v != null);
    el.classList.toggle("none", v == null);
  });
  const best = order[0];
  const chip = chips.find((c) => c.dataset.view === view);
  const where = view === "average" ? "on average" : `on ${chip.textContent.toLowerCase()}`;
  point.textContent = `${best.name} gets the fewest words wrong ${where}: ${value(best).toFixed(1)} in 100. Gold bars are the models in Heyra.`;
  for (const c of chips) c.setAttribute("aria-pressed", String(c === chip));
}
for (const c of chips) c.addEventListener("click", () => show(c.dataset.view));

// ---- listen ----
const tabs = [...document.querySelectorAll(".chip[data-clip]")];
const panels = [...document.querySelectorAll("[data-clip-panel]")];
const stopAll = () => panels.forEach((p) => p.querySelector("audio").pause());
for (const t of tabs) {
  t.addEventListener("click", () => {
    stopAll();
    for (const x of tabs) x.setAttribute("aria-pressed", String(x === t));
    for (const p of panels) p.hidden = p.dataset.clipPanel !== t.dataset.clip;
  });
}
for (const p of panels) {
  const audio = p.querySelector("audio");
  const button = p.querySelector(".play");
  const fill = p.querySelector(".track i");
  button.addEventListener("click", () => {
    if (audio.paused) {
      stopAll();
      audio.play();
    } else {
      audio.pause();
    }
  });
  audio.addEventListener("play", () => button.classList.add("on"));
  audio.addEventListener("pause", () => button.classList.remove("on"));
  audio.addEventListener("ended", () => { button.classList.remove("on"); fill.style.width = "0"; });
  audio.addEventListener("timeupdate", () => {
    fill.style.width = `${((audio.currentTime / (audio.duration || 1)) * 100).toFixed(1)}%`;
  });
}
