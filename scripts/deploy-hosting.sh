#!/usr/bin/env bash
# From 15 Oct 2026, new Firebase projects do not get a Hosting site until one is created.
# Create the default site if it is missing, then deploy. Safe to re-run on existing projects.
set -euo pipefail

PROJECT="${1:-wellnessshift-rn-ios}"
SITE_ID="${2:-$PROJECT}"

list_output="$(firebase --project "$PROJECT" hosting:sites:list 2>&1 || true)"

if printf '%s\n' "$list_output" | grep -Eq "(^|[[:space:]])${SITE_ID}([[:space:]]|$)"; then
  echo "Hosting site ${SITE_ID} already exists on ${PROJECT}."
else
  echo "Creating Hosting site ${SITE_ID} on ${PROJECT}..."
  firebase --project "$PROJECT" hosting:sites:create "$SITE_ID"
fi

firebase deploy --only hosting --project "$PROJECT"
