#!/usr/bin/env bash
# Send a package to the Chrome Web Store (API v2), or only examine the keys.
#   scripts/cws.sh check          get an access token and show the state of the item; no upload
#   scripts/cws.sh publish FILE   upload the ZIP file, then send it to the review
# Environment: CWS_CLIENT_ID, CWS_CLIENT_SECRET, CWS_REFRESH_TOKEN, CWS_PUBLISHER_ID and
# CWS_EXTENSION_ID (the secrets of the repository). The script needs curl and jq.
set -euo pipefail

API=https://chromewebstore.googleapis.com
mode=${1:-}
case $mode in
  check) ;;
  publish) [ -f "${2:-}" ] || { echo "::error::No package file: ${2:-}"; exit 1; } ;;
  *) echo "Usage: $0 check | publish FILE" >&2; exit 2 ;;
esac

missing=''
for name in CWS_CLIENT_ID CWS_CLIENT_SECRET CWS_REFRESH_TOKEN CWS_PUBLISHER_ID CWS_EXTENSION_ID; do
  [ -n "${!name:-}" ] || missing+=" $name"
done
if [ -n "$missing" ]; then
  if [ "$mode" = check ]; then
    echo "::error::These secrets are not set:$missing."
    exit 1
  fi
  echo "::notice::No secrets of the Chrome Web Store: this version is not sent to the Chrome Web Store."
  exit 0
fi

# Send a request (the URL is the last argument) and write the body. If the HTTP status is an
# error, show the status and the body, and stop.
request() {
  local out code
  out=$(curl -sS -w '\n%{http_code}' "$@")
  code=${out##*$'\n'}
  out=${out%$'\n'*}
  if [ "$code" -ge 400 ]; then
    echo "::error::HTTP $code from ${*: -1}: $out" >&2
    return 1
  fi
  printf '%s\n' "$out"
}

answer=$(request --data-urlencode "client_id=$CWS_CLIENT_ID" --data-urlencode "client_secret=$CWS_CLIENT_SECRET" \
  --data-urlencode "refresh_token=$CWS_REFRESH_TOKEN" --data-urlencode grant_type=refresh_token \
  https://oauth2.googleapis.com/token)
token=$(jq -r '.access_token // empty' <<<"$answer")
if [ -z "$token" ]; then
  echo "::error::No access token from Google: examine CWS_CLIENT_ID, CWS_CLIENT_SECRET and CWS_REFRESH_TOKEN."
  exit 1
fi
echo "::add-mask::$token"
auth=(-H "Authorization: Bearer $token")
item="publishers/$CWS_PUBLISHER_ID/items/$CWS_EXTENSION_ID"

# The state of the item: the version in the review and the published version.
summary() {
  jq -r 'def rev($r): ([$r.distributionChannels[]?.crxVersion] | join(", ")) as $v
      | "\($r.state // "nothing")\(if $v == "" then "" else " (\($v))" end)";
    [ "in review: \(rev(.submittedItemRevisionStatus // {}))", "published: \(rev(.publishedItemRevisionStatus // {}))",
      (if .takenDown then "TAKEN DOWN" else empty end), (if .warned then "WARNED" else empty end)
    ] | join("; ")'
}

if [ "$mode" = check ]; then
  status=$(request "${auth[@]}" "$API/v2/$item:fetchStatus")
  echo "::notice::The keys of the Chrome Web Store work. $(summary <<<"$status")."
  exit 0
fi

upload=$(request -X POST "${auth[@]}" -T "$2" "$API/upload/v2/$item:upload")
echo "$upload"
state=$(jq -r '.uploadState // empty' <<<"$upload")
for _ in $(seq 1 30); do
  [ "$state" = IN_PROGRESS ] || break
  sleep 10
  status=$(request "${auth[@]}" "$API/v2/$item:fetchStatus")
  state=$(jq -r '.lastAsyncUploadState // empty' <<<"$status")
done
if [ "$state" != SUCCEEDED ]; then
  echo "::error::The upload to the Chrome Web Store did not succeed (state: ${state:-unknown})."
  exit 1
fi

publish=$(request -X POST "${auth[@]}" -H 'Content-Type: application/json' -d '{"publishType":"DEFAULT_PUBLISH"}' \
  "$API/v2/$item:publish")
echo "$publish"
echo "::notice::$(basename "$2") is in the review of the Chrome Web Store (state: $(jq -r '.state // "unknown"' <<<"$publish"))."
