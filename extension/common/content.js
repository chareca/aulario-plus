// MiAulario Keep-Alive: content script for miaulario.unavarra.es.
//
// - If you open MiAulario and the Sakai session is not active, the script sends you to
//   the SAML login. If the SSO session is active, you come back logged in. If not, the
//   login form of sso.unavarra.es opens. The password manager of the browser can fill it.
// - If you click "Log out", the script tells the background script to pause.

(async () => {
  const api = globalThis.browser ?? globalThis.chrome;
  const SAML_LOGIN = '/sakai-login-tool/container/saml/login';
  const LOGOUT_RE = /\/portal\/logout|\/sakai-login-tool\/container\/saml\/logout/i;
  const THROTTLE_MS = 2 * 60 * 1000;
  const THROTTLE_KEY = 'miaulario-keepalive-last-relogin';

  const send = (msg) => api.runtime.sendMessage(msg).catch(() => null);

  // Manual logout: the background script pauses and removes the persistent cookies.
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element && e.target.closest('a[href]');
    if (a && LOGOUT_RE.test(a.href)) send({ type: 'logout' });
  }, true);

  // Do not change the login pages or the logout pages.
  if (/\/(xlogin|relogin|logout)|\/sakai-login-tool\//i.test(location.pathname)) return;

  const status = await send({ type: 'getStatus' });
  if (!status || status.paused || !status.autoLogin) return;

  let loggedIn;
  try {
    // "auto=true": this request only reads the session. Sakai does not record it as activity.
    const s = await fetch('/direct/session/current.json?auto=true', { cache: 'no-store', credentials: 'include' }).then((r) => r.json());
    loggedIn = !!s.userId;
  } catch {
    return;
  }
  if (loggedIn) return;

  // Prevent a loop if the SSO sends you back to the portal without a session.
  let last = 0;
  try { last = Number(sessionStorage.getItem(THROTTLE_KEY) || 0); } catch {}
  if (Date.now() - last < THROTTLE_MS) return;
  try { sessionStorage.setItem(THROTTLE_KEY, String(Date.now())); } catch {}

  await send({ type: 'relogin' });
  location.assign(SAML_LOGIN);
})();
