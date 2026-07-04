(function () {
  var STORAGE_KEY = "plurality-theme";

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }

  function storageSet(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* private browsing */ }
  }

  function getPreferred() {
    var stored = storageGet(STORAGE_KEY);
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function apply(theme, persist) {
    document.documentElement.setAttribute("data-theme", theme);
    if (persist) storageSet(STORAGE_KEY, theme);
    // Only update buttons if DOM is ready
    if (document.readyState !== "loading") updateButtons(theme);
  }

  function updateButtons(theme) {
    var btns = document.querySelectorAll(".theme-toggle");
    btns.forEach(function (btn) {
      var moon = btn.querySelector(".theme-icon--moon");
      var sun = btn.querySelector(".theme-icon--sun");
      if (moon) moon.style.display = theme === "dark" ? "none" : "";
      if (sun) sun.style.display = theme === "dark" ? "" : "none";
      btn.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    });
  }

  // Apply immediately to prevent flash (don't persist)
  apply(getPreferred(), false);

  // Bind toggle buttons once DOM is ready
  document.addEventListener("DOMContentLoaded", function () {
    updateButtons(getPreferred());
    document.querySelectorAll(".theme-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var current = document.documentElement.getAttribute("data-theme") || getPreferred();
        var next = current === "dark" ? "light" : "dark";
        apply(next, true);
      });
    });
  });

  // Listen for system preference changes (only if user hasn't manually chosen)
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (e) {
    if (!storageGet(STORAGE_KEY)) {
      apply(e.matches ? "dark" : "light", false);
    }
  });
})();
