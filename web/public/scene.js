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
  const live = scene.querySelector(".live");
  const liveText = scene.querySelector(".live-text");
  const windows = { notes: scene.querySelector(".window.notes"), term: scene.querySelector(".window.term") };
  // Each take goes to whichever window is in front.
  const takes = [
    ["term", "Add a dark mode switch to the settings page.", "I'll add a dark mode toggle to the settings page."],
    ["notes", "Can we move the standup to ten tomorrow?"],
    ["term", "Why is the login test failing? Fix it and run the suite.", "Reading the login test and its fixtures."],
    ["notes", "Remind me to send Sam the invoice on Friday."],
    ["term", "Write tests for the invoice parser.", "I'll start with the parser's edge cases."],
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

  // The words box fills in a word at a time while you talk, as in the app.
  function words(text, ms) {
    const all = text.split(" ");
    liveText.textContent = "";
    live.classList.add("on");
    return Promise.all(all.map((_, i) => wait((ms * 0.9 * (i + 1)) / all.length)
      .then(() => { liveText.textContent = all.slice(0, i + 1).join(" "); })));
  }

  // In Notes each take lands as a new line. In Claude Code it lands in the input
  // box, is sent, and Claude answers.
  function place(where, text, reply) {
    if (where === "term") {
      const input = windows.term.querySelector(".cc-input .doc-text");
      const log = windows.term.querySelector(".cc-log");
      input.textContent = text;
      input.classList.add("landed");
      wait(900).then(() => {
        input.textContent = "";
        input.classList.remove("landed");
        const you = document.createElement("p");
        you.className = "cc-you";
        you.textContent = "❯ " + text;
        const says = document.createElement("p");
        says.className = "cc-says";
        says.textContent = reply;
        log.append(you, says);
        while (log.children.length > 6) log.firstElementChild.remove();
      });
      return;
    }
    const box = windows[where].querySelector(".doc");
    const current = box.querySelector(".now");
    const caret = current.querySelector(".caret");
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
      const [where, text, reply] = takes[n++ % takes.length];
      focus(where);
      await wait(1400);
      key.classList.add("down");
      o.size(1);
      await wait(350);
      await Promise.all([speak(2600), words(text, 2600)]);
      key.classList.remove("down");
      o.writing(true);
      await wait(520);
      live.classList.remove("on");
      place(where, text, reply);
      o.writing(false);
      o.size(0.12);
      await wait(2400);
    }
    running = false;
  }

  if (calm.matches) {
    focus("term");
    place("term", takes[0][1], takes[0][2]);
    liveText.textContent = takes[0][1];
    live.classList.add("on");
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
