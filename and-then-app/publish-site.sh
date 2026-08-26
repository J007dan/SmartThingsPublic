#!/bin/sh
# Publish and-then-app/site/ to the gh-pages branch, at the branch root.
#
# Built with git plumbing rather than a checkout, so it never disturbs the
# working tree and is safe to run from an automated session mid-task.
set -e
cd "$(dirname "$0")"
./build.sh

cd site
TREE=$(
  for f in $(ls -A); do
    [ -f "$f" ] || continue
    printf '100644 blob %s\t%s\n' "$(git hash-object -w "$f")" "$f"
  done | git mktree
)
cd ..

MSG="${1:-Publish site}"
PARENT=$(git rev-parse --verify -q refs/remotes/origin/gh-pages || true)
if [ -n "$PARENT" ]; then
  # nothing to do if the content is byte-identical to what is already live
  if [ "$(git rev-parse -q "$PARENT^{tree}")" = "$TREE" ]; then
    echo "gh-pages already up to date"
    exit 0
  fi
  COMMIT=$(git commit-tree "$TREE" -p "$PARENT" -m "$MSG")
else
  COMMIT=$(git commit-tree "$TREE" -m "$MSG")
fi

git push origin "$COMMIT:refs/heads/gh-pages"
echo "published $COMMIT to gh-pages"
