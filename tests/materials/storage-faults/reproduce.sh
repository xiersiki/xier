#!/bin/bash
set -euo pipefail
script_directory="$(cd "$(dirname "$0")" && pwd)"
review_directory="$(mktemp -d /tmp/xier-material-storage-review-repro-XXXXXX)"
repository_path="${1:-$(cd "$script_directory/../../.." && pwd)}"
cp "$script_directory/storage-faults.mjs" "$script_directory/worker.mjs" "$review_directory/"
mkdir "$review_directory/volume"
hdiutil create -size 32m -fs HFS+ -volname XierFaultReview -type SPARSE -o "$review_directory/storage.sparseimage"
hdiutil attach "$review_directory/storage.sparseimage" -nobrowse -mountpoint "$review_directory/volume"
trap 'hdiutil detach "$review_directory/volume" >/dev/null 2>&1 || true' EXIT
printf 'Independent review evidence: %s\n' "$review_directory"
node "$review_directory/storage-faults.mjs" "$repository_path"
