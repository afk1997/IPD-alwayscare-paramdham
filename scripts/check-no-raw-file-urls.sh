#!/usr/bin/env bash
# Fails if any client code still constructs /api/files/${...} as a
# string.  All such URLs must now be minted server-side via
# signMediaUrl() and shipped down as a string field on the prop.
set -euo pipefail

if grep -rn --include='*.ts' --include='*.tsx' '`/api/files/${' src/ \
    --exclude='media-sign.ts' ; then
  echo
  echo "Found raw /api/files/\${...} string-construction in src/."
  echo "Replace with a server-side signMediaUrl() URL passed through props."
  exit 1
fi
echo "OK: no raw /api/files URL string-builds in client code."
