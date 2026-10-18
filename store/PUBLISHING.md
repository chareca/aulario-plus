# Publish Aulario Plus in the stores

Aulario Plus is in two stores:

- **Chrome Web Store (CWS):** Chrome, Brave, Opera, Vivaldi, Arc and Edge can install from it.
- **Firefox Add-ons (AMO):** Firefox.

You send the first version to each store manually, one time. After that, the workflow `.github/workflows/publish.yml` sends each new release of GitHub to the two stores. Each store does a review before the users get the version.

The texts of the listings are in `store/chrome-web-store.md` and `store/firefox-amo.md`. The images are in `store/images/`. The privacy policy is `PRIVACY.md`.

## 1. The developer accounts (one time)

- **Chrome Web Store:** open <https://chrome.google.com/webstore/devconsole> with the Google account that will own the extension. Pay the registration fee (5 USD, one time). Set 2-step verification on this Google account: the store requires it to publish. Verify the contact email. Select the trader status that applies to you.
- **Firefox Add-ons:** open <https://addons.mozilla.org/developers/> with a Mozilla account. There is no fee.

## 2. The first version (one time)

Make the ZIP files:

```bash
./build.sh
```

### Chrome Web Store

1. In the Developer Dashboard, click **New item** and upload `dist/aulario-plus-chromium-vX.Y.Z.zip`.
2. Fill in the tabs **Store listing**, **Privacy** and **Distribution** with the texts of `store/chrome-web-store.md`. Upload the images of `store/images/`.
3. Click **Submit for review**.
4. Write down two values for the workflow:
   - the **extension ID** (32 letters, in the dashboard and in the address of the item);
   - the **publisher ID** (Developer Dashboard → **Account**).

### Firefox Add-ons

1. Open <https://addons.mozilla.org/developers/addon/submit/>. Select **On this site** (listed).
2. Upload `dist/aulario-plus-firefox-vX.Y.Z.zip`. AMO examines the file.
3. Source code: select **No**. The code is not minified or transpiled.
4. Fill in the listing with the texts of `store/firefox-amo.md`: summary, description, categories, license, privacy policy and the notes for the reviewer.
5. Submit the version.

AMO knows the add-on by its id `@aulario-plus.chareca` (in `extension/manifest.firefox.json`). Do not change this id.

## 3. The API keys (one time)

Only you make and keep these keys. Do not put them in the repository or in a message.

### Chrome Web Store

1. Open <https://console.cloud.google.com/> and make a new project, for example `aulario-plus-publish`.
2. **APIs & Services → Library:** enable the **Chrome Web Store API**.
3. **Google Auth Platform** (OAuth consent screen): user type **External**, an app name, your email. Then set the publishing status to **In production**. In **Testing**, the refresh token stops after 7 days.
4. **Clients → Create client:** type **Web application**. Add this authorized redirect URI: `https://developers.google.com/oauthplayground`. Write down the **client ID** and the **client secret**.
5. Open <https://developers.google.com/oauthplayground>:
   1. Click the gear icon. Select **Use your own OAuth credentials** and paste the client ID and the client secret.
   2. In **Input your own scopes**, write `https://www.googleapis.com/auth/chromewebstore` and click **Authorize APIs**.
   3. Log in with the Google account that owns the extension. Google shows "Google hasn't verified this app": this is your app, so click **Advanced** and continue.
   4. Click **Exchange authorization code for tokens**. Write down the **refresh token**.

### Firefox Add-ons

Open <https://addons.mozilla.org/developers/addon/api/key/> and click **Generate new credentials**. Write down the **JWT issuer** (the key) and the **JWT secret**.

## 4. The secrets of the repository (one time)

On GitHub: repository → **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Value |
|---|---|
| `CWS_CLIENT_ID` | The client ID of Google Cloud |
| `CWS_CLIENT_SECRET` | The client secret of Google Cloud |
| `CWS_REFRESH_TOKEN` | The refresh token of the OAuth Playground |
| `CWS_PUBLISHER_ID` | The publisher ID of the Chrome Web Store |
| `CWS_EXTENSION_ID` | The extension ID of the Chrome Web Store |
| `AMO_API_KEY` | The JWT issuer of AMO |
| `AMO_API_SECRET` | The JWT secret of AMO |

You can also use the GitHub CLI. It asks for the value, so the value does not go into the history of the shell:

```bash
gh secret set CWS_CLIENT_ID --repo chareca/aulario-plus
```

If the secrets of a store are not there, the workflow does not send the version to that store. It shows a notice and continues.

## 5. Each new version

1. Change `version` in `extension/manifest.chromium.json` and `extension/manifest.firefox.json`. The two values must be equal, and larger than the version in the stores.
2. Run the tests and `./build.sh`. Commit and push.
3. Publish a release of GitHub with the tag `vX.Y.Z` and the two ZIP files.
4. The workflow **Publish to the stores** starts. It runs the tests and `./build.sh`, and it makes sure that the tag is the version of the manifests. Then it sends the ZIP file to the Chrome Web Store and the folder `dist/firefox` to AMO.
5. Each store does its review. This can take from some hours to some days. The store sends an email with the result.

To send a version again (for example, after an error): **Actions → Publish to the stores → Run workflow**, and write the tag.

### Notes

- The workflow sends only the package. Change the texts and the images of the listings in the dashboards of the stores.
- If the Chrome Web Store has a version in review, it can refuse a new upload. Wait for the result of the review, or cancel the review in the dashboard. Then run the workflow again.
- A new permission makes the review longer, and the browsers ask the users to accept it. Before you add a permission, change `PRIVACY.md` and the justifications in `store/chrome-web-store.md`.
- To make the images again: `node store/make-images.mjs` (Node.js 22 and a Chromium browser, see `tests/browser/cdp.mjs`).
