#!/usr/bin/env bash
# Netlify ignore command: exit 0 to SKIP the build, 1 to build.
#
# Build when there is no previous build to compare with (first deploy, or
# "clear cache and deploy"), when the comparison fails for any reason, or when
# anything that shapes the published site changed. Skip only when a diff
# proves nothing relevant changed.

set -u
if [ -z "${CACHED_COMMIT_REF:-}" ] || [ "${CACHED_COMMIT_REF}" = "${COMMIT_REF:-}" ]; then
  exit 1
fi

git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- \
  content assets lib netlify build.mjs config.json netlify.toml package.json package-lock.json scripts \
  ':(exclude)content/editorials/README.md'
status=$?
if [ "$status" -eq 0 ]; then
  echo "No site changes between $CACHED_COMMIT_REF and $COMMIT_REF; skipping build."
  exit 0
fi
exit 1
