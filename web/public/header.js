// The floating nav appears when the hero's large wordmark has scrolled away.
const bar = document.querySelector("header.bar");
const hero = document.querySelector(".hero");
if (bar && hero) {
  const place = () => bar.classList.toggle("away", hero.getBoundingClientRect().bottom > 140);
  place();
  addEventListener("scroll", place, { passive: true });
  addEventListener("resize", place);
}
