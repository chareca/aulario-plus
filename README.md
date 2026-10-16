# MiAulario Keep-Alive

MiAulario Keep-Alive is a browser extension for Chromium browsers and Firefox. It keeps your MiAulario (UPNA) session active while the browser is open. When the session ends, the extension opens the login page.

## Privacy

- The extension sends requests only to MiAulario (`miaulario.unavarra.es`). It does not connect to other servers. It has no analytics and no servers of its own.
- The extension also makes the cookie of the UPNA login page (`sso.unavarra.es`) last longer. It does not send requests to that page. Your browser opens it when you log in.
- The extension keeps the data that it needs only in your browser: the settings, a copy of your course data (deliveries, announcements and new items) and what you read. Nobody else receives this data. The extension removes the course data when you log out.
- The developers do not receive or keep any data.

> **Important**
> - The UPNA did not make this extension and does not support it.
> - Read the IT rules of the UPNA before you use this extension.
> - Do not use this extension on a shared computer. On a shared computer, the session timeout protects your account.

## Functions

- **Keep-alive ping:** At a random interval of 3 to 10 minutes, the extension sends a request to `/direct/session/current.json`. Sakai records this request as activity, and the 60-minute inactivity timer goes back to zero. The extension also operates when no MiAulario tab is open.
- **Persistent cookies:** The extension changes the session cookies (`SAKAISESSIONID`, `SERVERID`, `idpsession`) into persistent cookies. Then the session stays after you close the browser and open it again.
- **Login page:** If you open MiAulario and the session is not active, the extension opens the SSO login page. If the SSO session is active, you come back logged in. If not, enter your user name and password.
- **Manual logout:** If you click **Log out**, the extension pauses and removes the persistent cookies. The extension starts again when you log in.

The extension does not keep your password.

## Install

Download the ZIP file for your browser from the [latest release](https://github.com/chareca/miaulario-keepalive/releases/latest).

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

## Popup

The popup shows:

- The session status.
- The time since the last ping, with the HTTP status.
- The approximate time that remains before the session ends.
- The time until the next ping.

Click **Ping now** to send a ping immediately. Click **Pause** to stop the pings. Clear the check box to stop the automatic login page.

## Limits

- If the computer is off or in sleep mode, the extension does not operate. Sakai ends the session after 60 minutes without activity.
- The MiAulario server records each ping. The pings are not the same as the requests of a person.

## Technical details

Refer to [RESEARCH.md](RESEARCH.md). This file shows how the MiAulario session, the cookies and the timeout operate.
