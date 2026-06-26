/**
 * Plurality book AI search — streams from plurality-ask worker (sayit-style UX).
 */
(function () {
  var overlay = document.getElementById('search-overlay');
  var inner = overlay && overlay.querySelector('.search-overlay__inner');
  if (!overlay || !inner) return;

  var pageLang = document.documentElement.lang || 'en';
  var askAnswer = document.getElementById('plurality-ask-answer');
  if (!askAnswer) {
    askAnswer = document.createElement('div');
    askAnswer.id = 'plurality-ask-answer';
    askAnswer.className = 'plurality-ask-answer';
    askAnswer.setAttribute('aria-live', 'polite');
    askAnswer.hidden = true;
    inner.insertBefore(askAnswer, inner.firstChild);
  }

  var askAvailable = false;
  var askLoading = false;
  var askAbort = null;

  function resolveAskBaseUrl() {
    var host = window.location.hostname;
    var isDev = host === 'localhost' || host === '127.0.0.1';
    if (isDev) {
      try {
        var o = new URLSearchParams(window.location.search).get('ask_base');
        if (o) return o.replace(/\/$/, '');
      } catch (_e) { /* ignore */ }
      return 'http://127.0.0.1:8788';
    }
    return 'https://ask.plurality.net';
  }

  var ASK_BASE = resolveAskBaseUrl();

  function askEndpoint(q) {
    var base = ASK_BASE + '/au/' + encodeURIComponent(q.trim());
    return base + (base.indexOf('?') >= 0 ? '&' : '?') + 'lang=' + encodeURIComponent(pageLang);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function simpleMarkdownToHtml(md) {
    var html = escapeHtml(md);
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    return '<p>' + html + '</p>';
  }

  function renderAsk(raw, loading, err) {
    if (err) {
      askAnswer.hidden = false;
      askAnswer.innerHTML = '<p class="plurality-ask-answer__error">' + escapeHtml(err) + '</p>';
      return;
    }
    askAnswer.hidden = false;
    var body = raw ? simpleMarkdownToHtml(raw) : '';
    var cursor = loading ? '<span class="plurality-ask-answer__cursor" aria-hidden="true">▌</span>' : '';
    askAnswer.innerHTML =
      '<div class="plurality-ask-answer__body">' + body + cursor + '</div>';
  }

  function hideAsk() {
    askAnswer.hidden = true;
    askAnswer.innerHTML = '';
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
        if (!res.body || !res.body.getReader) return res.text().then(function (t) { renderAsk(t, false, ''); });
        var reader = res.body.getReader();
        var dec = new TextDecoder();
        var raw = '';
        function next() {
          return reader.read().then(function (chunk) {
            if (chunk.done) {
              raw += dec.decode();
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
    fetch(ASK_BASE + '/capacity', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) {
        askAvailable = !!(d && d.status === 'available');
      })
      .catch(function () { askAvailable = false; });
  }

  initCapacity();

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
      runAsk(q).then(function () {
        window.dispatchEvent(
          new CustomEvent('plurality-search-after-ask', { detail: { query: q.trim() } }),
        );
      });
    },
    true,
  );

  window.PluralityBookAsk = { runAsk: runAsk, hideAsk: hideAsk, askBase: ASK_BASE };
})();