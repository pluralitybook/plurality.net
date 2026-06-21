(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var nav = document.querySelector(".nav");
    var hamburger = document.querySelector(".nav__hamburger");
    var overlay = document.querySelector(".nav__overlay");

    // Scroll detection for nav background
    if (nav) {
      var onScroll = function () {
        if (window.scrollY > 10) {
          nav.classList.add("scrolled");
        } else {
          nav.classList.remove("scrolled");
        }
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    // Hamburger toggle with focus trap
    if (hamburger && overlay) {
      var focusableSelector = 'a[href], button, [tabindex]:not([tabindex="-1"])';

      function openMenu() {
        hamburger.classList.add("active");
        overlay.classList.add("active");
        document.body.style.overflow = "hidden";
        hamburger.setAttribute("aria-expanded", "true");
        overlay.setAttribute("aria-modal", "true");
        // Focus first link in overlay
        var firstFocusable = overlay.querySelector(focusableSelector);
        if (firstFocusable) firstFocusable.focus();
      }

      function closeMenu() {
        hamburger.classList.remove("active");
        overlay.classList.remove("active");
        document.body.style.overflow = "";
        hamburger.setAttribute("aria-expanded", "false");
        overlay.removeAttribute("aria-modal");
        hamburger.focus();
      }

      hamburger.addEventListener("click", function () {
        if (overlay.classList.contains("active")) {
          closeMenu();
        } else {
          openMenu();
        }
      });

      // Close on link click
      overlay.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", closeMenu);
      });

      // Close on Escape
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && overlay.classList.contains("active")) {
          closeMenu();
        }
      });

      // Focus trap within overlay
      overlay.addEventListener("keydown", function (e) {
        if (e.key !== "Tab") return;
        var focusable = overlay.querySelectorAll(focusableSelector);
        if (!focusable.length) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      });
    }

    // TOC toggle for reader
    var tocToggle = document.querySelector(".reader__toc-toggle");
    var toc = document.querySelector(".reader__toc");
    if (tocToggle && toc) {
      tocToggle.addEventListener("click", function () {
        toc.classList.toggle("open");
        var isOpen = toc.classList.contains("open");
        tocToggle.setAttribute("aria-expanded", isOpen);
        tocToggle.textContent = isOpen ? "Hide Table of Contents" : "Table of Contents";
      });
    }
  });
})();
