# MiAulario Keep-Alive

MiAulario Keep-Alive is a browser extension for Chromium browsers and Firefox. It keeps your MiAulario (UPNA) session active while the browser is open. It also shows your deliveries, announcements, messages, new items and grades of all your courses in one place.

The interface is in Spanish. You can change it to English in the settings.

## Privacy

- The extension sends requests only to MiAulario (`miaulario.unavarra.es`). It does not connect to other servers. It has no analytics and no servers of its own.
- The extension also makes the cookie of the UPNA login page (`sso.unavarra.es`) last longer. It does not send requests to that page. Your browser opens it when you log in.
- The extension keeps the data that it needs only in your browser: the settings, a copy of your course data (deliveries, announcements, new items and grades) and what you read. Nobody else receives this data. The extension removes the course data when you log out.
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

- **Deliveries:** The deliveries of all your courses, with a countdown and a color for the urgency: red (less than 24 hours or late), orange (less than 72 hours), yellow (less than 7 days) and green. Groups: late, to do, returned, submitted and closed. A filter shows one site. A delivery is submitted only if its submission is not a draft.
- **Inbox:** The unread announcements, private messages and forum posts of all your sites in one list. Filter by type, by site and by unread items. The search does not use the case or the accents of the letters.
  - An announcement is read if you read it in the extension, or if the bell of MiAulario shows it as viewed.
  - When no unread announcement is left in a site, the extension tells the bell of MiAulario that the announcements of that site are viewed.
  - When you open the Announcements tool of a site in MiAulario, the extension marks the announcements of that site as read, also in the bell of MiAulario. MiAulario itself does not do this.
  - For messages and forums, MiAulario gives only the numbers of unread items. The inbox shows these numbers and a link to the tool.
- **New items:** For each site, the files, announcements, deliveries and forum posts that came after your last visit of that site. A visit of one site does not change the other sites. Use **Mark as seen** for one site or for all sites.
- **Grades:** The grade items of each site, with the grade or "Not graded". A new grade has the mark "New" until you open the tab.
  - **Calculator:** Click **Calculate** in a site. The calculator shows your current grade, the average that you need in the items without a grade to get your target (5 by default, you can change it for each site), and the lowest and highest possible final grade. It uses the weights of the categories, or the points if the site has no weights.
  - **Simulator:** Write possible grades for the items without a grade, and see the result. The extension does not keep these values.
  - The calculator gives an estimate. The page of MiAulario does not show all the rules of a site (for example, "drop the lowest grade"). If a grade of MiAulario is different from the calculation by more than 1 point, the calculator tells you that the result is approximate.
- **Sites:** Hide the sites that you do not use. Select if a hidden site hides only in the sidebar of MiAulario, or also in the extension.
- **Settings:** The keep-alive controls, the course data sync, the grade notifications, the number on the icon, the calendar export and the language.

### In MiAulario

- **Banner of new items:** When you open a site, a banner shows the items that came after your previous visit of that site: files, announcements, deliveries, forum posts and new grades. For a grade, the banner shows the name of the item, but not the grade. The next pages of the same visit show a short line. A new visit starts after 30 minutes without pages of the site.
- **Download all (ZIP):** In the Resources tool, a button downloads all the files of the site as one ZIP file with the same folders. You can also start it from the Sites tab of the popup.
- **Hidden sites:** The sidebar does not show the sites that you hid.

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
| When you open a site (a new visit) | The same as every 15 minutes, plus the files and the forum topics of that site |
| When you open the popup | The same as every 15 minutes, if the data is older than 2 minutes |
| When you click **Calculate** in the Grades tab | The Gradebook page of that site |

- The extension sends one request at a time, with a pause between the requests.
- Each request of the sync has the parameter `auto=true`. Sakai then does not record the request as activity. Only the keep-alive ping records activity.
- The Gradebook page is different: MiAulario records it as activity, also with `auto=true`. The extension reads this page only when you click **Calculate**.
- After a server error, the extension waits longer each time before it sends more requests.
- The extension does not send requests for hidden sites if you hide them also in the extension.
- To stop all these requests, turn off **Sync course data** in the settings.

## Install

Download the ZIP file for your browser from the [latest release](https://github.com/chareca/miaulario-keepalive/releases/latest).

The extension asks for these permissions: `alarms` (the ping), `cookies` (the persistent session cookies), `storage` (the settings and the course data), `notifications` (the grade notifications), and access to `miaulario.unavarra.es` and `sso.unavarra.es`.

### Chromium browsers (Chrome, Edge, Brave, Opera, Vivaldi, Arc, Helium)

1. Extract the file `miaulario-keepalive-chromium-vX.Y.Z.zip`.
2. Open `chrome://extensions`. In Edge, open `edge://extensions`.
3. Set **Developer mode** to on.
4. Click **Load unpacked**.
5. Select the folder that you extracted.

### Firefox

1. Extract the file `miaulario-keepalive-firefox-vX.Y.Z.zip`.
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

Node.js 20 or later is necessary. The tests do not need other packages.

```bash
node --test 'tests/*.test.js'
```

To see the popup and the pages with synthetic data in a normal browser tab:

```bash
node tests/harness/make.js
```

Then serve `tests/harness/out/` with a local web server, for example `python3 -m http.server 8766 --directory tests/harness/out`, and open `popup.html`, `site.html` or `tools.html?ics=1`.

## Contribute

- The commit messages follow Conventional Commits: `<type>(<optional scope>): <description>`.
- The texts of the code and of the documents follow ASD-STE100 (Simplified Technical English).
- The git hooks in `.githooks/` check the commit messages. To use them, run this command one time after you clone the repository:

```bash
git config core.hooksPath .githooks
```

## Technical details

Refer to [RESEARCH.md](RESEARCH.md). This file shows how the MiAulario session, the cookies, the APIs and the timeout operate.
