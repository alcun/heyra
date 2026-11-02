// The bench page's moving parts. Pick a kind of speech and the bars slide into their
// new order; pick a clip and play it. Everything shown is already in the markup.
const data = JSON.parse(document.getElementById("bench-data").textContent);

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
    el.style.setProperty("--i", i);
    el.querySelector(".pos").textContent = i + 1;
    el.querySelector(".b").style.width = v == null ? "0" : `${Math.min(100, (v / data.rankMax) * 100).toFixed(2)}%`;
    el.querySelector(".v").textContent = v == null ? "–" : v.toFixed(1);
    el.classList.toggle("lead", i === 0 && v != null);
    el.classList.toggle("none", v == null);
  });
  const best = order[0];
  const chip = chips.find((c) => c.dataset.view === view);
  const where = view === "average" ? "" : ` on ${chip.textContent.toLowerCase()}`;
  point.textContent = `Fewest mistakes${where}: ${best.name}, ${value(best).toFixed(1)} in 100. Gold: in Heyra.`;
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

// ---- the leaderboard: sort by any column, filter the rows ----
const board = document.getElementById("board");
if (board) {
  const body = board.tBodies[0];
  const heads = [...board.querySelectorAll("thead button[data-sort]")];
  const cellIndex = (button) => [...button.closest("tr").children].indexOf(button.closest("th"));
  for (const h of heads) {
    h.addEventListener("click", () => {
      const was = h.getAttribute("aria-sort");
      const low = h.dataset.low !== "false";
      const dir = was ? (was === "ascending" ? "descending" : "ascending") : low || h.dataset.sort === "name" ? "ascending" : "descending";
      for (const x of heads) x.removeAttribute("aria-sort");
      h.setAttribute("aria-sort", dir);
      const i = cellIndex(h);
      const key = (tr) => {
        if (h.dataset.sort === "name") return tr.dataset.name;
        const v = tr.children[i].dataset.v;
        return v === "" ? null : Number(v);
      };
      const rows = [...body.rows].sort((a, b) => {
        const [x, y] = [key(a), key(b)];
        if (x === null) return 1;
        if (y === null) return -1;
        const order = typeof x === "string" ? x.localeCompare(y) : x - y;
        return dir === "ascending" ? order : -order;
      });
      body.append(...rows);
    });
  }
  const filters = [...document.querySelectorAll(".chip[data-filter]")];
  for (const f of filters) {
    f.addEventListener("click", () => {
      for (const x of filters) x.setAttribute("aria-pressed", String(x === f));
      for (const tr of body.rows) {
        const want = f.dataset.filter;
        tr.hidden = want === "all" ? false : want === "heyra" ? tr.dataset.heyra !== "true" : tr.dataset.langs !== want;
      }
    });
  }
}
