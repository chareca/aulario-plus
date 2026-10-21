#!/usr/bin/env bash
# Examine the commits of a push or a pull request on GitHub Actions.
# GitHub.com does not run pre-receive hooks. This script does the same checks.
# It uses .githooks/commit-msg for each commit.
#
# The workflow gives these environment variables:
#   BLOCKED_WORDS  extended regular expression (a repository secret)
#   EVENT, BEFORE, AFTER, REF_NAME, BASE_SHA, HEAD_SHA, PR_TITLE, PR_BODY

zero_commit='0000000000000000000000000000000000000000'
error=0

reject() {
  echo "::error::$1"
  error=1
}

has_blocked_word() {
  [[ -n $BLOCKED_WORDS ]] && grep -qiE -- "$BLOCKED_WORDS"
}

if printf '%s\n' "$REF_NAME" | has_blocked_word; then
  reject "The branch name contains a blocked word."
fi

if [[ $EVENT == pull_request ]]; then
  if printf '%s\n%s\n' "$PR_TITLE" "$PR_BODY" | has_blocked_word; then
    reject "The title or the description of the pull request contains a blocked word."
  fi
  range="$BASE_SHA..$HEAD_SHA"
elif [[ -n $BEFORE && $BEFORE != "$zero_commit" ]] && git cat-file -e "$BEFORE^{commit}" 2>/dev/null; then
  range="$BEFORE..$AFTER"
else
  # New branch or force push: examine all the commits of the branch.
  range="$AFTER"
fi

# Stop if the commits cannot be listed: a check without commits must not pass.
if ! commits=$(git rev-list "$range"); then
  echo "::error::The commits of $range cannot be listed."
  exit 1
fi

message_file=$(mktemp)
for commit in $commits; do
  git show -s --format=%B "$commit" > "$message_file"
  IFS=$'\t' read -r an ae cn ce < <(git show -s --format='%an%x09%ae%x09%cn%x09%ce' "$commit")
  if ! GIT_AUTHOR_NAME="$an" GIT_AUTHOR_EMAIL="$ae" GIT_COMMITTER_NAME="$cn" GIT_COMMITTER_EMAIL="$ce" \
      .githooks/commit-msg "$message_file"; then
    reject "Commit $commit is not correct. Refer to the error above."
  fi
done
rm -f "$message_file"

exit "$error"
