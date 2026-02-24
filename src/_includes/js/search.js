(function () {
  var overlay = document.getElementById('search-overlay');
  var container = document.getElementById('search-container');
  var closeBtn = document.getElementById('search-close');
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
      instance = new PagefindUI({
        element: container,
        showSubResults: true,
        showImages: false,
        translations: {
          placeholder: "Search the book\u2026",
          zero_results: "No results for [SEARCH_TERM]"
        }
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

  if (closeBtn) closeBtn.addEventListener('click', close);

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
