// Keep the copy control working under the production script policy.
const copy = document.getElementById("copy-brew");
const icon = copy?.innerHTML;
copy?.addEventListener("click", async () => {
  await navigator.clipboard.writeText("brew install --cask alcun/tap/heyra");
  copy.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="#d9a86a" stroke-width="1.6" d="M3.5 8.5l3 3 6-7"/></svg>';
  setTimeout(() => { copy.innerHTML = icon; }, 1500);
});
