/* Read to Me — interactive prototype engine (Web Speech API)
 *
 * Free tier  : browser voices via speechSynthesis (no cost, works offline-ish)
 * Premium tier: Atlas Cloud MiniMax Speech 2.6 Turbo — shown locked in this prototype
 *
 * Usage: RTM.mountReader(element, { compact: true|false })
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'rtm.reader.v1';

  function t(key) {
    return global.RTMI18n ? global.RTMI18n.t('reader.' + key) : key;
  }
  var DEMO = {
    en: 'Welcome to Read to Me.\n\nPress play, and this text is read aloud to you — in a natural voice, at the speed you choose.\n\nBring anything you would like to hear: paste an article, upload a document, or write your own notes.\n\nAs it reads, the current sentence is highlighted, so you can follow along.\n\nTry a few voices and speeds from the player below.',
    zh: '欢迎使用「为我朗读」。\n\n点击播放，这段文字就会用自然的语音、按您选择的语速念给您听。\n\n想听什么都可以：粘贴一篇文章、上传一份文档，或者写下自己的笔记。\n\n朗读时，当前这句会高亮显示，方便您跟着一起看。\n\n在下方播放器里试试不同的音色和语速吧。',
    ja: '「Read to Me」へようこそ。\n\n再生を押すと、選んだ声と速さで、この文章を読み上げます。\n\n聞きたいものは何でもどうぞ。記事を貼る、.txt を入れる、自分のメモを書く。\n\n読んでいる文はハイライトされるので、目で追いながら聴けます。\n\n下のプレーヤーで、声と速さを試してみてください。',
    ko: 'Read to Me에 오신 것을 환영합니다.\n\n재생을 누르면 고른 목소리와 속도로 이 글을 읽어 줍니다.\n\n듣고 싶은 것은 무엇이든 좋아요. 글을 붙여 넣거나 .txt 파일을 넣거나 메모를 적어 보세요.\n\n읽고 있는 문장은 하이라이트되어 눈으로 따라갈 수 있습니다.\n\n아래 플레이어에서 목소리와 속도를 바꿔 보세요.',
    es: 'Bienvenido a Read to Me.\n\nPulsa reproducir y este texto se leerá en voz alta, con la voz y la velocidad que elijas.\n\nTrae lo que quieras oír: pega un artículo, suelta un archivo .txt o escribe tus notas.\n\nMientras lee, la frase actual se resalta para que puedas seguirla.\n\nPrueba distintas voces y velocidades en el reproductor de abajo.',
    fr: 'Bienvenue sur Read to Me.\n\nAppuyez sur lecture : ce texte vous est lu à voix haute, avec la voix et la vitesse que vous choisissez.\n\nApportez ce que vous voulez entendre : collez un article, déposez un fichier .txt ou écrivez vos notes.\n\nPendant la lecture, la phrase en cours est surlignée pour que vous puissiez suivre.\n\nEssayez quelques voix et vitesses dans le lecteur ci-dessous.',
    de: 'Willkommen bei Read to Me.\n\nDrücke auf Play – dieser Text wird dir vorgelesen, mit der Stimme und dem Tempo, das du wählst.\n\nBring mit, was du hören möchtest: einen Artikel einfügen, eine .txt-Datei ablegen oder eigene Notizen schreiben.\n\nBeim Vorlesen wird der aktuelle Satz markiert, damit du mitlesen kannst.\n\nProbier unten im Player verschiedene Stimmen und Tempi.'
  };

  var MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

  function extractPrototypeText(file) {
    if (file.size > MAX_UPLOAD_BYTES) return Promise.resolve({ ok: false, reason: 'too_large' });
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    if (name.slice(-4) === '.doc' && name.slice(-5) !== '.docx') return Promise.resolve({ ok: false, reason: 'legacy_doc' });
    var kind = detectPrototypeKind(name, type);
    if (!kind) return Promise.resolve({ ok: false, reason: 'unsupported' });
    return file.text().then(function (raw) {
      var text = kind === 'html' ? htmlToText(raw) : kind === 'rtf' ? rtfToText(raw) : raw;
      text = String(text || '').replace(/\u0000/g, '').replace(/\n{3,}/g, '\n\n').trim();
      if (!text) return { ok: false, reason: 'empty' };
      return { ok: true, text: text };
    }).catch(function () {
      return { ok: false, reason: 'parse' };
    });
  }

  function detectPrototypeKind(name, type) {
    if (/\.(html|htm)$/.test(name) || type === 'text/html') return 'html';
    if (/\.rtf$/.test(name) || type === 'text/rtf' || type === 'application/rtf') return 'rtf';
    if (/\.(txt|text|md|markdown|csv|tsv)$/.test(name) || type.indexOf('text/') === 0) return 'plain';
    return null;
  }

  function htmlToText(markup) {
    var doc = new DOMParser().parseFromString(markup, 'text/html');
    Array.prototype.forEach.call(doc.querySelectorAll('script,style,noscript'), function (node) { node.remove(); });
    return ((doc.body && doc.body.textContent) || '').replace(/[ \t]+\n/g, '\n');
  }

  function rtfToText(rtf) {
    return String(rtf)
      .replace(/\\'[0-9a-f]{2}/gi, function (token) { return String.fromCharCode(parseInt(token.slice(2), 16)); })
      .replace(/\\[a-z]+-?\d* ?/gi, '')
      .replace(/[{}]/g, ' ')
      .replace(/[ \t]{2,}/g, ' ');
  }

  function primaryLang(tag) {
    return String(tag || 'en').replace('_', '-').split('-')[0].toLowerCase();
  }

  function sampleText(lang) {
    var key = primaryLang(lang || (global.RTMI18n ? global.RTMI18n.getLang() : 'en'));
    return DEMO[key] || DEMO[global.RTMI18n ? global.RTMI18n.getLang() : 'en'] || DEMO.en;
  }

  /* Untouched sample copy should follow the language switch; edited text must not. */
  function isUntouchedSample(text) {
    var trimmed = String(text || '').trim();
    if (!trimmed) return false;
    return Object.keys(DEMO).some(function (key) { return DEMO[key].trim() === trimmed; });
  }

  /* Atlas Cloud MiniMax preset voices (locked in the prototype) */
  var PREMIUM_VOICES = [
    { id: 'English_expressive_narrator', name: 'Expressive Narrator', lang: 'en-US' },
    { id: 'English_CalmWoman', name: 'Calm Woman', lang: 'en-US' },
    { id: 'English_Trustworth_Man', name: 'Trustworthy Man', lang: 'en-US' },
    { id: 'English_radiant_girl', name: 'Radiant Girl', lang: 'en-US' },
    { id: 'English_Aussie_Bloke', name: 'Aussie Bloke', lang: 'en-AU' }
  ];

  var ICONS = {
    play: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.6-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14z"/></svg>',
    pause: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5" width="4" height="14" rx="1.2"/><rect x="13" y="5" width="4" height="14" rx="1.2"/></svg>',
    stop: '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    upload: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/></svg>',
    trash: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 12a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-12"/></svg>',
    lock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>'
  };

  /* ---------- text → sentence segments ---------- */

  function segmentText(text) {
    var segs = [];
    if (!text) return segs;
    var re = /[^\n]*?(?:[.!?。！？…]+["'”’)\]]*|\n|$)/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      if (m[0] === '') { re.lastIndex++; continue; }
      var start = m.index;
      var end = start + m[0].length;
      if (m[0].trim().length) segs.push({ start: start, end: end, text: m[0] });
      if (re.lastIndex >= text.length) break;
    }
    return segs;
  }

  /* ---------- persistence ---------- */

  function loadState() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      return v && typeof v.text === 'string' ? v : null;
    } catch (e) { return null; }
  }

  function saveState(s) {
    try {
      global.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ text: s.text, segmentIndex: s.segmentIndex, voiceURI: s.voiceURI, rate: s.rate, docSize: s.docSize })
      );
    } catch (e) { /* quota — prototype ignores */ }
  }

  /* ---------- toast ---------- */

  function toast(msg) {
    var host = document.querySelector('.toast-host');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toast-host';
      document.body.appendChild(host);
    }
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }

  /* ---------- reader ---------- */

  function mountReader(root, opts) {
    opts = opts || {};
    var compact = !!opts.compact;
    var synth = global.speechSynthesis;

    if (synth) synth.cancel(); // a re-mount (e.g. language switch) must not leave audio running

    var saved = loadState() || {};
    var savedText = typeof saved.text === 'string' ? saved.text : null;
    var showingSample = savedText === null || isUntouchedSample(savedText);
    var state = {
      text: showingSample ? sampleText() : savedText,
      segmentIndex: saved.segmentIndex || 0,
      voiceURI: saved.voiceURI || null,
      rate: saved.rate || 1,
      docSize: saved.docSize || 17,
      status: 'idle', // idle | playing | paused
      segs: [],
      langFilter: 'all',
      tier: 'all'
    };

    /* While the sample is untouched, follow the UI language into a matching voice. */
    if (showingSample) {
      var savedVoice = findVoice(state.voiceURI);
      var uiPrefix = global.RTMI18n ? global.RTMI18n.getLang() : 'en';
      if (!savedVoice || !new RegExp('^' + uiPrefix, 'i').test(savedVoice.lang)) state.voiceURI = null;
    }

    root.innerHTML = renderShell(compact);
    var el = {
      wrap: root.querySelector('.reader'),
      doc: root.querySelector('.doc-body'),
      count: root.querySelector('.doc-count'),
      play: root.querySelector('.play-btn'),
      stop: root.querySelector('[data-act="stop"]'),
      rateBtn: root.querySelector('.t-rate'),
      chipName: root.querySelector('.voice-chip .name'),
      progress: root.querySelector('.progress-fill'),
      clear: root.querySelector('[data-act="clear"]'),
      upload: root.querySelector('[data-act="upload"]'),
      file: root.querySelector('input[type=file]'),
      smaller: root.querySelector('[data-act="smaller"]'),
      bigger: root.querySelector('[data-act="bigger"]'),
      voiceList: root.querySelector('.voice-list'),
      voiceSelect: root.querySelector('[data-role="voice-select"]'),
      langSel: root.querySelector('[data-role="lang"]'),
      rateRange: root.querySelector('[data-role="rate"]'),
      rateVal: root.querySelector('[data-role="rate-val"]'),
      filters: root.querySelectorAll('.chip[data-filter]')
    };

    if (!synth) {
      el.play.disabled = true;
      toast(t('noSpeech'));
    }

    /* ----- document text ----- */

    function setDocText(text) {
      state.text = text;
      state.segmentIndex = 0;
      renderDoc();
      updateCount();
      saveState(state);
    }

    function renderDoc() {
      if (state.status === 'idle') {
        el.doc.classList.remove('is-reading');
        el.doc.setAttribute('contenteditable', 'true');
        el.doc.textContent = state.text;
        return;
      }
      el.doc.classList.add('is-reading');
      el.doc.setAttribute('contenteditable', 'false');
      var html = '';
      var cursor = 0;
      state.segs.forEach(function (s, i) {
        if (s.start > cursor) html += escapeHtml(state.text.slice(cursor, s.start));
        var cls = i === state.segmentIndex ? 'seg is-spoken' : i < state.segmentIndex ? 'seg is-done' : 'seg';
        html += '<span class="' + cls + '" data-seg="' + i + '">' + escapeHtml(s.text) + '</span>';
        cursor = s.end;
      });
      if (cursor < state.text.length) html += escapeHtml(state.text.slice(cursor));
      el.doc.innerHTML = html;
      var active = el.doc.querySelector('.seg.is-spoken');
      if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    function updateCount() {
      var chars = state.text.length.toLocaleString() + ' ' + t('characters');
      /* Whitespace word counts are meaningless for CJK, so show characters only. */
      if (/[\u4e00-\u9fff\u3040-\u30ff]/.test(state.text)) {
        el.count.textContent = chars;
        return;
      }
      var words = state.text.trim() ? state.text.trim().split(/\s+/).length : 0;
      el.count.textContent = words.toLocaleString() + ' ' + t('words') + ' · ' + chars;
    }

    function updateProgress() {
      var pct = state.segs.length ? (state.segmentIndex / state.segs.length) * 100 : 0;
      el.progress.style.width = pct.toFixed(1) + '%';
    }

    /* ----- playback ----- */

    var suppressEnd = false;
    var watchdog = null;

    /* Some browsers (notably iOS Safari, or tabs without a user gesture) drop the
       utterance without firing onend/onerror, which would leave the UI stuck. */
    function armWatchdog() {
      clearTimeout(watchdog);
      var startedAt = state.segmentIndex;
      watchdog = setTimeout(function () {
        if (state.status !== 'playing') return;
        if (synth.speaking || synth.pending) return;
        if (state.segmentIndex !== startedAt) return;
        stop();
        toast(t('blocked'));
      }, 900);
    }

    function speakCurrent() {
      if (!synth) return;
      var seg = state.segs[state.segmentIndex];
      if (!seg) { stop(); return; }
      var u = new global.SpeechSynthesisUtterance(seg.text);
      u.rate = state.rate;
      var v = findVoice(state.voiceURI);
      if (v) { u.voice = v; u.lang = v.lang; }
      u.onend = function () {
        if (suppressEnd) return;
        state.segmentIndex++;
        saveState(state);
        if (state.segmentIndex >= state.segs.length) { stop(); return; }
        renderDoc();
        updateProgress();
        speakCurrent();
      };
      u.onerror = function () { if (!suppressEnd) stop(); };
      synth.speak(u);
      armWatchdog();
    }

    function play() {
      if (!state.text.trim()) {
        toast(t('needText'));
        el.doc.focus();
        return;
      }
      if (state.status === 'paused') {
        state.status = 'playing';
        synth.resume();
        syncControls();
        return;
      }
      state.segs = segmentText(state.text);
      if (state.segmentIndex >= state.segs.length) state.segmentIndex = 0;
      state.status = 'playing';
      suppressEnd = true;
      synth.cancel();
      suppressEnd = false;
      renderDoc();
      updateProgress();
      syncControls();
      speakCurrent();
    }

    function pause() {
      if (state.status !== 'playing') return;
      clearTimeout(watchdog);
      state.status = 'paused';
      synth.pause();
      saveState(state);
      syncControls();
    }

    function stop() {
      clearTimeout(watchdog);
      suppressEnd = true;
      if (synth) synth.cancel();
      suppressEnd = false;
      state.status = 'idle';
      state.segmentIndex = 0;
      saveState(state);
      renderDoc();
      updateProgress();
      syncControls();
    }

    function syncControls() {
      var playing = state.status === 'playing';
      el.play.innerHTML = playing ? ICONS.pause : ICONS.play;
      el.play.setAttribute('aria-label', playing ? t('pause') : t('play'));
      root.dispatchEvent(new CustomEvent('rtm:activity', { bubbles: true, detail: { active: state.status !== 'idle' } }));
    }

    /* ----- voices ----- */

    function browserVoices() { return synth ? synth.getVoices() : []; }

    function findVoice(uri) {
      if (!uri) return null;
      var all = browserVoices();
      for (var i = 0; i < all.length; i++) if (all[i].voiceURI === uri) return all[i];
      return null;
    }

    function currentVoiceLabel() {
      var v = findVoice(state.voiceURI);
      if (v) return v.name;
      var all = browserVoices();
      return all.length ? all[0].name : t('systemVoice');
    }

    function renderVoices() {
      var all = browserVoices();
      if (!state.voiceURI && all.length) {
        var uiLang = global.RTMI18n ? global.RTMI18n.getLang() : 'en';
        var matches = function (v) { return new RegExp('^' + uiLang, 'i').test(v.lang); };
        var preferred = all.filter(function (v) { return matches(v) && v.localService; })[0] ||
          all.filter(matches)[0] || all[0];
        state.voiceURI = preferred.voiceURI;
      }

      if (el.langSel) {
        var langs = {};
        all.forEach(function (v) { langs[v.lang] = true; });
        var keys = Object.keys(langs).sort();
        el.langSel.innerHTML =
          '<option value="all">' + t('allLanguages') + ' (' + keys.length + ')</option>' +
          keys.map(function (k) { return '<option value="' + k + '">' + k + '</option>'; }).join('');
        el.langSel.value = state.langFilter;
      }

      var inLang = function (lang) { return state.langFilter === 'all' || lang === state.langFilter; };

      if (el.voiceSelect) {
        /* Browser voices only: a native select cannot make a paid voice look anything but broken,
           and the compact reader sits right below a sample row that lets you hear the cloud ones. */
        el.voiceSelect.innerHTML = all.filter(function (v) { return inLang(v.lang); })
          .map(function (v) {
            return '<option value="' + escapeHtml(v.voiceURI) + '"' + (v.voiceURI === state.voiceURI ? ' selected' : '') + '>' +
              escapeHtml(v.name) + ' — ' + escapeHtml(v.lang) + '</option>';
          }).join('');
      }

      if (el.voiceList) {
        /* Premium first, mirroring how hosted readers surface their paid voices */
        var locked = PREMIUM_VOICES.filter(function (p) { return inLang(p.lang); });
        /* short labels here: the panel column is too narrow for the ones used in the select */
        var html = state.tier === 'free' || !locked.length ? '' :
          '<div class="voice-group">' +
            '<span>' + t('groupCloud') + '</span>' +
            '<a href="pricing.html">' + t('seePlans') + '</a>' +
          '</div>';

        html += state.tier === 'free' ? '' : locked
          .map(function (p) {
            return (
              '<button class="voice-item is-locked" data-premium="' + p.id + '">' +
              '<span class="v-name">' + p.name + '</span>' +
              '<span class="v-lang">' + p.lang + '</span>' +
              '<span class="badge badge-pro">' + ICONS.lock + ' Pro</span>' +
              '</button>'
            );
          }).join('');

        if (state.tier !== 'pro') {
          if (html) html += '<div class="voice-group"><span>' + t('groupBrowser') + '</span></div>';
          html += all.filter(function (v) { return inLang(v.lang); }).map(function (v) {
            return (
              '<button class="voice-item' + (v.voiceURI === state.voiceURI ? ' active' : '') + '" data-voice="' + escapeHtml(v.voiceURI) + '">' +
              '<span class="v-name">' + escapeHtml(v.name) + '</span>' +
              '<span class="v-lang">' + escapeHtml(v.lang) + '</span>' +
              '<span class="badge badge-free">Free</span>' +
              '</button>'
            );
          }).join('');
        }

        el.voiceList.innerHTML = html || '<p class="panel-note">' + t('noVoices') + '</p>';
      }

      if (el.chipName) el.chipName.textContent = currentVoiceLabel();
    }

    /* ----- events ----- */

    el.doc.addEventListener('input', function () {
      if (state.status !== 'idle') return;
      state.text = el.doc.textContent || '';
      state.segmentIndex = 0;
      updateCount();
      saveState(state);
    });

    el.doc.addEventListener('click', function (e) {
      var seg = e.target.closest ? e.target.closest('.seg') : null;
      if (!seg || state.status === 'idle') return;
      state.segmentIndex = Number(seg.getAttribute('data-seg'));
      suppressEnd = true;
      synth.cancel();
      suppressEnd = false;
      state.status = 'playing';
      renderDoc();
      updateProgress();
      syncControls();
      speakCurrent();
    });

    el.play.addEventListener('click', function () {
      if (state.status === 'playing') pause(); else play();
    });
    el.stop.addEventListener('click', stop);

    el.clear.addEventListener('click', function () {
      stop();
      setDocText('');
      el.doc.focus();
    });

    el.upload.addEventListener('click', function () { el.file.click(); });
    el.file.addEventListener('change', function () {
      applyUpload(el.file.files && el.file.files[0]);
      el.file.value = '';
    });
    var card = root.querySelector('.doc-card');
    if (card) {
      card.addEventListener('dragover', function (event) { event.preventDefault(); });
      card.addEventListener('drop', function (event) {
        event.preventDefault();
        applyUpload(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]);
      });
    }

    function applyUpload(file) {
      if (!file) return;
      extractPrototypeText(file).then(function (result) {
        if (!result.ok) {
          var messages = {
            unsupported: t('needFormat'),
            legacy_doc: t('needDocx'),
            empty: t('emptyFile'),
            too_large: t('tooLarge'),
            parse: t('parseFailed')
          };
          toast(messages[result.reason] || t('needFormat'));
          return;
        }
        stop();
        setDocText(result.text);
        toast(t('loaded') + ' ' + file.name);
      });
    }

    function setDocSize(next) {
      state.docSize = Math.min(26, Math.max(14, next));
      el.doc.style.setProperty('--doc-size', state.docSize + 'px');
      saveState(state);
    }
    el.smaller.addEventListener('click', function () { setDocSize(state.docSize - 1); });
    el.bigger.addEventListener('click', function () { setDocSize(state.docSize + 1); });

    function setRate(r) {
      state.rate = Math.min(2, Math.max(0.5, Math.round(r * 10) / 10));
      el.rateBtn.textContent = state.rate.toFixed(1) + 'x';
      if (el.rateRange) el.rateRange.value = String(state.rate);
      if (el.rateVal) el.rateVal.textContent = state.rate.toFixed(1) + 'x';
      saveState(state);
      if (state.status === 'playing') { // apply immediately to the current sentence
        suppressEnd = true;
        synth.cancel();
        suppressEnd = false;
        speakCurrent();
      }
    }
    el.rateBtn.addEventListener('click', function () {
      var steps = [1, 1.25, 1.5, 1.75, 2, 0.75];
      var i = steps.indexOf(state.rate);
      setRate(steps[(i + 1) % steps.length]);
    });
    if (el.rateRange) el.rateRange.addEventListener('input', function () { setRate(Number(el.rateRange.value)); });

    if (el.langSel) {
      el.langSel.addEventListener('change', function () {
        state.langFilter = el.langSel.value;
        var remaining = browserVoices().filter(function (v) {
          return state.langFilter === 'all' || v.lang === state.langFilter;
        });
        if (remaining.length && !remaining.some(function (v) { return v.voiceURI === state.voiceURI; })) {
          state.voiceURI = remaining[0].voiceURI;
        }
        if (isUntouchedSample(state.text)) {
          setDocText(sampleText(state.langFilter === 'all' ? (global.RTMI18n ? global.RTMI18n.getLang() : 'en') : state.langFilter));
        }
        applyVoiceChange();
      });
    }

    function applyVoiceChange() {
      renderVoices();
      saveState(state);
      if (state.status === 'playing') {
        suppressEnd = true;
        synth.cancel();
        suppressEnd = false;
        speakCurrent();
      }
    }

    if (el.voiceSelect) {
      el.voiceSelect.addEventListener('change', function () {
        state.voiceURI = el.voiceSelect.value;
        applyVoiceChange();
      });
    }

    if (el.voiceList) {
      el.voiceList.addEventListener('click', function (e) {
        var btn = e.target.closest('.voice-item');
        if (!btn) return;
        if (btn.hasAttribute('data-premium')) {
          var session = global.RTMAuth && global.RTMAuth.getSession();
          toast(session ? t('premiumUpgrade') : t('premiumSignIn'));
          return;
        }
        state.voiceURI = btn.getAttribute('data-voice');
        applyVoiceChange();
      });
    }

    Array.prototype.forEach.call(el.filters, function (chip) {
      chip.addEventListener('click', function () {
        Array.prototype.forEach.call(el.filters, function (c) { c.classList.remove('active'); });
        chip.classList.add('active');
        state.tier = chip.getAttribute('data-filter');
        renderVoices();
      });
    });

    if (synth) {
      synth.addEventListener
        ? synth.addEventListener('voiceschanged', renderVoices)
        : (synth.onvoiceschanged = renderVoices);
    }
    global.addEventListener('beforeunload', function () { if (synth) synth.cancel(); });

    /* ----- init ----- */
    setDocSize(state.docSize);
    setRate(state.rate);
    renderDoc();
    updateCount();
    updateProgress();
    renderVoices();
    syncControls();
    setTimeout(renderVoices, 250); // Chrome populates voices async

    return {
      play: play, pause: pause, stop: stop,
      focus: function () { el.doc.focus(); }
    };
  }

  /* ---------- markup ---------- */

  function renderShell(compact) {
    var panel = compact ? '' :
      '<aside class="panel">' +
        '<div class="panel-tabs">' +
          '<button class="panel-tab active">' + t('tabPlayback') + '</button>' +
          '<button class="panel-tab" data-soon="1">' + t('tabPronunciation') + '</button>' +
        '</div>' +
        '<div class="panel-section">' +
          '<div class="panel-label">' + t('language') + '</div>' +
          '<select data-role="lang"></select>' +
        '</div>' +
        '<div class="panel-section">' +
          '<div class="panel-label">' + t('speed') + ' <span class="val" data-role="rate-val">1.0x</span></div>' +
          '<div class="rate-row"><span>0.5x</span><input type="range" min="0.5" max="2" step="0.1" data-role="rate"><span>2.0x</span></div>' +
        '</div>' +
        '<div class="panel-section">' +
          '<div class="panel-label">' + t('voiceSelection') + '</div>' +
          '<div class="voice-filters">' +
            '<button class="chip active" data-filter="all">' + t('filterAll') + '</button>' +
            '<button class="chip" data-filter="free">' + t('filterFree') + '</button>' +
            '<button class="chip" data-filter="pro">' + t('filterPro') + '</button>' +
          '</div>' +
          '<div class="voice-list"></div>' +
        '</div>' +
        '<div class="panel-section">' +
          '<p class="panel-note">' + t('note') + '</p>' +
        '</div>' +
      '</aside>';

    var transportLeft = compact
      ? '<div class="transport-picks">' +
          '<select data-role="lang" class="transport-select transport-lang" aria-label="' + t('language') + '"></select>' +
          '<select data-role="voice-select" class="transport-select transport-voice" aria-label="' + t('voiceSelection') + '"></select>' +
        '</div>'
      : '<div class="voice-chip"><span class="dot"></span><span class="name">' + t('systemVoice') + '</span></div>';
    var openFull = compact
      ? '<a class="open-full" href="read.html">' + t('openFull') + '</a>'
      : '';

    return (
      '<div class="reader' + (compact ? ' is-compact' : '') + '">' +
        '<div>' +
          '<div class="doc-card">' +
            '<div class="doc-toolbar">' +
              '<button class="btn btn-icon" data-act="clear" title="' + t('clear') + '" aria-label="' + t('clear') + '">' + ICONS.trash + '</button>' +
              '<button class="btn btn-icon" data-act="upload" title="' + t('upload') + '" aria-label="' + t('upload') + '">' + ICONS.upload + '</button>' +
              '<input type="file" accept=".txt,.text,.md,.markdown,.html,.htm,.rtf,.csv,.tsv,.doc,.docx,.odt,.pdf,.epub,text/plain,text/markdown,text/html,text/csv,text/rtf,application/pdf" hidden>' +
              '<span class="sep"></span>' +
              '<button class="btn btn-icon" data-act="smaller" title="' + t('smaller') + '" aria-label="' + t('smaller') + '">A−</button>' +
              '<button class="btn btn-icon" data-act="bigger" title="' + t('bigger') + '" aria-label="' + t('bigger') + '">A+</button>' +
              '<span class="spacer"></span>' +
              '<span class="doc-count"></span>' +
              openFull +
            '</div>' +
            '<div class="doc-body" contenteditable="true" spellcheck="false" data-placeholder="' + t('placeholder') + '"></div>' +
            '<div class="transport">' +
              transportLeft +
              '<button class="play-btn" aria-label="' + t('play') + '"></button>' +
              '<div class="transport-actions">' +
                '<button class="t-btn t-rate" title="' + t('speed') + '">1.0x</button>' +
                '<button class="t-btn" data-act="stop" title="' + t('stop') + '" aria-label="' + t('stop') + '">' + ICONS.stop + '</button>' +
              '</div>' +
            '</div>' +
            '<div class="progress-track"><div class="progress-fill"></div></div>' +
          '</div>' +
        '</div>' +
        panel +
      '</div>'
    );
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  global.RTM = { mountReader: mountReader, segmentText: segmentText, toast: toast };
})(window);
