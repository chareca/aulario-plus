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

## APIs for the course data (version 1.2.0)

All these endpoints answer with JSON for the session cookie. The parameter `auto=true` works on all of them: Sakai does not record the request as activity (test: 9 requests, and the inactivity timer did not go back to zero).

| Data | Endpoint | Fields that the extension uses |
|---|---|---|
| Sites | `/direct/site.json?_limit=200` | `id`, `title`, `type` |
| Tools of a site | `/direct/site/{id}/pages.json` | page `id` and `url`, tool `id` (placement) and `toolId` |
| Deliveries of all sites | `/direct/assignment/my.json` | `dueTime`, `closeTime`, `openTime`, `timeCreated` (`{epochSecond, nano}`), `submissionType`, `submissions[]` (`submitted`, `draft`, `returned`, `graded`, `canSubmit`) |
| Announcements of all sites | `/direct/announcement/user.json?n=&d=` | `id` (`{site}:main:{uuid}`), `announcementId` (uuid), `createdOn` (ms), `body` (HTML), `attachments` |
| Bell notifications | `GET /api/users/me/notifications` | `event` (`annc.new`, ...), `ref` (`/announcement/msg/{site}/main/{uuid}`), `viewed`, `url` |
| Mark notifications as viewed | `POST /api/users/me/notifications/markViewed?siteId=&toolId=` | All the notifications of one tool in one site. There is no request for one notification. |
| Unread counts | `/direct/synopticmsgcntritem.json` | `newMessagesCount`, `newForumCount` for each site |
| Forum topics | `/direct/forums/site/{id}.json`, `/direct/forums/site/{id}/forum/{forumId}.json` | `topics[]`: `readMessages`, `totalMessages`, `modifiedDate` |
| Files | `/direct/content/site/{id}.json` | A flat list of all the folders and files: `type`, `url`, `size`, `modifiedDate` (`yyyyMMddHHmmssSSS`, UTC), `webLinkUrl`, `copyrightAlert` |
| Calendar | `/direct/calendar/my.json?firstDate=&lastDate=` | `firstTime.time`, `duration`, `type`, `siteName`, `assignmentId` |

Limits:

- Private messages and forum posts: MiAulario gives only the numbers of unread items. The Messages tool is a JSF page, and the endpoint for one forum message returns HTTP 500.
- The mail archive endpoint returns HTTP 404.
- Deep links: `/portal/directtool/{placement}?itemReference=/announcement/msg/{site}/main/{uuid}&sakai_action=doShowmetadata` opens one announcement. `/portal/directtool/{placement}?assignmentId={id}&panel=Main&sakai_action=doView_submission` opens one delivery.

## Not in the design

- **A remote server that sends pings with your session cookie.** This method keeps the session active when your computer is off. But your session is then on a different computer, and a person with that cookie has access to your account. Also, this method does not agree with the purpose of the UPNA rules.
- **The password in the extension.** The storage of an extension is not encrypted. The password manager of the browser is safer.

## Design of the extension (version 1.2.0)

The extension has one source code for Chromium browsers and Firefox (128 or later). It uses Manifest V3 and no build tools. The shared files are classic scripts that attach to `globalThis.MAK`. Node can also load them for the tests.

### Files

```
extension/
  manifest.chromium.json   Chromium manifest ("background.service_worker")
  manifest.firefox.json    Firefox manifest ("background.scripts")
  common/
    background.js          ping, persistent cookies, message and alarm routers, badge
    content-early.js       at document_start: hides the selected sites
    content.js             login page, logout, visits, Announcements tool, ZIP button
    content-banner.js      the banner of new items and the ZIP button (closed shadow root)
    popup.html, popup.js   tabs: deliveries, inbox, new items, sites, settings
    tools.html, tools.js   ZIP download and calendar export (in a tab)
    _locales/              name and description of the extension (Spanish, English)
    lib/core.js            dates, text, safe URLs, portal paths
    lib/store.js           settings and the storage queue (only the background writes)
    lib/api.js             one function for each endpoint, and the trim functions
    lib/sync.js            the sync engine
    lib/due.js, inbox.js, news.js   the models of the popup tabs
    lib/i18n.js, ui.js     texts (Spanish and English) and DOM helpers
    lib/zip.js, ics.js     ZIP writer and iCalendar writer
tests/                     Node tests, synthetic data and a test harness
```

### Rules

- Only the background script writes to the storage, through one queue. The popup, the tools page and the content scripts read the storage and send messages.
- The background script accepts a message only from a page of the extension or from a content script in the top frame of MiAulario. A content script can send only some messages.
- All the texts of the page go in with `textContent`. Links are http or https only. Links to MiAulario come from validated ids.
- If a request fails, the extension keeps the old data. If a different user logs in, or the user logs out, the extension removes all the course data.
- The extension has no new permissions in version 1.2.0. The badge uses the `action` API. The ZIP and the `.ics` file are saved from a page of the extension.

## Tests

1. Node tests: `node --test 'tests/*.test.js'`. They use synthetic data with the same shapes as the real responses.
2. Test harness: `node tests/harness/make.js` makes a copy of the pages with a mock extension API, the real background script and synthetic data.
3. Manual tests in Chrome and Firefox:
   - The session must stay active after 70 minutes without use.
   - Close the browser and open it again after 15 minutes. The session must stay active.
   - Read an announcement in the extension, and look at the bell of MiAulario. Read one in MiAulario, and look at the extension.
   - Open a site. The banner must show the new items of that site only.
   - Download the ZIP of a site. Export the `.ics` file and import it in a calendar.
   - Hide a site in the two modes.
   - Click **Log out**. The extension must not open the login page.

## Open questions

- **The duration of the SSO session (`idpsession`) on the server.** It is not possible to read this value. If the login page asks for the password after one night, the SSO session ended.
- **A maximum session duration in Sakai, in addition to the inactivity timeout.** By default, Sakai does not have this limit.
- **The "10 minutes" that users see.** The server ends the session after 60 minutes without activity. After 50 minutes, the page shows the warning "10 minutes".
