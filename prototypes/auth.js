/* Read to Me — prototype auth
 * Mirrors the intended NextAuth (Google) flow from the deepsearch reference, but the
 * "session" here is just localStorage: no real account, no server, no Stripe.
 */
(function (global) {
  'use strict';

  var SESSION_KEY = 'rtm.session';

  var GOOGLE_LOGO =
    '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">' +
    '<path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/>' +
    '<path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"/>' +
    '<path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.7l4-3z"/>' +
    '<path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.7l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/>' +
    '</svg>';

  function getSession() {
    try {
      var raw = global.localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function signIn(profile) {
    var user = profile || { name: 'Demo User', email: 'demo@localhost', plan: 'free' };
    try { global.localStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch (e) {}
    global.dispatchEvent(new CustomEvent('rtm:authchange', { detail: { user: user } }));
    return user;
  }

  function signOut() {
    try { global.localStorage.removeItem(SESSION_KEY); } catch (e) {}
    global.dispatchEvent(new CustomEvent('rtm:authchange', { detail: { user: null } }));
  }

  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  /* nav widget: sign-in button, or avatar with plan / usage / billing / sign out */
  function mountAuth(host, opts) {
    opts = opts || {};
    var t = global.RTMI18n ? global.RTMI18n.t : function (k) { return k; };

    function render() {
      var user = getSession();

      if (!user) {
        host.innerHTML = '<a class="btn btn-ghost btn-sm" href="' + (opts.signInHref || 'signin.html') + '" data-i18n="auth.signIn">' + t('auth.signIn') + '</a>';
        return;
      }

      host.innerHTML =
        '<div class="account">' +
          '<button class="avatar-btn" aria-haspopup="true" aria-expanded="false">' +
            '<span class="avatar">' + initials(user.name) + '</span>' +
          '</button>' +
          '<div class="account-menu" hidden>' +
            '<div class="account-head">' +
              '<div class="account-name">' + escapeHtml(user.name) + '</div>' +
              '<div class="account-mail">' + escapeHtml(user.email) + '</div>' +
            '</div>' +
            '<div class="account-row">' +
              '<span>' + t('auth.plan') + '</span>' +
              '<span class="badge badge-free">' + t('auth.planFree') + '</span>' +
            '</div>' +
            '<button class="account-item" data-act="usage">' + t('auth.usage') + '</button>' +
            '<button class="account-item" data-act="billing">' + t('auth.billing') + '</button>' +
            '<button class="account-item danger" data-act="signout">' + t('auth.signOut') + '</button>' +
          '</div>' +
        '</div>';

      var btn = host.querySelector('.avatar-btn');
      var menu = host.querySelector('.account-menu');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
        btn.setAttribute('aria-expanded', String(!menu.hidden));
      });
      document.addEventListener('click', function () { menu.hidden = true; });

      host.querySelector('[data-act="usage"]').addEventListener('click', function () {
        if (global.RTM) global.RTM.toast(t('auth.usageNote'));
      });
      host.querySelector('[data-act="billing"]').addEventListener('click', function () {
        if (global.RTM) global.RTM.toast(t('auth.premiumBilling') || t('reader.premiumUpgrade'));
      });
      host.querySelector('[data-act="signout"]').addEventListener('click', function () {
        signOut();
        render();
      });
    }

    render();
    global.addEventListener('rtm:authchange', render);
    global.addEventListener('rtm:langchange', render);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  global.RTMAuth = {
    getSession: getSession,
    signIn: signIn,
    signOut: signOut,
    mountAuth: mountAuth,
    GOOGLE_LOGO: GOOGLE_LOGO
  };
})(window);
