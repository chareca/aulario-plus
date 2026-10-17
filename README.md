# Aulario Plus

Aulario Plus is a browser extension for MiAulario, the virtual campus of the UPNA. It operates in Chromium browsers and Firefox. It keeps your MiAulario session active while the browser is open. It also shows your deliveries, announcements, messages, new items, calendar events and grades of all your courses in one place, with short names for your sites and one search for all of them. You can send the files of a site by the internal mail of MiAulario, without a download. You can also make a download link that works without a MiAulario login: the file is encrypted in your browser.

The interface is in Spanish. You can change it to English in the settings.

## Privacy

- The extension sends requests only to MiAulario (`miaulario.unavarra.es`). It has no analytics and no servers of its own.
- Exception, only if you enable the download links (off by default): the file goes, encrypted, to the Send server that you select, and the address of the link goes to a shortener. Neither of them can open the file alone. Refer to [Download links without a login](#download-links-without-a-login).
- The extension also makes the cookie of the UPNA login page (`sso.unavarra.es`) last longer. It does not send requests to that page. Your browser opens it when you log in.
- The extension keeps the data that it needs only in your browser: the settings (also the names that you give to the sites), a copy of your course data (deliveries, announcements, calendar events, new items and grades) and what you read. Nobody else receives this data. The extension removes the course data when you log out.
- The developers do not receive or keep any data.

> **Important**
> - The UPNA did not make this extension and does not support it.
> - Read the IT rules of the UPNA before you use this extension.
> - Do not use this extension on a shared computer. On a shared computer, the session timeout protects your account.

## Functions

### Session

- **Keep-alive ping:** At a random interval of 3 to 10 minutes, the extension sends a request to `/direct/session/current.json`. Sakai records this request as activity, and the 60-minute inactivity timer goes back to zero. The extension also operates when no MiAulario tab is open.
- **Persistent cookies:** The extension changes the session cookies (`SAKAISESSIONID`, `SERVERID`, `idpsession`) into persistent cookies. Then the session stays after you close the browser and open it again.
- **Login page:** If you open MiAulario and the session is not active, the extension opens the SSO login page. If the SSO session is active, you come back logged in. If not, enter your user name and password.
- **Manual logout:** If you click **Log out**, the extension pauses. It removes the persistent cookies and the course data. The extension starts again when you log in.

### Popup

- **Search:** The box below the header searches all your sites at the same time: sites, tools, deliveries, calendar events, files (with their folders), announcements, grade items and forum topics. Each word must be the start of a word: "inf rec" finds the Resources tool of "Informática". Case and accents are not important. `/` or Ctrl+K (⌘K on macOS) puts the focus in the box. The search uses the stored data and sends no requests.
- **Deliveries:** The deliveries of all your courses, with a countdown and a color for the urgency: red (less than 24 hours or late), orange (less than 72 hours), yellow (less than 7 days) and green. Groups: late, to do, returned, submitted and closed. A filter shows one site. A delivery is submitted only if its submission is not a draft.
  - **Week view:** 6 bars above the list: this week and the next 5 weeks (Monday to Sunday). Each bar shows the open deliveries and the events of the MiAulario calendar of the week. The color shows the load: grey for 0, green for 1 to 2, orange for 3 to 4, red for 5 or more. Click a bar to see only that week, with its calendar events.
  - **Changed dates:** If a teacher moves the due date of a delivery, the delivery has the mark "Date changed" for 7 days. The tooltip shows the earlier date.
- **Inbox:** The unread announcements, private messages and forum posts of all your sites in one list. Filter by type, by site and by unread items. The search does not use the case or the accents of the letters.
  - An announcement is read if you read it in the extension, or if the bell of MiAulario shows it as viewed.
  - When no unread announcement is left in a site, the extension tells the bell of MiAulario that the announcements of that site are viewed.
  - When you open the Announcements tool of a site in MiAulario, the extension marks the announcements of that site as read, also in the bell of MiAulario. MiAulario itself does not do this.
  - For messages and forums, MiAulario gives only the numbers of unread items. The inbox shows these numbers and a link to the tool.
- **New items:** For each site, the files, announcements, deliveries, changed due dates and forum posts that came after your last visit of that site. A visit of one site does not change the other sites. Use **Mark as seen** for one site or for all sites.
- **Grades:** The grade items of each site, with the grade or "Not graded". A new grade has the mark "New" until you open the tab.
  - **Calculator:** Click **Calculate** in a site. The calculator shows your current grade, the average that you need in the items without a grade to get your target (5 by default, you can change it for each site), and the lowest and highest possible final grade. It uses the weights of the categories, or the points if the site has no weights.
  - **Simulator:** Write possible grades for the items without a grade, and see the result. The extension does not keep these values.
  - The calculator gives an estimate. The page of MiAulario does not show all the rules of a site (for example, "drop the lowest grade"). If a grade of MiAulario is different from the calculation by more than 1 point, the calculator tells you that the result is approximate.
- **Sites:** Hide the sites that you do not use. Select if a hidden site hides only in the sidebar of MiAulario, or also in the extension.
  - **Short names:** The extension removes the code at the start of a site title and changes a title in capital letters to the capitalization of a Spanish title: "26_0_240504_1 ANÁLISIS DE APLICACIONES EMPRESARIALES" becomes "Análisis de Aplicaciones Empresariales". You can turn this off in the settings.
  - **Your own names:** Click ✎ next to a name to write a name of your choice, for example "AAE". The extension keeps it and shows it in all the tabs, in MiAulario, in the ZIP and in the calendar export. An empty name goes back to the automatic name. The pencil is also on the cards of the Grades and New items tabs.
- **Settings:** The keep-alive controls, the course data sync, the grade notifications, the site names, the search shortcut, the forward guide for the internal mail, the MiAulario checks, the number on the icon, the calendar export and the language.

### In MiAulario

- **Site names:** MiAulario shows the short names or your own names: in the sidebar, in the favorites, in the page header and in the title of the browser tab. A ✎ next to each name in the sidebar, and next to the name in the page header, lets you change the name of the site. The extension does not change text fields, editors, or a site title inside a longer text.
- **Search (Ctrl+K):** Ctrl+K (⌘K on macOS) opens the same search as the popup. Enter opens the result in the same tab, Ctrl+Enter (⌘Enter) in a new tab. The shortcut does not operate in a text field or in an editor, where Ctrl+K adds a link. You can turn it off in the settings.
- **Banner of new items:** When you open a site, a banner shows the items that came after your previous visit of that site: files, announcements, deliveries, changed due dates, forum posts and new grades. For a grade, the banner shows the name of the item, but not the grade. The next pages of the same visit show a short line. A new visit starts after 30 minutes without pages of the site.
- **Download all (ZIP):** In the Resources tool, a button downloads all the files of the site as one ZIP file with the same folders. You can also start it from the Sites tab of the popup.
- **Hidden sites:** The sidebar does not show the sites that you hid.

### Internal mail ("Correo interno")

The "Correo interno" of MiAulario is the Messages tool of each site. It sends only to the persons of that site. A copy goes to the email address of each recipient in MiAulario (for students, `@e.unavarra.es`).

- **Send files of the Resources tool:** In the Resources tool, each file has a button ✉. When you select files, a bar shows "Send as a message" and "Send them to me". The server of MiAulario attaches a copy of each file: nothing is downloaded to your computer.
- **The send window:** select "To me" or "To other persons" (with a search in the list of the site). The extension writes a subject and a message; you can change them. They use the full name of the site, not the name that you gave to it: the recipients do not know your names. The message is an internal message of MiAulario: it goes to the message inbox of each recipient. The option "Also send a copy to their email address" is on. Then:
  - **Open in MiAulario:** the extension prepares the message with the files in the internal mail of the site and opens it in a new tab. You examine it and send it.
  - **Send now:** the extension sends it. A message to you needs one confirmation.
  - **Share:** the share menu of the system with the files (only if your browser has it). The files stay in memory.
- **Receive in a different email:** The internal mail cannot send to an address outside MiAulario. The subject of the messages to you starts with `[Aulario Plus]`, so a forward filter in your UPNA email can send them to your other address. The settings show the steps for Gmail and Outlook.

### Download links without a login

The copy by email of the internal mail has a link to the file, and this link asks for a MiAulario login. To send a file to a person who is not in the site, the send window can add a download link that works without a login. Enable it in Settings → "Download links without a login". The browser asks for permission for the Send server and for the shorteners.

How the extension makes the link:

1. The background script gets the files from MiAulario with your session. More than one file: one ZIP file.
2. The browser encrypts the file and its name with a new random key (16 bytes). It uses the format of [Send](https://github.com/timvisee/send) (the open-source fork of Firefox Send): AES-128-GCM in records of 64 KiB.
3. The extension uploads only the encrypted data to the Send server (default `send.vis.ee`), with the number of downloads and the time limit (default: 1 download, 1 day).
4. The key goes in the link after `#`. A browser never sends this part to a server.
5. The shortener makes a short address. If one shortener does not answer, the next one makes it: is.gd, then spoo.me, then TinyURL. None needs an API key.

The forms of the link:

| Form | Example | The shortener gets | The recipient |
|---|---|---|---|
| Very short + password (default) | `https://spoo.me/AbC123` and `k7m2x9qp` | the full link, with the key | clicks and types the password one time |
| Short, no password | `https://is.gd/AbC12x#q3Xz9Lk2Pw8rT5vN1mB7cA` | the address without the key | clicks |
| Long, no shortener | `https://send.vis.ee/download/…/#…` | nothing | clicks |

Who sees what:

- **The Send server** keeps only encrypted data. It never gets the key, so it cannot read the file or its name.
- **The shortener**, with "Very short + password", gets the key but not the password. Without the password, the Send server does not give the encrypted file. The password (8 characters, about 2<sup>40</sup> possible values) does not go to the shortener. The Send server keeps only a value made from it (PBKDF2), with the full link as salt.
- **The shortener**, with "Short, no password", gets only the address before `#`.
- **A person with the link and the password** can download the file, for the number of downloads and the time that you selected. After that, the Send server deletes it.

The send window adds the link, the password and the limits to the message ("Open in MiAulario" or "Send now"). "Only make the link" makes the link to copy and send in a different way.

### Grade notifications

When the sync finds a new grade, the extension shows a system notification. For 1 to 3 grades, you get one notification for each grade. For 4 or more grades, you get one summary. The notification shows the site and the item, but not the grade, because other persons can see your screen. Click the notification to open the item in MiAulario, or the Grades tab for a summary. You can turn off the notifications in the settings.

- The extension checks the grades every 15 minutes while you are logged in. If a grade comes while you are logged out, the extension does not tell you about it. The Grades tab shows the grade.
- The first sync after you log in does not show notifications: it only records the grades that exist.
- There are no notifications for hidden sites.

### Number on the icon

The number shows the deliveries that are late or due in 72 hours or less, the unread announcements, the unread messages and the new grades. The unread forum posts are an option. The number is red if a delivery is late or due in less than 24 hours. You can turn off the number, or select what it counts.

### Calendar export

The extension makes an `.ics` file with your deliveries and the events of the MiAulario calendar (from 30 days ago to one year from now). Import the file in Google Calendar, Apple Calendar or Outlook. The file is a copy of one moment: export it again to get the changes. Each event has a fixed ID, so most calendar apps update the event and do not add it two times.

## Requests to MiAulario

The extension reads your course data from MiAulario with these requests:

| When | Requests |
|---|---|
| Every 15 minutes (every hour after 12 hours without use) | Session, deliveries, grades, unread counts, bell notifications, announcements of the last 7 days, and forum topics of the sites with unread posts |
| Every 4 hours | All the announcements of the last 60 days, and the files and forum topics of all the sites |
| Every 6 hours | The sites, and the events of the MiAulario calendar of this week and the next 5 weeks |
| Every 24 hours | The pages (menu) of each site |
| When you use the internal mail | The forms of the Messages tool of the site, and the attachment page |
| When you start the MiAulario checks | The APIs above, some pages of a site, and the forms of the internal mail (cancelled) |
| When you open a site (a new visit) | The same as every 15 minutes, plus the files and the forum topics of that site |
| When you open the popup | The same as every 15 minutes, if the data is older than 2 minutes |
| When you click **Calculate** in the Grades tab | The Gradebook page of that site |

- The extension sends one request at a time, with a pause between the requests.
- Each request of the sync has the parameter `auto=true`. Sakai then does not record the request as activity. Only the keep-alive ping records activity.
- The Gradebook page, the pages of a site and the forms of the internal mail are different: MiAulario records them as activity, also with `auto=true`. The extension reads them only when you use these functions.
- After a server error, the extension waits longer each time before it sends more requests.
- The extension does not send requests for hidden sites if you hide them also in the extension.
- To stop all these requests, turn off **Sync course data** in the settings.

## Install

Download the ZIP file for your browser from the [latest release](https://github.com/chareca/aulario-plus/releases/latest).

The extension asks for these permissions: `alarms` (the ping), `cookies` (the persistent session cookies), `storage` (the settings and the course data), `notifications` (the grade notifications), and access to `miaulario.unavarra.es` and `sso.unavarra.es`.

### Chromium browsers (Chrome, Edge, Brave, Opera, Vivaldi, Arc, Helium)

1. Extract the file `aulario-plus-chromium-vX.Y.Z.zip`.
2. Open `chrome://extensions`. In Edge, open `edge://extensions`.
3. Set **Developer mode** to on.
4. Click **Load unpacked**.
5. Select the folder that you extracted.

### Firefox

1. Extract the file `aulario-plus-firefox-vX.Y.Z.zip`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on**.
4. Select the file `manifest.json` in the folder that you extracted.
5. Open the extension popup. If the popup shows a permission message, click **Give permission**.

Firefox removes a temporary add-on when you close the browser. To keep the add-on, sign it as "unlisted" on addons.mozilla.org. This service is free.

## Build from the source code

Python 3 and `zip` are necessary.

```bash
./build.sh
```

The script makes these items in `dist/`:

- `chromium/` and `firefox/`: the extension folders.
- One ZIP file for each browser.

## Tests

Node.js 22 or later is necessary. The tests do not need other packages.

```bash
node --test 'tests/*.test.js'
```

Some tests read HTML pages, so they run in a headless Chromium (`tests/browser/run.mjs`). The script finds the Chrome for Testing of Playwright or Chromium, or uses the browser in `CHROME_PATH`. Without a browser, these tests are skipped.

### When MiAulario changes

The MiAulario checks tell which part of MiAulario changed. They only read: in the internal mail, they open the compose form and the attachment page, then they cancel.

- **In the extension:** Settings → "MiAulario checks". The page shows each result and has "Copy the report" (without personal data).
- **For the development:** a test browser opens with the extension and its own profile. The first time, log in to MiAulario in that window.

```bash
./build.sh && node tests/live/run.mjs
```

The exit code is 1 if a check fails.

To see the popup and the pages with synthetic data in a normal browser tab:

```bash
node tests/harness/make.js
```

Then serve `tests/harness/out/` with a local web server, for example `python3 -m http.server 8766 --directory tests/harness/out`, and open `popup.html`, `site.html`, `tools.html?ics=1` or `tools.html?check=1`.

## Contribute

- The commit messages follow Conventional Commits: `<type>(<optional scope>): <description>`.
- The texts of the code and of the documents follow ASD-STE100 (Simplified Technical English).
- The git hooks in `.githooks/` check the commit messages. To use them, run this command one time after you clone the repository:

```bash
git config core.hooksPath .githooks
```

## Technical details

Refer to [RESEARCH.md](RESEARCH.md). This file shows how the MiAulario session, the cookies, the APIs and the timeout operate.
