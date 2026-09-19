/**
 * Landing-page voice sample row.
 *
 * Plays the pre-generated clips in prototypes/samples/, which were produced by the same
 * engines the product will call at runtime (scripts/tts-samples.mjs). If the manifest is
 * missing the section hides itself rather than showing dead play buttons.
 */
(function (global) {
  var MANIFEST = 'samples/samples.json';
  var data = null;
  var audio = null;
  var playing = null; /* the card currently sounding */

  function t(key) {
    return global.RTMI18n ? global.RTMI18n.t('samples.' + key) : key;
  }

  function lang() {
    return (global.RTMI18n && global.RTMI18n.getLang()) === 'zh' ? 'zh' : 'en';
  }

  function setIcon(card, name) {
    card.querySelector('.sample-play use').setAttribute('href', '#i-' + name);
  }

  function reset(card) {
    if (!card) return;
    card.classList.remove('is-playing');
    card.style.setProperty('--p', '0');
    setIcon(card, 'play');
  }

  function stop() {
    if (audio) audio.pause();
    reset(playing);
    playing = null;
  }

  function play(card, src) {
    if (playing === card) { stop(); return; }
    stop();

    audio.src = src;
    audio.play().then(function () {
      playing = card;
      card.classList.add('is-playing');
      setIcon(card, 'pause');
    }).catch(function () {
      if (global.RTM && RTM.toast) RTM.toast(t('playFailed'));
    });
  }

  function card(voice) {
    var el = document.createElement('div');
    el.className = 'sample';
    el.style.setProperty('--p', '0');
    el.innerHTML =
      '<button class="sample-btn" type="button">' +
        '<span class="sample-ring" aria-hidden="true"></span>' +
        '<span class="sample-mono" aria-hidden="true">' + voice.name.charAt(0) + '</span>' +
        '<span class="sample-play"><svg aria-hidden="true"><use href="#i-play"/></svg></span>' +
      '</button>' +
      '<span class="sample-name">' + voice.name + '</span>' +
      '<span class="sample-tier tier-' + voice.tier + '">' + t(voice.tier) + '</span>';

    var btn = el.querySelector('.sample-btn');
    btn.setAttribute('aria-label', t('playLabel').replace('{name}', voice.name));
    btn.addEventListener('click', function () {
      play(el, 'samples/' + voice.clips[lang()]);
    });
    return el;
  }

  function render(row, copyEl) {
    row.textContent = '';
    data.voices.forEach(function (voice) { row.appendChild(card(voice)); });
    copyEl.textContent = '“' + data.copy[lang()] + '”';
  }

  function mount(row, copyEl) {
    stop();

    if (!audio) {
      audio = new Audio();
      audio.preload = 'none';
      audio.addEventListener('timeupdate', function () {
        if (!playing || !audio.duration) return;
        playing.style.setProperty('--p', String(audio.currentTime / audio.duration));
      });
      audio.addEventListener('ended', stop);
    }

    if (data) { render(row, copyEl); return; }

    fetch(MANIFEST).then(function (r) {
      if (!r.ok) throw new Error('no manifest');
      return r.json();
    }).then(function (json) {
      data = json;
      render(row, copyEl);
    }).catch(function () {
      var block = row.closest('.hero-samples');
      if (block) block.hidden = true;
    });
  }

  global.RTMSamples = { mount: mount, stop: stop };
})(window);
