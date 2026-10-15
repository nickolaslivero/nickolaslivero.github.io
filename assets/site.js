(() => {
  const root = document.documentElement;
  const header = document.querySelector(".site-header");
  const updateHeaderHeight = () => {
    if (header) root.style.setProperty("--header-height", `${Math.ceil(header.getBoundingClientRect().height)}px`);
  };
  updateHeaderHeight();
  if (header && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(updateHeaderHeight).observe(header);
  } else {
    window.addEventListener("resize", updateHeaderHeight);
  }
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
    toggle.setAttribute("aria-pressed", String(enabled));
    toggle.title = enabled ? toggle.dataset.lightLabel : toggle.dataset.darkLabel;
    document.querySelector('meta[name="theme-color"]').content = enabled ? "#1b2021" : "#f7f8f7";
  };
  apply(dark);
  toggle.hidden = false;
  updateHeaderHeight();
  toggle.addEventListener("click", () => {
    apply(root.dataset.theme !== "dark");
    try {
      localStorage.setItem("portfolio-theme", root.dataset.theme);
    } catch {
      // The selected theme still works without persistent storage.
    }
  });
})();
