// The scene: a Mac screen with Heyra's dot above the Dock. On a loop, fn goes
// down, the dot opens into the orb and follows a voice, fn comes up, the orb
// writes in gold, and the sentence lands in the window. Then it rests again.
// Runs only while on screen; with reduced motion it shows one still moment.

import { orb as makeOrb } from "/orb.js";

const scene = document.querySelector("#scene");
if (scene) {
  const o = makeOrb(scene.querySelector(".scene-orb"), { scale: 0.12 });
  const key = document.querySelector(".keys .fnkey");
  const app = scene.querySelector(".mb-app");
  const windows = { notes: scene.querySelector(".window.notes"), term: scene.querySelector(".window.term") };
  // Each take goes to whichever window is in front.
  const takes = [
    ["term", "Add a dark mode switch to the settings page."],
    ["notes", "Can we move the standup to ten tomorrow?"],
    ["term", "Why is the login test failing? Fix it and run the suite."],
    ["notes", "Remind me to send Sam the invoice on Friday."],
    ["term", "Write tests for the invoice parser."],
    ["notes", "Book a table for four at seven."],
  ];
  function focus(name) {
    for (const [k, w] of Object.entries(windows)) w.classList.toggle("focus", k === name);
    app.textContent = name === "term" ? "Terminal" : "Notes";
  }
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let running = false, visible = false, n = 0;

  // A speaking voice: syllable bursts with a slow phrase envelope.
  function speak(ms) {
    const end = performance.now() + ms;
    return new Promise((done) => {
      const tick = () => {
        const now = performance.now();
        if (now >= end) { o.level(0); return done(); }
        const t = (ms - (end - now)) / 1000;
        const phrase = Math.min(1, t * 3) * (0.55 + 0.45 * Math.sin(t * 1.7));
        const syllable = Math.max(0, Math.sin(t * 13) * 0.6 + Math.sin(t * 7.3) * 0.4);
        o.level(0.15 + 0.75 * phrase * syllable);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  // In Notes each take lands as a new line; in the terminal it fills the prompt
  // and the agent starts on it.
  function place(where, text) {
    const box = windows[where].querySelector(".doc");
    const current = box.querySelector(".now");
    const caret = current.querySelector(".caret");
    if (where === "term") {
      current.classList.remove("now");
      current.querySelector(".doc-text").textContent = text;
      current.querySelector(".doc-text").classList.add("landed");
      caret.remove();
      const reply = document.createElement("p");
      reply.className = "doc-line dim";
      reply.textContent = "✻ On it.";
      const next = document.createElement("p");
      next.className = "doc-line now";
      next.innerHTML = '<span class="prompt">›</span> <span class="doc-text"></span>';
      next.append(caret);
      box.append(reply, next);
      while (box.children.length > 5) box.firstElementChild.remove();
      return;
    }
    current.classList.remove("now");
    caret.remove();
    const line = document.createElement("p");
    line.className = "doc-line now";
    const words = document.createElement("span");
    words.className = "doc-text landed";
    words.textContent = text;
    line.append(words, caret);
    box.append(line);
    // Keep the note short: the title plus the last three lines.
    while (box.children.length > 4) box.children[1].remove();
  }

  async function loop() {
    if (running) return;
    running = true;
    while (visible && !calm.matches) {
      const [where, text] = takes[n++ % takes.length];
      focus(where);
      await wait(1400);
      key.classList.add("down");
      o.size(1);
      await wait(350);
      await speak(2600);
      key.classList.remove("down");
      o.writing(true);
      await wait(520);
      place(where, text);
      o.writing(false);
      o.size(0.12);
      await wait(2400);
    }
    running = false;
  }

  if (calm.matches) {
    focus("term");
    place("term", takes[0][1]);
    o.size(1);
    o.level(0.4);
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) loop();
  }, { threshold: 0.3 }).observe(scene);
}

// The closing dot: hover it and it wakes, like the one above your Dock.
const closing = document.querySelector(".closing-orb");
if (closing) {
  const dot = makeOrb(closing, { scale: 0.12 });
  closing.addEventListener("pointerenter", () => { dot.size(0.34); dot.writing(true); });
  closing.addEventListener("pointerleave", () => { dot.size(0.12); dot.writing(false); });
}
