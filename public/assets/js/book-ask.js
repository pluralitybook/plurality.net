/**
 * Plurality book AI search — streams from plurality-ask worker (sayit-style UX).
 */
(function () {
  var overlay = document.getElementById('search-overlay');
  var inner = overlay && overlay.querySelector('.search-overlay__inner');
  if (!overlay || !inner) return;

  var pageLang = document.documentElement.dataset.lang || document.documentElement.lang || 'en';
  var askAnswer = document.getElementById('plurality-ask-answer');
  if (!askAnswer) return;

  var askAvailable = false;
  var askLoading = false;
  var askAbort = null;
  var HISTORY_KEY = 'plurality-ask-history-v1';
  var askHistoryEl = document.getElementById('plurality-ask-history');
  var askHints = {
    en: 'Press Enter \u23ce to ask the AI about the book',
    zh: '\u6309 Enter \u23ce \u7531 AI \u4f9d\u66f8\u4e2d\u5167\u5bb9\u56de\u7b54',
    ja: 'Enter \u23ce \u3067 AI \u304c\u672c\u306e\u5185\u5bb9\u304b\u3089\u56de\u7b54\u3057\u307e\u3059',
    de: 'Enter ⏎ drücken, um die KI zum Buch zu befragen',
    th: 'กด Enter ⏎ เพื่อถาม AI เกี่ยวกับหนังสือเล่มนี้',
    el: 'Πατήστε Enter ⏎ για να ρωτήσετε την ΤΝ σχετικά με το βιβλίο',
  };

  function isLocalDevAskHost() {
    var host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') return false;
    var port = window.location.port;
    return port === '8080' || port === '';
  }

  function resolveAskBaseUrl() {
    if (!isLocalDevAskHost()) {
      return 'https://plurality-ask.audreyt.workers.dev';
    }
    try {
      var o = new URLSearchParams(window.location.search).get('ask_base');
      if (o) return o.replace(/\/$/, '');
    } catch { /* ignore */ }
    return 'http://127.0.0.1:8788';
  }

  var ASK_BASE = resolveAskBaseUrl();

  function askEndpoint(q) {
    var base = ASK_BASE + '/au/' + encodeURIComponent(q.trim());
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'lang=' + encodeURIComponent(pageLang);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function isSafeHttpUrl(value) {
    if (/[\s"'<>]/.test(value) || /&(quot|#39|lt|gt);/i.test(value)) return false;
    try {
      var url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function sanitizeHtml(html) {
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var blocked = doc.body.querySelectorAll('script, iframe, object, embed, base, meta, link');
    for (var i = 0; i < blocked.length; i++) blocked[i].remove();

    var walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
    var element = walker.nextNode();
    while (element) {
      var attrs = Array.prototype.slice.call(element.attributes);
      for (var j = 0; j < attrs.length; j++) {
        var attr = attrs[j];
        var name = attr.name.toLowerCase();
        if (name.indexOf('on') === 0 || name === 'srcdoc' || name === 'style') {
          element.removeAttribute(attr.name);
          continue;
        }
        if (/^(href|src|xlink:href|action|formaction|poster)$/i.test(name) && !isSafeHttpUrl(attr.value)) {
          element.removeAttribute(attr.name);
        }
      }
      if (element.tagName.toLowerCase() === 'a') {
        element.setAttribute('target', '_blank');
        element.setAttribute('rel', 'nofollow noopener noreferrer');
      }
      element = walker.nextNode();
    }

    return doc.body.innerHTML;
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  /** ask.archive.tw parity: [^n] defs + clickable superscript citations */
  function parseAnswer(raw) {
    var sources = [];
    var seen = new Map();
    var body = raw.replace(
      /^\[\^(\d+)\]:\s*\[([^\]]*)\]\(([^)\s]+)\)\s*$/gm,
      function (_m, num, label, href) {
        if (!isSafeHttpUrl(href)) return '';
        var index = Number(num);
        if (!seen.has(index)) {
          seen.set(index, { index: index, label: (label || '').trim() || href, href: href });
        }
        return '';
      },
    ).trim();

    sources = Array.from(seen.values()).sort(function (a, b) { return a.index - b.index; });
    var hrefByIndex = new Map(sources.map(function (s) { return [s.index, s.href]; }));

    var html = escapeHtml(body);
    html = html.replace(
      /^(#{1,6})[ \t]+([^\n]+?)[ \t]*(?:\n|$)/gm,
      function (_m, hashes, text) {
        return '<h' + hashes.length + '>' + text + '</h' + hashes.length + '>';
      },
    );
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    html = html.replace(
      /\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      function (_m, label, href) {
        if (!isSafeHttpUrl(href)) return label;
        return (
          '<a href="' + escapeAttribute(href) +
          '" target="_blank" rel="noopener noreferrer">' + label + '</a>'
        );
      },
    );
    html = html.replace(/\[\^(\d+)\]/g, function (m, num) {
      var href = hrefByIndex.get(Number(num));
      if (!href) return m;
      return (
        '<sup class="cite"><a href="' + escapeAttribute(href) +
        '" target="_blank" rel="noopener noreferrer">[' + num + ']</a></sup>'
      );
    });
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    if (html) html = '<p>' + html + '</p>';
    return { html: sanitizeHtml(html), sources: sources };
  }

  function renderAsk(raw, loading, err) {
    if (err) {
      askAnswer.hidden = false;
      askAnswer.innerHTML = '<p class="plurality-ask-answer__error">' + sanitizeHtml(escapeHtml(err)) + '</p>';
      return;
    }
    askAnswer.hidden = false;
    var parsed = raw ? parseAnswer(raw) : { html: '', sources: [] };
    var body = parsed.html;
    var cursor = loading ? '<span class="plurality-ask-answer__cursor" aria-hidden="true">▌</span>' : '';
    var sourcesHtml = '';
    if (parsed.sources.length > 0) {
      sourcesHtml = '<div class="plurality-ask-answer__sources"><h3>Sources</h3><ol>';
      for (var i = 0; i < parsed.sources.length; i++) {
        var source = parsed.sources[i];
        sourcesHtml += '<li value="' + source.index + '"><a href="' + escapeAttribute(source.href) +
          '" target="_blank" rel="noopener noreferrer">' + escapeHtml(source.label) + '</a></li>';
      }
      sourcesHtml += '</ol></div>';
    }
    askAnswer.innerHTML =
      '<div class="plurality-ask-answer__body">' + body + cursor + '</div>' + sourcesHtml;
  }

  function readHistory() {
    try {
      var data = JSON.parse(sessionStorage.getItem(HISTORY_KEY));
      if (!Array.isArray(data)) return [];
      return data.filter(function (e) {
        return typeof e.q === 'string' && typeof e.raw === 'string';
      });
    } catch {
      return [];
    }
  }

  function saveToHistory(q, raw) {
    if (!raw || !raw.trim()) return;
    var entries = readHistory().filter(function (e) { return e.q !== q; });
    entries.unshift({ q: q, raw: raw, lang: pageLang, ts: Date.now() });
    if (entries.length > 10) entries = entries.slice(0, 10);
    try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(entries)); } catch { /* Safari private mode */ }
    renderHistory();
  }

  function renderHistory() {
    if (!askHistoryEl) return;
    var entries = readHistory();
    var html = '';
    if (askAvailable) {
      html += '<p class="plurality-ask-history__hint">' + escapeHtml(askHints[pageLang] || askHints.en) + '</p>';
    }
    if (entries.length) {
      html += '<div class="plurality-ask-history__chips">';
      for (var i = 0; i < entries.length; i++) {
        var q = entries[i].q;
        var label = q.length > 48 ? q.slice(0, 48) + '\u2026' : q;
        html += '<button type="button" class="plurality-ask-history__chip" data-idx="' + i +
          '" title="' + escapeHtml(q).replace(/"/g, '&quot;') + '">' + escapeHtml(label) + '</button>';
      }
      html += '</div>';
    }
    askHistoryEl.innerHTML = html;
    askHistoryEl.hidden = !askAvailable && entries.length === 0;
  }

  if (askHistoryEl) {
    askHistoryEl.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('.plurality-ask-history__chip');
      if (!btn) return;
      var idx = Number(btn.getAttribute('data-idx'));
      var entry = readHistory()[idx];
      if (!entry) return;
      renderAsk(entry.raw, false, '');
      window.dispatchEvent(new CustomEvent('plurality-search-after-ask', { detail: { query: entry.q } }));
    });
  }
  function hideAsk() {
    if (askAbort) {
      askAbort.abort();
      askAbort = null;
    }
    askLoading = false;
    if (askAnswer) {
      askAnswer.hidden = true;
      askAnswer.innerHTML = '';
    }
  }
  function runAsk(question) {
    var q = (question || '').trim();
    if (!askAvailable || !q || askLoading) return Promise.resolve();
    if (q.length > 100) {
      renderAsk('', false, 'Question too long (max 100 characters).');
      return Promise.resolve();
    }
    if (askAbort) askAbort.abort();
    askAbort = new AbortController();
    askLoading = true;
    renderAsk('', true, '');
    return fetch(askEndpoint(q), { signal: askAbort.signal })
      .then(function (res) {
        if (!res.ok) return res.text().then(function (t) { throw new Error(t || 'Request failed'); });
        if (!res.body || !res.body.getReader) return res.text().then(function (t) { saveToHistory(q, t); renderAsk(t, false, ''); });
        var reader = res.body.getReader();
        var dec = new TextDecoder();
        var raw = '';
        function next() {
          return reader.read().then(function (chunk) {
            if (chunk.done) {
              raw += dec.decode();
              saveToHistory(q, raw);
              renderAsk(raw, false, '');
              return;
            }
            raw += dec.decode(chunk.value, { stream: true });
            renderAsk(raw, true, '');
            return next();
          });
        }
        return next();
      })
      .catch(function (e) {
        if (e && e.name === 'AbortError') return;
        renderAsk('', false, (e && e.message) || 'Network error');
      })
      .finally(function () {
        askLoading = false;
        askAbort = null;
      });
  }

  function initCapacity() {
    if (!window.fetch) return;
    var host = window.location.hostname;
    if (
      !isLocalDevAskHost() &&
      host !== 'plurality.net' &&
      host !== 'www.plurality.net'
    ) {
      return;
    }
    var localDev = isLocalDevAskHost();
    void fetch(ASK_BASE + '/capacity', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        askAvailable = !!(d && d.status === 'available');
      })
      .catch(function () {
        askAvailable = localDev;
      })
      .then(function () {
        renderHistory();
      });
  }

  initCapacity();

  var obs = new MutationObserver(function () {
    if (!overlay.classList.contains('active')) { hideAsk(); } else { renderHistory(); }
  });
  obs.observe(overlay, { attributes: true, attributeFilter: ['class'] });

  overlay.addEventListener(
    'keydown',
    function (e) {
      if (!overlay.classList.contains('active')) return;
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var inp = overlay.querySelector(
        '.pagefind-ui__search-input, #search-container input',
      );
      if (!inp || e.target !== inp) return;
      if (!askAvailable || askLoading) return;
      var q = inp.value;
      if (!q || !q.trim()) return;
      e.preventDefault();
      e.stopPropagation();
      if (window.PluralitySearch && typeof window.PluralitySearch.submit === 'function') {
        window.PluralitySearch.submit();
        return;
      }
      void runAsk(q).then(function () {
        window.dispatchEvent(
          new CustomEvent('plurality-search-after-ask', { detail: { query: q.trim() } }),
        );
      });
    },
    true,
  );

  renderHistory();

  window.PluralityBookAsk = { runAsk: runAsk, hideAsk: hideAsk, askBase: ASK_BASE };
})();