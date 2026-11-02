// Two blocky ASCII swells move in opposite directions around the orb.
// On the right, horizontal streams of letters from The Waste Land emerge inside
// the same grid. The short fragments came from the text Al supplied.
(() => {
  const canvas = document.getElementById("ascii-wave");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const symbols = ".:o*%#@";
  // Whole lines from The Waste Land, run together; a word or two in each glints gold.
  const lines = [
    ["mixingmemoryanddesirestirringdullroots", "desire"],
    ["dullrootswithspringrain", "spring rain"],
    ["winterkeptuswarmcoveringearthinforgetfulsnow", "warm snow"],
    ["feedingalittlelifewithdriedtubers", "life little"],
    ["andwentoninsunlightintothehofgarten", "sunlight"],
    ["anddrankcoffeeandtalkedforanhour", "coffee"],
    ["inthemountainsthereyoufeelfree", "free"],
    ["yourshadowatmorningstridingbehindyou", "morning"],
    ["lookingintotheheartoflightthesilence", "light heart"],
    ["whenwecamebacklatefromthehyacinthgarden", "garden"],
    ["theglitterofherjewelsrosetomeetit", "glitter jewels"],
    ["inwhichsadlightacarveddolphinswam", "swam"],
    ["whatisthatnoisethewindunderthedoor", "wind"],
    ["glowedintowordsthenwouldbesavagelystill", "glowed"],
    ["sweetthamesrunsoftlytilliendmysong", "softly"],
    ["iftherewerethesoundofwateronly", "water"],
    ["thebargesdriftwiththeturningtide", "tide barges"],
    ["redsailswidetoleewardswingontheheavyspar", "sails red"],
    ["agildedshellredandgoldthebriskswell", "gold gilded"],
    ["thepealofbellswhitetowers", "bells"],
    ["inthefaintmoonlightthegrassissinging", "singing moonlight"],
    ["wherethehermitthrushsingsinthepinetrees", "sings"],
    ["dripdropdripdropdropdropdrop", "drop"],
    ["thenadampgustbringingrain", "rain"],
    ["theboatrespondedgailytothehandexpertwithsailandoar", "boat"],
    ["theseawascalmyourheartwouldhaveresponded", "calm sea"],
    ["shantihshantihshantih", "shantih"],
  ];
  const fragments = lines.map(([line]) => line);
  const goldenWords = new Map(lines);
  let width = 0;
  let height = 0;
  let middle = 0.52;
  let reach = 1;
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
    // Level with the orb, and calmer on narrow screens, where a full swell
    // leaves one side low and the other high.
    const orb = document.getElementById("orb")?.getBoundingClientRect();
    if (orb && height) middle = (orb.top + orb.height / 2 - rect.top) / height;
    reach = Math.min(1, width / 1100);
    draw(0);
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const drift = reducedMotion.matches ? 0 : time * 0.00065;
    const cellX = 16;
    const cellY = 19;
    const half = width / 2;
    const waveAt = (x, side) => {
      const envelope = 0.7 + 0.3 * Math.sin(Math.PI * x / width);
      const fromCentre = Math.abs(x - half);
      const merge = Math.min(1, fromCentre / (width * 0.23));
      const swell = side * merge * reach * (
        Math.sin(fromCentre * 0.006 - drift) * 76 * envelope
        + Math.sin(fromCentre * 0.013 + drift * 0.6) * 25
      );
      return { centre: height * middle + swell, envelope, merge };
    };
    const textDrift = reducedMotion.matches ? 0 : Math.floor(time / 260);
    ctx.font = '500 19px "Martian Mono", ui-monospace, monospace';
    for (const side of [-1, 1]) {
      for (let row = 0, y = cellY / 2; y < height; row++, y += cellY) {
        for (let col = 0, localX = cellX / 2; localX < width / 2; col++, localX += cellX) {
          const x = side === -1 ? localX : half + localX;
          const { centre, envelope, merge } = waveAt(x, side);
          const distance = Math.abs(y - centre);
          const thickness = (92 + 22 * Math.sin(x * 0.01 + drift * 0.7)) * envelope * (0.55 + 0.45 * merge);
          if (distance > thickness) continue;
          const strength = 1 - distance / thickness;
          const grain = Math.abs((Math.sin(col * 17.13 + row * 78.77) * 43758.55) % 1);
          const shade = Math.max(0, Math.min(1, strength * 0.82 + grain * 0.18));
          const clearHeadline = Math.max(0, Math.min(1, (y - height * 0.22) / (height * 0.16)));
          const alpha = (0.2 + shade * 0.43) * envelope * clearHeadline;
          if (alpha === 0) continue;
          let glyph = symbols[Math.min(symbols.length - 1, Math.floor(shade * symbols.length))];
          let letter = false;
          let highlight = false;
          if (side === 1 && shade > 0.34) {
            const fragment = fragments[(row * 7 + Math.floor(time / 18000)) % fragments.length];
            const streamPosition = col - textDrift;
            const character = ((streamPosition % fragment.length) + fragment.length) % fragment.length;
            glyph = fragment[character];
            letter = true;
            highlight = (goldenWords.get(fragment) || "").split(" ").some((word) => {
              const start = fragment.indexOf(word);
              return word && start >= 0 && character >= start && character < start + word.length;
            });
          }
          const gold = side === -1 && (col * 7 + row * 11) % 13 === 0;
          ctx.fillStyle = highlight ? `rgba(217,168,106,${Math.min(1, alpha * 1.35)})` :
            letter ? `rgba(205,211,214,${alpha * 1.1})` :
            gold ? `rgba(217,168,106,${alpha * 0.85})` : `rgba(138,154,166,${alpha})`;
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.fillText(glyph, x, y);
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
