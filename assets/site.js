(() => {
  const root = document.documentElement;
  const toggle = document.getElementById("theme-toggle");
  if (!toggle) return;
  let preference;
  try {
    preference = localStorage.getItem("portfolio-theme");
  } catch {
    // Storage can be unavailable for local files or restricted browser sessions.
  }
  const dark = preference === "dark" ||
    (preference !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const apply = (enabled) => {
    root.dataset.theme = enabled ? "dark" : "light";
    toggle.checked = enabled;
    document.querySelector('meta[name="theme-color"]').content = enabled ? "#141a17" : "#fbfcfc";
  };
  apply(dark);
  toggle.closest("label").hidden = false;
  toggle.addEventListener("change", () => {
    apply(toggle.checked);
    try {
      localStorage.setItem("portfolio-theme", root.dataset.theme);
    } catch {
      // The selected theme still works without persistent storage.
    }
  });
})();
