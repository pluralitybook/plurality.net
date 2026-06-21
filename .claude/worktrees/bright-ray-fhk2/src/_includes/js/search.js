(function () {
  var overlay = document.getElementById('search-overlay');
  var container = document.getElementById('search-container');
  if (!overlay || !container) return;

  var instance = null;
  var suggestions = [];
  var dropdown = null;
  var activeIdx = -1;
  var input = null;
  var suppressHide = false;

  // Build suggestions array from datalist, then remove it
  var datalist = document.getElementById('search-suggestions');
  if (datalist) {
    var opts = datalist.querySelectorAll('option');
    for (var i = 0; i < opts.length; i++) {
      if (opts[i].value) suggestions.push(opts[i].value);
    }
    datalist.remove();
  }

  var pageLang = document.documentElement.lang || 'en';
  var isLatinQuery = function (q) { return /^[\x00-\x7F]+$/.test(q); };
  var isLatinTerm = function (t) { return /^[\x00-\x7F]/.test(t); };

  // Match: word-start for Latin, substring for CJK/non-Latin
  function matchTerm(term, query) {
    var q = query.toLowerCase();
    var t = term.toLowerCase();
    // For non-Latin queries (CJK, Thai, Greek, etc.), use substring match
    if (!isLatinQuery(q)) {
      return t.indexOf(q) !== -1;
    }
    // For Latin queries, word-start match
    var words = t.split(/[\s\-\/\(]+/);
    for (var i = 0; i < words.length; i++) {
      if (words[i].indexOf(q) === 0) return true;
    }
    return false;
  }

  // Sort: native-script terms first on non-English pages
  function sortMatches(matches) {
    if (pageLang === 'en') return matches;
    return matches.sort(function (a, b) {
      var aLatin = isLatinTerm(a);
      var bLatin = isLatinTerm(b);
      if (aLatin === bLatin) return 0;
      return aLatin ? 1 : -1;
    });
  }

  function positionDropdown() {
    if (!dropdown || !input) return;
    var rect = input.getBoundingClientRect();
    var overlayRect = overlay.getBoundingClientRect();
    dropdown.style.top = (rect.bottom - overlayRect.top + 4) + 'px';
    dropdown.style.left = (rect.left - overlayRect.left) + 'px';
    dropdown.style.width = rect.width + 'px';
  }

  function showSuggestions(query) {
    if (!dropdown) return;
    activeIdx = -1;
    dropdown.innerHTML = '';

    if (!query || query.length < 1) {
      dropdown.hidden = true;
      if (input) input.removeAttribute('aria-activedescendant');
      return;
    }

    var raw = [];
    for (var i = 0; i < suggestions.length && raw.length < 20; i++) {
      if (matchTerm(suggestions[i], query)) raw.push(suggestions[i]);
    }
    var matches = sortMatches(raw).slice(0, 8);

    if (matches.length === 0) {
      dropdown.hidden = true;
      if (input) input.removeAttribute('aria-activedescendant');
      return;
    }

    for (var j = 0; j < matches.length; j++) {
      var li = document.createElement('li');
      li.className = 'search-suggest__item';
      li.setAttribute('role', 'option');
      li.id = 'suggest-' + j;
      li.textContent = matches[j];
      li.addEventListener('mousedown', (function (val) {
        return function (e) {
          e.preventDefault();
          e.stopPropagation();
          suppressHide = true;
          selectSuggestion(val);
        };
      })(matches[j]));
      dropdown.appendChild(li);
    }

    positionDropdown();
    dropdown.hidden = false;
  }

  function selectSuggestion(value) {
    if (!input) return;
    var nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    nativeSetter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    dropdown.hidden = true;
    activeIdx = -1;
    input.removeAttribute('aria-activedescendant');
    input.focus();
    suppressHide = false;
  }

  function handleKeydown(e) {
    if (!dropdown || dropdown.hidden) return;
    var items = dropdown.querySelectorAll('.search-suggest__item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
      updateActive(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, -1);
      updateActive(items);
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      selectSuggestion(items[activeIdx].textContent);
    }
  }

  function updateActive(items) {
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('search-suggest__item--active', i === activeIdx);
    }
    if (input) {
      if (activeIdx >= 0) {
        input.setAttribute('aria-activedescendant', 'suggest-' + activeIdx);
        items[activeIdx].scrollIntoView({ block: 'nearest' });
      } else {
        input.removeAttribute('aria-activedescendant');
      }
    }
  }

  function initDropdown() {
    dropdown = document.createElement('ul');
    dropdown.className = 'search-suggest';
    dropdown.setAttribute('role', 'listbox');
    dropdown.id = 'search-suggest-list';
    dropdown.hidden = true;
    // Append to the overlay itself, not inside Pagefind's DOM
    overlay.appendChild(dropdown);
  }

  function open() {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (!instance) {
      var uiTranslations = {
        en: {
          placeholder: "Search the book\u2026",
          zero_results: "No results for [SEARCH_TERM]"
        },
        zh: {
          placeholder: "\u641c\u5c0b\u672c\u66f8\u2026",
          zero_results: "\u627e\u4e0d\u5230 [SEARCH_TERM] \u7684\u76f8\u95dc\u7d50\u679c",
          many_results: "\u627e\u5230 [COUNT] \u500b [SEARCH_TERM] \u7684\u76f8\u95dc\u7d50\u679c",
          one_result: "\u627e\u5230 [COUNT] \u500b [SEARCH_TERM] \u7684\u76f8\u95dc\u7d50\u679c",
          search_label: "\u641c\u5c0b",
          clear_search: "\u6e05\u9664",
          load_more: "\u8f09\u5165\u66f4\u591a",
          searching: "\u641c\u5c0b [SEARCH_TERM] \u4e2d\u2026"
        },
        ja: {
          placeholder: "\u672c\u3092\u691c\u7d22\u2026",
          zero_results: "[SEARCH_TERM] \u306e\u691c\u7d22\u7d50\u679c\u306f\u3042\u308a\u307e\u305b\u3093",
          many_results: "[SEARCH_TERM] \u306e\u691c\u7d22\u7d50\u679c [COUNT] \u4ef6",
          one_result: "[SEARCH_TERM] \u306e\u691c\u7d22\u7d50\u679c [COUNT] \u4ef6",
          search_label: "\u691c\u7d22",
          clear_search: "\u30af\u30ea\u30a2",
          load_more: "\u3082\u3063\u3068\u898b\u308b",
          searching: "[SEARCH_TERM] \u3092\u691c\u7d22\u4e2d\u2026"
        },
        de: {
          placeholder: "Buch durchsuchen\u2026",
          zero_results: "Keine Ergebnisse f\u00fcr [SEARCH_TERM]",
          many_results: "[COUNT] Ergebnisse f\u00fcr [SEARCH_TERM]",
          one_result: "[COUNT] Ergebnis f\u00fcr [SEARCH_TERM]",
          search_label: "Suche",
          clear_search: "L\u00f6schen",
          load_more: "Mehr laden",
          searching: "Suche nach [SEARCH_TERM]\u2026"
        },
        th: {
          placeholder: "\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e43\u0e19\u0e2b\u0e19\u0e31\u0e07\u0e2a\u0e37\u0e2d\u2026",
          zero_results: "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1c\u0e25\u0e25\u0e31\u0e1e\u0e18\u0e4c\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a [SEARCH_TERM]",
          many_results: "\u0e1e\u0e1a [COUNT] \u0e1c\u0e25\u0e25\u0e31\u0e1e\u0e18\u0e4c\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a [SEARCH_TERM]",
          one_result: "\u0e1e\u0e1a [COUNT] \u0e1c\u0e25\u0e25\u0e31\u0e1e\u0e18\u0e4c\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a [SEARCH_TERM]",
          search_label: "\u0e04\u0e49\u0e19\u0e2b\u0e32",
          clear_search: "\u0e25\u0e49\u0e32\u0e07",
          load_more: "\u0e42\u0e2b\u0e25\u0e14\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e40\u0e15\u0e34\u0e21",
          searching: "\u0e01\u0e33\u0e25\u0e31\u0e07\u0e04\u0e49\u0e19\u0e2b\u0e32 [SEARCH_TERM]\u2026"
        },
        el: {
          placeholder: "\u0391\u03bd\u03b1\u03b6\u03ae\u03c4\u03b7\u03c3\u03b7 \u03c3\u03c4\u03bf \u03b2\u03b9\u03b2\u03bb\u03af\u03bf\u2026",
          zero_results: "\u0394\u03b5\u03bd \u03b2\u03c1\u03ad\u03b8\u03b7\u03ba\u03b1\u03bd \u03b1\u03c0\u03bf\u03c4\u03b5\u03bb\u03ad\u03c3\u03bc\u03b1\u03c4\u03b1 \u03b3\u03b9\u03b1 [SEARCH_TERM]",
          many_results: "\u0392\u03c1\u03ad\u03b8\u03b7\u03ba\u03b1\u03bd [COUNT] \u03b1\u03c0\u03bf\u03c4\u03b5\u03bb\u03ad\u03c3\u03bc\u03b1\u03c4\u03b1 \u03b3\u03b9\u03b1 [SEARCH_TERM]",
          one_result: "\u0392\u03c1\u03ad\u03b8\u03b7\u03ba\u03b5 [COUNT] \u03b1\u03c0\u03bf\u03c4\u03ad\u03bb\u03b5\u03c3\u03bc\u03b1 \u03b3\u03b9\u03b1 [SEARCH_TERM]",
          search_label: "\u0391\u03bd\u03b1\u03b6\u03ae\u03c4\u03b7\u03c3\u03b7",
          clear_search: "\u039a\u03b1\u03b8\u03b1\u03c1\u03b9\u03c3\u03bc\u03cc\u03c2",
          load_more: "\u03a0\u03b5\u03c1\u03b9\u03c3\u03c3\u03cc\u03c4\u03b5\u03c1\u03b1",
          searching: "\u0391\u03bd\u03b1\u03b6\u03ae\u03c4\u03b7\u03c3\u03b7 [SEARCH_TERM]\u2026"
        }
      };
      instance = new PagefindUI({
        element: container,
        showSubResults: true,
        showImages: false,
        translations: uiTranslations[pageLang] || uiTranslations.en
      });
    }
    setTimeout(function () {
      input = container.querySelector('input');
      if (input && suggestions.length && !dropdown) {
        initDropdown();

        input.setAttribute('role', 'combobox');
        input.setAttribute('aria-autocomplete', 'list');
        input.setAttribute('aria-controls', 'search-suggest-list');
        input.setAttribute('autocomplete', 'off');

        input.addEventListener('input', function () {
          showSuggestions(input.value);
        });
        input.addEventListener('keydown', handleKeydown);
        input.addEventListener('focus', function () {
          if (input.value.length >= 1) showSuggestions(input.value);
        });
        input.addEventListener('blur', function () {
          if (suppressHide) return;
          setTimeout(function () {
            if (dropdown) dropdown.hidden = true;
          }, 200);
        });
      }
      if (input) input.focus();
    }, 100);
  }

  function close() {
    overlay.classList.remove('active');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (dropdown) dropdown.hidden = true;
  }

  document.querySelectorAll('.search-toggle').forEach(function (btn) {
    btn.addEventListener('click', open);
  });

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      overlay.classList.contains('active') ? close() : open();
    }
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      close();
    }
  });
})();
