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

## APIs for the course data (versions 1.2.0 to 1.4.0)

All these endpoints answer with JSON for the session cookie. The parameter `auto=true` works on all of them: Sakai does not record the request as activity (test: 9 requests, and the inactivity timer did not go back to zero).

| Data | Endpoint | Fields that the extension uses |
|---|---|---|
| Sites | `/direct/site.json?_limit=200` | `id`, `title`, `type` |
| Tools of a site | `/direct/site/{id}/pages.json` | page `id`, `title` and `url` (the menu of the site, for the search), tool `id` (placement) and `toolId` |
| Deliveries of all sites | `/direct/assignment/my.json` | `dueTime`, `closeTime`, `openTime`, `timeCreated` (`{epochSecond, nano}`), `submissionType`, `submissions[]` (`submitted`, `draft`, `returned`, `graded`, `canSubmit`) |
| Announcements of all sites | `/direct/announcement/user.json?n=&d=` | `id` (`{site}:main:{uuid}`), `announcementId` (uuid), `createdOn` (ms), `body` (HTML), `attachments` |
| Bell notifications | `GET /api/users/me/notifications` | `event` (`annc.new`, ...), `ref` (`/announcement/msg/{site}/main/{uuid}`), `viewed`, `url` |
| Mark notifications as viewed | `POST /api/users/me/notifications/markViewed?siteId=&toolId=` | All the notifications of one tool in one site. There is no request for one notification. |
| Unread counts | `/direct/synopticmsgcntritem.json` | `newMessagesCount`, `newForumCount` for each site |
| Forum topics | `/direct/forums/site/{id}.json`, `/direct/forums/site/{id}/forum/{forumId}.json` | `topics[]`: `readMessages`, `totalMessages`, `modifiedDate` |
| Files | `/direct/content/site/{id}.json` | A flat list of all the folders and files: `type`, `url`, `size`, `modifiedDate` (`yyyyMMddHHmmssSSS`, UTC), `webLinkUrl`, `copyrightAlert` |
| Calendar | `/direct/calendar/my.json?firstDate=&lastDate=` | `firstTime.time`, `duration`, `type`, `siteName`, `assignmentId` |
| Grades of all sites | `GET /api/users/me/grades` | `grades[]`: `id`, `name`, `score` (text, empty if no grade), `notGradedYet`, `siteId`, `siteTitle`, `url`, `canGrade` (the extension ignores the items with `canGrade: true`) |
| Gradebook of a site (HTML) | `/portal/tool/{placement of sakai.gradebookng}` | Categories: `tr.gb-summary-category-row` (`.gb-summary-category-name`, `.gb-summary-category-weight` "40%", `.gb-summary-category-grade`). Items: `tr.gb-summary-grade-row` (`.gb-summary-grade-title`, `.gb-summary-grade-score-raw` "-" if no grade, `.gb-summary-grade-score-outof` "/10"). `.gb-flag-not-counted` is only in the items that do not count. Course grade: `.gb-summary-course-grade-value`. Without categories, the item rows have the class `gb-no-categories`. |

Live tests (2026-10-16, with the code of version 1.2.0):

- A full sync: 27 steps, no errors, 10 seconds. The inactivity timer did not go back to zero.
- `modifiedDate` is UTC: for 6 files, the date is the same as the `Last-Modified` header (0 minutes of difference).
- To open the Announcements tool does **not** mark the bell notifications of that site as viewed. `POST markViewed` does it (HTTP 200).
- A ZIP of a site with 6 folders: 19 files and 7 folders, all CRCs correct.

Live tests (2026-10-16, with the code of version 1.3.0):

- `/api/users/me/grades`: 7 items in 3 sites. With `auto=true`, the inactivity timer did not go back to zero.
- **The portal ignores `auto=true` for the Gradebook page.** After `GET /portal/tool/{placement}?auto=true`, the inactivity timer went back to zero. The popup reads this page only when the user clicks "Calculate".
- `/direct/gradebook/...` returns HTTP 501. The Gradebook page is the only source of the weights and the maximum points.
- The calculator read the 3 real Gradebooks: one with 2 weighted categories, two without categories. Each Gradebook has one item with the flag "not counted" (a visible icon with a title).

Live tests (2026-10-17, with the code of version 1.4.0):

- **How MiAulario shows the name of a site:**
  - The page header (`.portal-header-site-title a`) and the tab title show the full title ("26_0_240802_1_G COMPLEJIDAD Y COMPUTABILIDAD").
  - The sidebar (`a.sidebar-site-title`), the favorites (`.fav-title span.fullTitle`) and the organizer of the favorites show the title without the code, in capital letters. The `title` attribute of these elements has the full title.
  - The renamer of the extension changed all these places and did not change the site description (a title inside a longer text).
- No script of the MiAulario page (42 scripts) uses Ctrl+K.
- `/direct/calendar/my.json?firstDate=&lastDate=` with `auto=true`: the inactivity timer did not go back to zero. 12 events in 6 weeks, all with `siteId`.
- `pages.json`: each page has `title` and `url` ("Recursos", "Tareas", "Libro de evaluación", ...).

Limits:

- Private messages and forum posts: MiAulario gives only the numbers of unread items. The Messages tool is a JSF page, and the endpoint for one forum message returns HTTP 500.
- The mail archive endpoint returns HTTP 404.
- `/api/users/me/grades` does not give the maximum points or the categories. The calculator must read the Gradebook page.
- Deep links: `/portal/directtool/{placement}?itemReference=/announcement/msg/{site}/main/{uuid}&sakai_action=doShowmetadata` opens one announcement. `/portal/directtool/{placement}?assignmentId={id}&panel=Main&sakai_action=doView_submission` opens one delivery.

## The internal mail (version 1.5.0)

"Correo interno" is the Messages tool of Sakai (`sakai.messages`, JSF). It is in 9 of 11 sites of the test account. MiAulario has no API to send a message (`/direct/describe`: 87 entity providers, none sends). The extension uses the forms, the same as a person:

| Step | Request | Form data |
|---|---|---|
| Inbox | `GET /portal/tool/{placement}/privateMsg/pvtMsgHpView` | form `msgForum`, link `msgForum:composeMessage` (`mojarra.jsfcljs`) |
| Compose form | `POST` the form `msgForum` with `msgForum:composeMessage` | form `compose`: `compose:list1` ("To", values = user ids), `compose:list2` (BCC), `compose:send_email_out` (copy by email, on by default), `compose:subject`, `compose:pvt_message_body_inputRichText`, and the buttons "Añadir adjuntos", "Enviar", "Vista preliminar", "Guardar borrador", "Cancelar" (names `compose:j_id_jsp_…`, they change) |
| Attachment page | `POST` the form `compose` with "Añadir adjuntos" (the server keeps all the fields) | `sakai.filepicker.helper`: form `doattachitem` (`sakai_action=doAttachitem`, `itemId`, `sakai_csrf_token`) and form `attachForm` |
| Attach a file | `POST` (multipart) `doattachitem` with `itemId=/group/{site}/{path}` | The server attaches a copy of the resource. Nothing is downloaded. |
| Back to the form | `POST` `attachForm` to `?sakai_action=doAddattachments` ("Continuar") or `?sakai_action=doCancel` | The compose form, with the fields and the files |
| Send | `POST` the form `compose` with "Enviar" | The inbox (`msgForum`) |

Live tests (2026-10-17):

- A prepared form stays on the server. When the user opens the tool (the URL of its page), the tool shows the form with the recipient, the subject, the message and the files. This is "Open the mail".
- "Send now" to the user: sent in 0.85 s. The message was in the folder "Recibido", and the copy went to the email address.
- The user is in the list "To". The list has "Todos los participantes", the roles and each person (`SURNAME, Name (eid)`).
- `/direct/site/{site}/memberships.json` (with `auto=true`) gives the members of a site (`userId` = the value of the list "To"). For version 1.5.1.
- `/direct/profile/{id}/connections.json` returns the profile of the user, not a list of friends.
- "Mi cuenta" is LDAP: the user cannot change the email address. The domain `e.unavarra.es` uses Proofpoint (MX).

## Download links without a login (version 1.5.0)

The copy by email of the internal mail has a link to `/access/content/...`, and this link asks for a MiAulario login. The extension makes a download link with [Send](https://github.com/timvisee/send) (the fork of Firefox Send by timvisee), from the source code of Send (`app/keychain.js`, `app/ece.js`, `app/api.js`, `server/routes/ws.js`, `server/middleware/auth.js`):

| Step | Data |
|---|---|
| Keys | secret = 16 random bytes. HKDF-SHA-256 (empty salt): `metadata` → AES-128-GCM key; `authentication` → HMAC-SHA-256 key (64 bytes) |
| Metadata | AES-GCM (IV of 12 zero bytes) of `{name, size, type, manifest: {files: [...]}}` |
| Content | `aes128gcm`: header = salt (16) + record size (65536) + 0. Key and nonce base with HKDF (`Content-Encoding: aes128gcm\0`, `Content-Encoding: nonce\0`). Each record: data + 1 (the last record: data + 2). The nonce of a record: the last 4 bytes XOR the sequence number |
| Upload | WebSocket `/api/ws`: JSON `{fileMetadata, authorization: "send-v1 <auth key>", timeLimit, dlimit}` → `{url, id, ownerToken}` → the records → one byte 0 → `{ok: true}` |
| Password | `POST /api/password/{id}` `{owner_token, auth}`. auth = PBKDF2-SHA-256 (100 iterations, 64 bytes) of the password, with the full link (with `#key`) as salt. The download page uses `location.href` as salt |
| Limits | `GET /config`. send.vis.ee: 2.5 GiB, 20 downloads, 3 days |

Live tests (2026-10-17, synthetic file of 150 000 bytes, 1 download, 5 minutes):

- Upload, password and short link: about 1 s. In a real Chrome, the short link opened the download page of Send. The page asked for the password, refused a wrong password and accepted the correct password. The downloaded file had the same bytes. A second visit showed "This link has expired".
- Send and the shorteners send no CORS headers. The extension needs host permissions for them (`optional_host_permissions`, asked when the user enables the links).
- Shorteners without an API key:
  - is.gd (and v.gd, the same operator): on this day, it gave only links that existed before. New links: "Error, database insert failed".
  - spoo.me: correct. The browser keeps the `#` part after the redirect.
  - TinyURL: correct for a full link. The browser loses the `#` part of the short link after the redirect, so TinyURL is not used for the form "Short, no password".
  - da.gd: a page "This short url was created recently" before the redirect. Not used.
- The order: is.gd, spoo.me, TinyURL (TinyURL only for the full link).

## Links to a delivery and to an announcement

Versions 1.2.0 to 1.5.0 opened a delivery with `/portal/directtool/{placement}?assignmentId={id}&sakai_action=doView_submission`. In `AssignmentAction` (Sakai 23), `getAssignment` accepts an id or a reference, but `getSubmission(reference, user)` accepts only the reference (`/assignment/a/{site}/{id}`). With the id only, the tool did not find the submission of the user:

- An assignment with an honor pledge showed the pledge again after "De acuerdo" (live test, 2026-10-17: the pledge was accepted, and this link still showed it).
- An assignment without a pledge could show an empty submission.

Since version 1.5.0, the link is the same as the link of the list in the tool: `/portal/site/{site}/tool/{placement}?assignmentReference=/assignment/a/{site}/{id}&panel=Main&sakai_action=doView_submission`. Live test: it opens the submission page. The link of an announcement also opens in the page of the site (`itemReference`, `doShowmetadata`), with the menu of the site. Sakai answers a request with `sakai_action` with a redirect to `?panel=Main`, so a reload does not do the action again.

## Login and the persistent cookies

A bug of versions 1.0 to 1.4: the extension wrote the value of each cookie event. At login, MiAulario changes `SAKAISESSIONID` a few milliseconds after the previous change. A late event of the old cookie could then write the old (logged-out) session over the new session, and the user saw the page "not logged in" after a correct login. Since version 1.5.0, the extension reads the cookie before it writes, and writes only the value that the browser has now.

## Not in the design

- **A remote server that sends pings with your session cookie.** This method keeps the session active when your computer is off. But your session is then on a different computer, and a person with that cookie has access to your account. Also, this method does not agree with the purpose of the UPNA rules.
- **The password in the extension.** The storage of an extension is not encrypted. The password manager of the browser is safer.

## Design of the extension (version 1.5.0)

The extension has one source code for Chromium browsers and Firefox (128 or later). It uses Manifest V3 and no build tools. The shared files are classic scripts that attach to `globalThis.MAK`. Node can also load them for the tests.

### Files

```
extension/
  manifest.chromium.json   Chromium manifest ("background.service_worker")
  manifest.firefox.json    Firefox manifest ("background.scripts")
  common/
    background.js          ping, persistent cookies, message and alarm routers, badge
    content-early.js       at document_start: hides the selected sites and shows the site names
    content.js             login page, logout, visits, Announcements tool, ZIP button
    content-banner.js      the banner of new items and the ZIP button (closed shadow root)
    content-names.js       the pencils next to the site names (sidebar and page header)
    content-search.js      the search palette (Ctrl+K)
    content-mail.js        the buttons "Send by mail" in the Resources tool
    popup.html, popup.js   tabs: deliveries, inbox, new items, grades, sites, settings
    tools.html, tools.js   ZIP download and calendar export (in a tab)
    _locales/              name and description of the extension (Spanish, English)
    lib/core.js            dates, text, safe URLs, portal paths
    lib/store.js           settings and the storage queue (only the background writes)
    lib/api.js             one function for each endpoint, and the trim functions
    lib/sync.js            the sync engine
    lib/due.js, inbox.js, news.js   the models of the popup tabs
    lib/grades.js          new grades, and the grade calculator
    lib/names.js           short names and names from the user
    lib/search.js          the search index of all the sites
    lib/pm.js              the engine of the internal mail (readers of the pages, and the flow)
    lib/mail-ui.js         the send window
    lib/checks.js          the MiAulario checks (diagnostic page and live checks)
    lib/i18n.js, ui.js     texts (Spanish and English) and DOM helpers
    lib/zip.js, ics.js     ZIP writer and iCalendar writer
    lib/send.js            the client of Send (encryption, upload, password) and the shorteners
tests/                     Node tests, synthetic data and a test harness
  browser/                 the DOM tests in a headless Chromium
  live/                    the MiAulario checks in a test browser
```

### Rules

- Only the background script writes to the storage, through one queue. The popup, the tools page and the content scripts read the storage and send messages.
- The background script accepts a message only from a page of the extension or from a content script in the top frame of MiAulario. A content script can send only some messages.
- All the texts of the page go in with `textContent`. Links are http or https only. Links to MiAulario come from validated ids.
- If a request fails, the extension keeps the old data. If a different user logs in, or the user logs out, the extension removes all the course data.
- The badge uses the `action` API. The ZIP and the `.ics` file are saved from a page of the extension.
- Version 1.3.0 adds the `notifications` permission for the grade notifications. A notification shows the site and the item, but not the grade.
- The service worker of Chrome has no `DOMParser`. The popup reads the Gradebook page and calculates. It does not keep the page.
- Version 1.5.0 adds `optional_host_permissions` (`https://*/*`) for the download links. The extension asks only for the Send server and the shorteners, and only when the user enables the links.

## Tests

1. Node tests: `node --test 'tests/*.test.js'`. They use synthetic data with the same shapes as the real responses. The DOM tests run in a headless Chromium (`tests/browser/run.mjs`).
2. MiAulario checks: `node tests/live/run.mjs` (or Settings → "MiAulario checks"). The first live run passed all 15 checks.
3. Test harness: `node tests/harness/make.js` makes a copy of the pages with a mock extension API, the real background script and synthetic data.
4. Manual tests in Chrome and Firefox:
   - The session must stay active after 70 minutes without use.
   - Close the browser and open it again after 15 minutes. The session must stay active.
   - Read an announcement in the extension, and look at the bell of MiAulario. Read one in MiAulario, and look at the extension.
   - Open a site. The banner must show the new items of that site only.
   - Download the ZIP of a site. Export the `.ics` file and import it in a calendar.
   - Hide a site in the two modes.
   - Open the Grades tab. Click **Calculate** in each site and compare the result with the Gradebook of MiAulario. Change the target and use the simulator.
   - When a new grade comes: a system notification, the mark "New" in the Grades tab, the number on the icon and the banner of the site.
   - Give a name to a site with ✎ in the popup and in the page header. Look at the sidebar, the favorites, the header and the tab title.
   - Search from the popup and with Ctrl+K in MiAulario. Press Ctrl+K in the editor of an announcement: the editor must get it.
   - Click a bar of the week view.
   - In the Resources tool, send a file to you: "Open the mail" and "Send now". Select two files and use the bar.
   - Enable the download links. Make a link with "Only make the link", open it in a private window, type the password and download the file. Open the link again: it must show that the link expired.
   - Click **Log out**. The extension must not open the login page.

## Open questions

- **The duration of the SSO session (`idpsession`) on the server.** It is not possible to read this value. If the login page asks for the password after one night, the SSO session ended.
- **A maximum session duration in Sakai, in addition to the inactivity timeout.** By default, Sakai does not have this limit.
- **The "10 minutes" that users see.** The server ends the session after 60 minutes without activity. After 50 minutes, the page shows the warning "10 minutes".
