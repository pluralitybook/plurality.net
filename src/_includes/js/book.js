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

  // Intercept navigation clicks on prev/next links
  var navLinks = document.querySelectorAll(".book__nav-link[data-page-dir]");
  navLinks.forEach(function (link) {
    link.addEventListener("click", function (e) {
      var dir = link.getAttribute("data-page-dir");
      var href = link.getAttribute("href");
      if (!href) return;

      e.preventDefault();

      // Animate out
      var outClass = dir === "next" ? "book__page--flip-out-next" : "book__page--flip-out-prev";
      page.classList.add(outClass);

      // Navigate after animation
      setTimeout(function () {
        // Store the direction so the incoming page can animate in
        try {
          sessionStorage.setItem("book-flip-dir", dir);
        } catch (ex) { /* ignore */ }
        window.location.href = href;
      }, 280);
    });
  });

  // Animate in on page load if we came from a flip
  try {
    var flipDir = sessionStorage.getItem("book-flip-dir");
    if (flipDir) {
      sessionStorage.removeItem("book-flip-dir");
      var inClass = flipDir === "next" ? "book__page--flip-in-next" : "book__page--flip-in-prev";
      page.classList.add(inClass);
      page.addEventListener("animationend", function () {
        page.classList.remove(inClass);
      }, { once: true });
    }
  } catch (ex) { /* ignore */ }

  // ── Keyboard navigation: arrow keys for prev/next ──
  document.addEventListener("keydown", function (e) {
    // Don't trigger if user is typing in an input
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
