(function () {
  // Progressive enhancement: mark that JS is running
  document.documentElement.classList.add("js-enhanced");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.addEventListener("DOMContentLoaded", function () {
    var reveals = document.querySelectorAll(".reveal");
    if (!reveals.length) return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: "0px 0px -60px 0px" }
    );

    reveals.forEach(function (el) {
      // Stagger only direct children of grid containers (not nested .reveal elements)
      var parent = el.parentElement;
      if (parent && parent.children.length > 1 && !el.classList.contains("chapter-group") && !el.classList.contains("section")) {
        var siblingIndex = Array.prototype.indexOf.call(parent.children, el);
        el.style.transitionDelay = siblingIndex * 0.08 + "s";
      }
      observer.observe(el);
    });
  });
})();
