# MiAulario (UPNA): session research

This document shows how the MiAulario session operates. The research occurred on 2026-10-16 on `https://miaulario.unavarra.es/portal`, with a personal account.

## Summary

1. MiAulario uses **Sakai** (a recent version with Bootstrap 5 and web components). The login uses **SAML** with the UPNA SSO (`sso.unavarra.es`, product **adAS**).
2. The session is in the cookie **`SAKAISESSIONID`** (HttpOnly, session cookie). The cookie **`SERVERID`** connects the session to one server node of the load balancer.
3. The server ends the session after **60 minutes without activity** (`maxInactiveInterval = 3600`). After 50 minutes, the page shows a warning: "the session closes in 10 minutes" (`timeoutDialog.seconds = 600`).
4. **Test result:** `GET /direct/session/current.json` without `?auto=true` sets the inactivity timer to zero. The response is approximately 474 bytes. This request is a good keep-alive request.
5. If the computer is off, no code operates. Sakai then ends the session after 60 minutes. The possible result is:
   - While the browser is open, the session does not end.
   - When you open MiAulario again, the extension opens the login page. If the SSO session is active, a password is not necessary.

## Architecture

```
Browser ──► miaulario.unavarra.es (Apache + HAProxy) ──► Sakai node (sakai30a, sakai32a, ...)
   │            The cookie SERVERID=h3x selects the node.
   │            The cookie SAKAISESSIONID=<uuid>.<node> is the session.
   │
   └─ login ──► /portal/site/login-es ──► /sakai-login-tool/container/saml/login
                 └─ 302 ──► sso.unavarra.es/SAML2/SSOService.php (adAS)
                              The cookie idpsession is the SSO session.
                              Form fields: adAS_username / adAS_password
```

Logout URL: `portal.loggedOutUrl = /sakai-login-tool/container/saml/logout`. This URL closes the Sakai session and the SSO session.

## Cookies

| Cookie | Domain | Function | Flags | Duration |
|---|---|---|---|---|
| `SAKAISESSIONID` | miaulario.unavarra.es | **The session.** The suffix `.sakaiNNa` is the node. | `Secure; HttpOnly; SameSite=None` | Session cookie (no `Expires`). The browser removes it when you close the browser. |
| `SERVERID` | miaulario.unavarra.es | Affinity of the load balancer (`h30` to `h35`). If this value changes, the request goes to a different node. That node does not know the session. | None | Session cookie |
| `JSESSIONID` | miaulario.unavarra.es, `Path=/sakai-login-tool` | Temporary state of the SAML login | `Secure; HttpOnly` | Session cookie |
| `idpsession` | sso.unavarra.es | The SSO session. While it is active, you can log in again without a password. | `secure; HttpOnly; SameSite=None` | Session cookie. The duration on the server is not known. |
| `_pk_id.*`, `_pk_ses.*` | miaulario.unavarra.es | Matomo analytics | – | No effect on the login |
| `pasystem_timezone_ok` | miaulario.unavarra.es | Time zone message | – | No effect on the login |

The JavaScript of the page cannot read `SAKAISESSIONID` or `idpsession`, because they are HttpOnly cookies. An extension with permission for these domains can read and change them with the `cookies` API.

The SSO does not have a "remember me" option. The element `remember_button` is a link to the password recovery page.

## How the timeout operates (portal code)

The portal sets `portal.timeoutDialog = { enabled: true, seconds: 600 }`. Then it starts `poll_session_data()`:

1. The portal sends `GET /direct/session/current.json?auto=true`. The parameter **`auto=true` tells Sakai that the request is not activity.**
2. The portal calculates `remaining = lastAccessedTime + maxInactiveInterval - currentTime`.
3. If `remaining < 600 s`, the portal shows the warning. The warning is an HTML fragment from `/portal/timeout?auto=true`. Then the portal reads the session again every `max(remaining / 2, 60 s)`.
4. If not, the portal sets the next read for the time when 600 s remain.
5. If `userId == null`, the session is not active. The portal then opens `timeoutLoggedoutUrl` (the SAML logout).
6. The "stay connected" button calls `keep_session_alive()`. This function sends `GET /portal` without `auto`. This request extends the session.

Result: **each request to Sakai without `auto=true` keeps the session active.** The server controls the timer. The warning on the page only gives information.

## Test: which request sets the timer to zero

The test reads `currentTime - lastAccessedTime` with `?auto=true`. This read does not change the timer.

| Step | Seconds since the last activity |
|---|---|
| First read | 28.2 |
| 4 s later, only `auto=true` reads | 32.3 (no change to the timer) |
| After `GET /direct/session/current.json` without `auto` (HTTP 200, 474 B) | **0.5** (the timer goes back to zero) |
| 3 s later | 3.7 |

## What is possible

| Objective | Possible? | Method |
|---|---|---|
| The session does not end while the browser is open and you do not use it. This is also true if the tab is closed or minimized. | **Yes** | A ping from the background script at a random interval of 3 to 10 minutes |
| You close the browser. You open it again and the session is active. | **Yes, if you open it again in less than 60 minutes** | The extension changes `SAKAISESSIONID` and `SERVERID` into persistent cookies. |
| The session stays active while the computer is off or in sleep mode. | **No**, because no code operates | Sakai ends the session on the server after 60 minutes. |
| You start the computer and open MiAulario. You are logged in. | **Partially** | The extension opens the SAML login. If `idpsession` is active, a password is not necessary. If not, the password manager of the browser can fill the form. |

## Not in the design

- **A remote server that sends pings with your session cookie.** This method keeps the session active when your computer is off. But your session is then on a different computer, and a person with that cookie has access to your account. Also, this method does not agree with the purpose of the UPNA rules.
- **The password in the extension.** The storage of an extension is not encrypted. The password manager of the browser is safer.

## Design of the extension

The extension has one source code for Chromium browsers (Chrome, Edge, Brave, Opera, Vivaldi, Arc, Helium) and Firefox (128 or later). It uses Manifest V3.

### Files

```
extension/
  manifest.chromium.json   Chromium manifest ("background.service_worker")
  manifest.firefox.json    Firefox manifest ("background.scripts")
  common/
    background.js          alarms, ping, persistent cookies, status
    content.js             on miaulario.unavarra.es: finds the logout and opens the login page
    popup.html, popup.js   status, "Ping now", "Pause", login page option
    icons/
scripts/
  make_icons.py            makes the PNG icons
build.sh                   makes dist/chromium, dist/firefox and the ZIP files
```

### Permissions

- `alarms`, `cookies`, `storage`
- `host_permissions`: `https://miaulario.unavarra.es/*`, `https://sso.unavarra.es/*`

### Components

1. **Keep-alive** (`background.js`): The script uses one alarm (`alarms.create('miaulario-ping', { when })`) with a random delay of 180 to 600 s. At each alarm, the script first sets the next alarm. Then it sends `fetch('https://miaulario.unavarra.es/direct/session/current.json', { credentials: 'include', cache: 'no-store' })`. The script records the time, the HTTP status and the login status in `storage`. With the longest delay (10 minutes), 6 pings occur in 60 minutes. This margin is sufficient if the browser stops the service worker for some time.
2. **Persistent cookies** (`background.js`): The script monitors `cookies.onChanged`. The server sets `SAKAISESSIONID`, `SERVERID` and `idpsession` without `expirationDate`. The script then writes the same cookie again, with the same flags and with `expirationDate` set to 30 days from now. Then the cookies stay after you close the browser.
3. **Login page** (`content.js`): When the portal opens, the script reads the session with `?auto=true`. If the session is not active, the script opens `/sakai-login-tool/container/saml/login`. To prevent a loop, this occurs a maximum of one time in 2 minutes.
4. **Manual logout:** If you click **Log out** (`/portal/logout` or `/saml/logout`), the extension pauses and removes the persistent cookies. While the extension is paused, it only reads the session with `?auto=true`. When you log in again, the extension starts again.
5. **Popup:** The popup shows the session status, the last ping, the time that remains and the next ping. It has the buttons **Ping now** and **Pause**.

### Differences between Chromium and Firefox

- `background`: Chromium uses `{"service_worker": "background.js"}`. Firefox uses `{"scripts": ["background.js"]}`. `build.sh` copies the applicable manifest.
- The Firefox manifest has `browser_specific_settings.gecko.id`. Some Firefox versions do not give the host permissions at install. In this condition, the popup shows a message and a button to give the permissions.
- The code uses `globalThis.browser ?? globalThis.chrome`. In Manifest V3, the two APIs return promises.

## Tests

1. Load the extension. In Chromium, open `chrome://extensions`, set **Developer mode** to on and click **Load unpacked**. In Firefox, open `about:debugging` and click **Load Temporary Add-on**.
2. In the popup, make sure that the last ping changes every 3 to 10 minutes.
3. Do not use the browser for 70 minutes. The session must stay active.
4. Close the browser. Open it again after 15 minutes. The session must stay active.
5. Set the computer to off for one night. Open MiAulario. The login page must open. Record if the SSO asks for a password. This result shows the duration of `idpsession`.
6. Click **Log out**. The extension must not open the login page.

## Open questions

- **The duration of the SSO session (`idpsession`) on the server.** It is not possible to read this value. The extension records each time that it opens the login page. These records can show the duration.
- **A maximum session duration in Sakai, in addition to the inactivity timeout.** By default, Sakai does not have this limit. If `userId` becomes empty while pings occur, the records will show it.
- **The "10 minutes" that users see.** The server ends the session after 60 minutes without activity. After 50 minutes, the page shows the warning "10 minutes". If the session ends before 60 minutes, the ping records will show it.
