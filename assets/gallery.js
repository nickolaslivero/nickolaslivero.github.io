(() => {
  const init = () => {
    const dialog = document.getElementById("project-gallery-dialog");
    if (!dialog || typeof dialog.showModal !== "function" || typeof dialog.close !== "function") return;

    const title = dialog.querySelector("#gallery-title");
    const image = dialog.querySelector("#gallery-image");
    const caption = dialog.querySelector("#gallery-caption");
    const count = dialog.querySelector("#gallery-count");
    const status = dialog.querySelector("#gallery-status");
    const close = dialog.querySelector("#gallery-close");
    const prev = dialog.querySelector("#gallery-prev");
    const next = dialog.querySelector("#gallery-next");
    const error = dialog.querySelector("#gallery-error");
    const original = dialog.querySelector("#gallery-original");
    if (!title || !image || !caption || !count || !close || !prev || !next || !error ||
        !error.textContent.trim()) return;

    const previewPath = /^assets\/previews\/[a-z0-9-]+\.(?:jpg|png)$/;
    const galleries = [];
    for (const project of document.querySelectorAll(".project-gallery")) {
      const trigger = project.querySelector("button.gallery-trigger");
      const list = project.querySelector("ul.gallery-links");
      const galleryTitle = project.getAttribute("data-gallery-title");
      if (!trigger || !list || !galleryTitle?.trim()) continue;

      const slides = Array.from(list.querySelectorAll(":scope > li > a"), (link) => ({
        src: link.getAttribute("href") ?? "",
        caption: link.getAttribute("data-caption") ?? "",
      }));
      if (slides.length < 1 || slides.length > 3 || slides.some((slide) =>
        !previewPath.test(slide.src) || slide.src !== slide.src.trim() || !slide.caption.trim())) continue;
      galleries.push({ trigger, list, title: galleryTitle, slides });
    }
    if (!galleries.length) return;

    let active = null;
    let index = 0;
    let loadVersion = 0;

    const showSlide = (position) => {
      if (!active || position < 0 || position >= active.slides.length) return;
      index = position;
      const slide = active.slides[index];
      original?.setAttribute("href", slide.src);
      const version = ++loadVersion;
      image.hidden = true;
      image.alt = slide.caption;
      caption.textContent = slide.caption;
      count.textContent = `${index + 1} / ${active.slides.length}`;
      if (status) status.textContent = `${slide.caption} (${count.textContent})`;
      const focusedControl = document.activeElement;
      if ((focusedControl === prev && index === 0) ||
          (focusedControl === next && index === active.slides.length - 1)) close.focus();
      prev.disabled = index === 0;
      next.disabled = index === active.slides.length - 1;
      prev.hidden = next.hidden = active.slides.length === 1;
      error.hidden = true;
      image.setAttribute("aria-busy", "true");

      // Ignore callbacks from a superseded selection or a closed dialog.
      image.onload = () => {
        if (!active || version !== loadVersion) return;
        image.hidden = false;
        image.setAttribute("aria-busy", "false");
      };
      image.onerror = () => {
        if (!active || version !== loadVersion) return;
        image.hidden = true;
        image.setAttribute("aria-busy", "false");
        error.hidden = false;
      };
      image.loading = "eager";
      image.src = slide.src;
    };

    prev.addEventListener("click", () => showSlide(index - 1));
    next.addEventListener("click", () => showSlide(index + 1));
    close.addEventListener("click", () => dialog.close());

    dialog.addEventListener("keydown", (event) => {
      if (!dialog.open || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        showSlide(index + (event.key === "ArrowLeft" ? -1 : 1));
      }
    });

    dialog.addEventListener("click", (event) => {
      if (!dialog.open || event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });

    dialog.addEventListener("close", () => {
      const trigger = active?.trigger;
      active = null;
      loadVersion += 1;
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("src");
      original?.removeAttribute("href");
      image.alt = "";
      image.hidden = true;
      image.setAttribute("aria-busy", "false");
      title.textContent = "";
      caption.textContent = "";
      count.textContent = "";
      if (status) status.textContent = "";
      error.hidden = true;
      prev.disabled = true;
      next.disabled = true;
      trigger?.focus();
    });

    for (const gallery of galleries) {
      gallery.trigger.addEventListener("click", () => {
        if (dialog.open) return;
        active = gallery;
        title.textContent = gallery.title;
        try {
          dialog.showModal();
        } catch (cause) {
          active = null;
          title.textContent = "";
          for (const fallback of galleries) {
            fallback.list.hidden = false;
            fallback.trigger.hidden = true;
          }
          throw cause;
        }
        showSlide(0);
        close.focus();
      });
      gallery.list.hidden = true;
      gallery.trigger.hidden = false;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
