(function () {
  "use strict";

  // ── TOC toggle (mobile) ──
  var tocToggle = document.getElementById("toc-toggle");
  var bookToc = document.getElementById("book-toc");
  if (tocToggle && bookToc) {
    tocToggle.addEventListener("click", function () {
      var isOpen = bookToc.classList.toggle("open");
      tocToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  // ── Active heading tracking in TOC ──
  var tocLinks = document.querySelectorAll(".book__toc-list a");
  if (tocLinks.length > 0) {
    var headingIds = [];
    tocLinks.forEach(function (link) {
      var id = link.getAttribute("href");
      if (id && id.startsWith("#")) headingIds.push(id.slice(1));
    });

    var headingElements = headingIds
      .map(function (id) { return document.getElementById(id); })
      .filter(Boolean);

    if (headingElements.length > 0) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              tocLinks.forEach(function (l) { l.classList.remove("active"); });
              var activeLink = document.querySelector(
                '.book__toc-list a[href="#' + entry.target.id + '"]'
              );
              if (activeLink) activeLink.classList.add("active");
            }
          });
        },
        { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
      );

      headingElements.forEach(function (el) { observer.observe(el); });
    }
  }

  // ── Page flip transition ──
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var page = document.getElementById("book-page");
  if (!page) return;

  // Animate in on page load if we came from a flip
  try {
    var flipDir = sessionStorage.getItem("book-flip-dir");
    if (flipDir) {
      sessionStorage.removeItem("book-flip-dir");
      page.style.opacity = "0";
      page.style.transform = flipDir === "next"
        ? "translateX(40px)" : "translateX(-40px)";
      // Force reflow then animate in
      page.offsetHeight;
      page.style.transition = "opacity 0.3s ease, transform 0.3s ease";
      page.style.opacity = "1";
      page.style.transform = "translateX(0)";
      page.addEventListener("transitionend", function () {
        page.style.transition = "";
        page.style.transform = "";
      }, { once: true });
    }
  } catch (ex) { /* ignore */ }

  // Intercept nav clicks for exit animation then navigate
  var navLinks = document.querySelectorAll(".book__nav-link[data-page-dir]");
  navLinks.forEach(function (link) {
    link.addEventListener("click", function (e) {
      var dir = link.getAttribute("data-page-dir");
      var href = link.getAttribute("href");
      if (!href) return;

      e.preventDefault();

      // Scroll to top smoothly
      window.scrollTo({ top: 0, behavior: "smooth" });

      // Animate out
      page.style.transition = "opacity 0.25s ease, transform 0.25s ease";
      page.style.opacity = "0";
      page.style.transform = dir === "next"
        ? "translateX(-40px)" : "translateX(40px)";

      // Store direction and navigate
      try {
        sessionStorage.setItem("book-flip-dir", dir);
      } catch (ex) { /* ignore */ }

      setTimeout(function () {
        window.location.href = href;
      }, 250);
    });
  });

  // ── Keyboard navigation: arrow keys for prev/next ──
  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;

    var link;
    if (e.key === "ArrowLeft") {
      link = document.querySelector(".book__nav-link--prev");
    } else if (e.key === "ArrowRight") {
      link = document.querySelector(".book__nav-link--next");
    }
    if (link) link.click();
  });
})();
