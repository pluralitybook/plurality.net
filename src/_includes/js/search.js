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

  // Detect whether Fuse.js should be used (zh/ja pages with Fuse loaded)
  var useFuse = typeof Fuse !== 'undefined' && (pageLang === 'zh' || pageLang === 'ja');

  // Fuse.js state
  var fuseIndex = null;       // Fuse instance for full-text (searches subsections)
  var fuseSuggestions = null;  // Fuse instance for autocomplete terms
  var fuseLoading = false;
  var fuseLoaded = false;
  var fuseSearchInput = null;
  var fuseClearBtn = null;
  var fuseResultsEl = null;
  var fuseMessageEl = null;
  var fuseDebounceTimer = null;
  var fuseChapters = null;     // raw chapter data for excerpt building

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

  var t = uiTranslations[pageLang] || uiTranslations.en;

  // ── Matching helpers (used for non-Fuse autocomplete) ──

  function matchTerm(term, query) {
    var q = query.toLowerCase();
    var tl = term.toLowerCase();
    if (!isLatinQuery(q)) {
      return tl.indexOf(q) !== -1;
    }
    var words = tl.split(/[\s\-\/\(]+/);
    for (var i = 0; i < words.length; i++) {
      if (words[i].indexOf(q) === 0) return true;
    }
    return false;
  }

  function sortMatches(matches) {
    if (pageLang === 'en') return matches;
    return matches.sort(function (a, b) {
      var aLatin = isLatinTerm(a);
      var bLatin = isLatinTerm(b);
      if (aLatin === bLatin) return 0;
      return aLatin ? 1 : -1;
    });
  }

  // ── Autocomplete dropdown ──

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

    var matches;
    if (useFuse && fuseSuggestions) {
      var fuseResults = fuseSuggestions.search(query, { limit: 20 });
      var raw = [];
      for (var i = 0; i < fuseResults.length; i++) {
        raw.push(fuseResults[i].item);
      }
      matches = sortMatches(raw).slice(0, 8);
    } else {
      var raw = [];
      for (var i = 0; i < suggestions.length && raw.length < 20; i++) {
        if (matchTerm(suggestions[i], query)) raw.push(suggestions[i]);
      }
      matches = sortMatches(raw).slice(0, 8);
    }

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
    overlay.appendChild(dropdown);
  }

  // ── Fuse.js helpers ──

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Strip CJK punctuation for normalized matching
  // Handles ・、，。；：！？「」『』（）【】…—～ etc.
  var cjkPunct = /[・\u30FB、，。；：！？「」『』（）〔〕【】…—～·\u00B7]/g;

  // Build a position map: for each char in the normalized string,
  // store its original index in the source string
  function buildNormMap(str) {
    var norm = '';
    var map = [];
    for (var i = 0; i < str.length; i++) {
      if (!cjkPunct.test(str[i])) {
        map.push(i);
        norm += str[i];
      }
      cjkPunct.lastIndex = 0; // reset regex state
    }
    return { norm: norm, map: map };
  }

  function buildExcerpt(content, query) {
    if (!content) return '';
    var ctxChars = 40;

    // 1. Try exact substring match first
    var lowerContent = content.toLowerCase();
    var lowerQuery = query.toLowerCase();
    var idx = lowerContent.indexOf(lowerQuery);

    if (idx !== -1) {
      var start = Math.max(0, idx - ctxChars);
      var end = Math.min(content.length, idx + query.length + ctxChars);
      return (start > 0 ? '\u2026' : '') +
        escapeHtml(content.substring(start, idx)) +
        '<mark>' + escapeHtml(content.substring(idx, idx + query.length)) + '</mark>' +
        escapeHtml(content.substring(idx + query.length, end)) +
        (end < content.length ? '\u2026' : '');
    }

    // 2. Try normalized match (strip CJK punctuation from both sides)
    var info = buildNormMap(lowerContent);
    var normQuery = lowerQuery.replace(cjkPunct, '');
    cjkPunct.lastIndex = 0;
    var normIdx = info.norm.indexOf(normQuery);

    if (normIdx !== -1 && normQuery.length > 0) {
      // Map back to original content positions
      var origStart = info.map[normIdx];
      var origEnd = info.map[normIdx + normQuery.length - 1] + 1;
      var winStart = Math.max(0, origStart - ctxChars);
      var winEnd = Math.min(content.length, origEnd + ctxChars);
      return (winStart > 0 ? '\u2026' : '') +
        escapeHtml(content.substring(winStart, origStart)) +
        '<mark>' + escapeHtml(content.substring(origStart, origEnd)) + '</mark>' +
        escapeHtml(content.substring(origEnd, winEnd)) +
        (winEnd < content.length ? '\u2026' : '');
    }

    // 3. Fallback: show beginning of content
    var slice = content.substring(0, 100);
    return escapeHtml(slice) + (content.length > 100 ? '\u2026' : '');
  }

  function formatMessage(template, count, term) {
    return template.replace('[COUNT]', count).replace('[SEARCH_TERM]', term);
  }

  // Search the flat subsection index with Fuse, then group results by chapter
  function renderFuseResults(query) {
    if (!fuseIndex || !fuseResultsEl || !fuseMessageEl) return;

    if (!query || !query.trim()) {
      fuseMessageEl.textContent = '';
      fuseResultsEl.innerHTML = '';
      return;
    }

    var results = fuseIndex.search(query, { limit: 40 });

    // Group results by chapter URL
    var grouped = [];
    var chapterMap = {};
    for (var i = 0; i < results.length; i++) {
      var item = results[i].item;
      var key = item.chapterUrl;
      if (!chapterMap[key]) {
        chapterMap[key] = {
          title: item.chapterTitle,
          section: item.chapterSection,
          url: item.chapterUrl,
          subResults: [],
        };
        grouped.push(chapterMap[key]);
      }
      // Max 3 sub-results per chapter (matches PageFind behavior)
      if (chapterMap[key].subResults.length < 3) {
        chapterMap[key].subResults.push({
          heading: item.heading,
          anchor: item.anchor,
          content: item.content,
          score: results[i].score,
        });
      }
    }

    // Limit to 10 chapter-level results
    grouped = grouped.slice(0, 10);

    // Count
    var count = grouped.length;
    var msgTemplate;
    if (count === 0) {
      msgTemplate = t.zero_results || 'No results for [SEARCH_TERM]';
    } else if (count === 1) {
      msgTemplate = t.one_result || t.many_results || '[COUNT] results for [SEARCH_TERM]';
    } else {
      msgTemplate = t.many_results || '[COUNT] results for [SEARCH_TERM]';
    }
    fuseMessageEl.textContent = formatMessage(msgTemplate, count, query);

    // Render results
    var html = '';
    for (var g = 0; g < grouped.length; g++) {
      var ch = grouped[g];

      html += '<li class="pagefind-ui__result">';
      html += '<div class="pagefind-ui__result-inner">';

      // Main chapter title
      html += '<p class="pagefind-ui__result-title">';
      html += '<a class="pagefind-ui__result-link" href="' + escapeHtml(ch.url) + '">';
      html += escapeHtml(ch.title);
      html += '</a>';
      html += '</p>';

      // Sub-results (subsection anchors)
      for (var s = 0; s < ch.subResults.length; s++) {
        var sub = ch.subResults[s];
        if (!sub.heading) continue; // skip intro sections without headings

        var subUrl = ch.url + '#' + sub.anchor;
        var subExcerpt = buildExcerpt(sub.content, query);

        html += '<div class="pagefind-ui__result-nested">';
        html += '<p class="pagefind-ui__result-title">';
        html += '<a class="pagefind-ui__result-link" href="' + escapeHtml(subUrl) + '">';
        html += escapeHtml(sub.heading);
        html += '</a>';
        html += '</p>';
        html += '<p class="pagefind-ui__result-excerpt">' + subExcerpt + '</p>';
        html += '</div>';
      }

      // Section tag (matches PageFind's metadata tags)
      html += '<ul class="pagefind-ui__result-tags">';
      html += '<li class="pagefind-ui__result-tag">Section: ' + escapeHtml(ch.section) + '</li>';
      html += '</ul>';

      html += '</div>';
      html += '</li>';
    }
    fuseResultsEl.innerHTML = html;
  }

  function loadFuseIndex() {
    if (fuseLoaded || fuseLoading) return;
    fuseLoading = true;
    if (fuseMessageEl) {
      fuseMessageEl.textContent = formatMessage(t.searching || 'Loading\u2026', '', '');
    }
    fetch('/' + pageLang + '/search-index.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        fuseChapters = data;

        // Flatten chapters into subsections for Fuse indexing
        var flat = [];
        for (var c = 0; c < data.length; c++) {
          var ch = data[c];
          var subs = ch.subsections || [];
          for (var s = 0; s < subs.length; s++) {
            flat.push({
              chapterTitle: ch.title,
              chapterSection: ch.section,
              chapterUrl: ch.url,
              heading: subs[s].heading,
              anchor: subs[s].anchor,
              content: subs[s].content,
            });
          }
        }

        fuseIndex = new Fuse(flat, {
          keys: [
            { name: 'heading', weight: 2 },
            { name: 'content', weight: 1 },
            { name: 'chapterTitle', weight: 1.5 },
          ],
          includeScore: true,
          includeMatches: true,
          ignoreLocation: true,
          threshold: 0.3,
          minMatchCharLength: 1,
          findAllMatches: true,
        });
        fuseLoaded = true;
        fuseLoading = false;
        if (fuseMessageEl) fuseMessageEl.textContent = '';
        // If user already typed while loading, search now
        if (fuseSearchInput && fuseSearchInput.value.trim()) {
          renderFuseResults(fuseSearchInput.value.trim());
        }
      })
      .catch(function () {
        fuseLoading = false;
        useFuse = false;
        initPagefind();
      });
  }

  function buildFuseUI() {
    container.innerHTML = '';

    var wrapper = document.createElement('div');
    wrapper.className = 'pagefind-ui';

    var form = document.createElement('form');
    form.className = 'pagefind-ui__form';
    form.setAttribute('role', 'search');
    form.addEventListener('submit', function (e) { e.preventDefault(); });

    fuseSearchInput = document.createElement('input');
    fuseSearchInput.className = 'pagefind-ui__search-input';
    fuseSearchInput.type = 'text';
    fuseSearchInput.placeholder = t.placeholder || 'Search\u2026';

    fuseClearBtn = document.createElement('button');
    fuseClearBtn.className = 'pagefind-ui__search-clear';
    fuseClearBtn.type = 'button';
    fuseClearBtn.textContent = t.clear_search || 'Clear';
    fuseClearBtn.style.display = 'none';

    form.appendChild(fuseSearchInput);
    form.appendChild(fuseClearBtn);

    var drawer = document.createElement('div');
    drawer.className = 'pagefind-ui__drawer';

    fuseMessageEl = document.createElement('div');
    fuseMessageEl.className = 'pagefind-ui__message';

    fuseResultsEl = document.createElement('ol');
    fuseResultsEl.className = 'pagefind-ui__results';

    drawer.appendChild(fuseMessageEl);
    drawer.appendChild(fuseResultsEl);

    wrapper.appendChild(form);
    wrapper.appendChild(drawer);
    container.appendChild(wrapper);

    // Input handler with debounce for full-text, immediate for autocomplete
    fuseSearchInput.addEventListener('input', function () {
      var val = fuseSearchInput.value;
      fuseClearBtn.style.display = val.length > 0 ? '' : 'none';
      showSuggestions(val);
      clearTimeout(fuseDebounceTimer);
      fuseDebounceTimer = setTimeout(function () {
        renderFuseResults(val.trim());
      }, 200);
    });

    fuseClearBtn.addEventListener('click', function () {
      fuseSearchInput.value = '';
      fuseClearBtn.style.display = 'none';
      fuseResultsEl.innerHTML = '';
      fuseMessageEl.textContent = '';
      if (dropdown) dropdown.hidden = true;
      fuseSearchInput.focus();
    });

    input = fuseSearchInput;

    fuseSearchInput.addEventListener('keydown', handleKeydown);
    fuseSearchInput.addEventListener('focus', function () {
      if (fuseSearchInput.value.length >= 1) showSuggestions(fuseSearchInput.value);
    });
    fuseSearchInput.addEventListener('blur', function () {
      if (suppressHide) return;
      setTimeout(function () {
        if (dropdown) dropdown.hidden = true;
      }, 200);
    });
  }

  function initPagefind() {
    if (instance) return;
    var opts = {
      element: container,
      showSubResults: true,
      showImages: false,
      translations: t
    };
    // Pre-filter to current language so the filter panel doesn't show
    opts.mergeFilter = {};
    opts.mergeFilter.lang = [pageLang];
    instance = new PagefindUI(opts);
  }

  function initFuseSuggestions() {
    if (fuseSuggestions || !suggestions.length) return;
    fuseSuggestions = new Fuse(suggestions, {
      includeScore: true,
      ignoreLocation: true,
      threshold: 0.3,
      minMatchCharLength: 1,
    });
  }

  // ── Open / Close ──

  function open() {
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    if (useFuse) {
      if (!fuseSearchInput) {
        buildFuseUI();
        initFuseSuggestions();
        if (!dropdown && suggestions.length) {
          initDropdown();
        }
        if (input && suggestions.length) {
          input.setAttribute('role', 'combobox');
          input.setAttribute('aria-autocomplete', 'list');
          input.setAttribute('aria-controls', 'search-suggest-list');
          input.setAttribute('autocomplete', 'off');
        }
        loadFuseIndex();
      }
      setTimeout(function () {
        if (fuseSearchInput) fuseSearchInput.focus();
      }, 50);
    } else {
      if (!instance) {
        initPagefind();
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
