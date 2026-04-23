#!/usr/bin/env bash
# Removes all test data for a target user from the PingWeather database.
# Deletes: alert_history, alert_rules, locations.
# Preserves: profile row (keeps subscription tier, push token, onboarding state).
#
# Usage:
#   ./scripts/reset-test-data.sh            # dry run — shows counts only
#   ./scripts/reset-test-data.sh --execute  # actually deletes

set -euo pipefail

TARGET_EMAIL="jimmy@truthcenteredtech.com"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

DRY_RUN=true
for arg in "$@"; do
  case "$arg" in
    --execute) DRY_RUN=false ;;
    --help|-h)
      echo "Usage: $0 [--execute]"
      echo "  Default: dry run — prints row counts, makes no changes"
      echo "  --execute: delete all alerts, rules, and locations for $TARGET_EMAIL"
      exit 0
      ;;
  esac
done

run_query() {
  cd "$PROJECT_DIR" && npx supabase db query "$1" --linked 2>/dev/null
}

echo "Target:  $TARGET_EMAIL"
echo "Mode:    $([ "$DRY_RUN" = true ] && echo 'DRY RUN  (pass --execute to apply)' || echo 'EXECUTE')"
echo ""

# ── Resolve user UUID ─────────────────────────────────────────────────────────
echo "Resolving UUID..."
UUID_RESULT=$(run_query "SELECT id FROM public.profiles WHERE email = '$TARGET_EMAIL';")
USER_UUID=$(echo "$UUID_RESULT" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)

if [ -z "$USER_UUID" ]; then
  echo "ERROR: No profile found for $TARGET_EMAIL"
  exit 1
fi

echo "UUID:    $USER_UUID"
echo ""

# ── Current counts ────────────────────────────────────────────────────────────
echo "Current row counts:"
echo ""
run_query "
  SELECT
    (SELECT COUNT(*) FROM public.alert_history WHERE user_id = '$USER_UUID') AS alert_history,
    (SELECT COUNT(*) FROM public.alert_rules   WHERE user_id = '$USER_UUID') AS alert_rules,
    (SELECT COUNT(*) FROM public.locations     WHERE user_id = '$USER_UUID') AS locations;
"

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "Dry run — no changes made. Pass --execute to delete."
  exit 0
fi

# ── Deletes ───────────────────────────────────────────────────────────────────
echo ""
echo "Deleting alert_history..."
run_query "DELETE FROM public.alert_history WHERE user_id = '$USER_UUID';"

echo "Deleting alert_rules..."
run_query "DELETE FROM public.alert_rules WHERE user_id = '$USER_UUID';"

echo "Deleting locations..."
run_query "DELETE FROM public.locations WHERE user_id = '$USER_UUID';"

# ── Verify ────────────────────────────────────────────────────────────────────
echo ""
echo "Verifying (should all be 0):"
echo ""
run_query "
  SELECT
    (SELECT COUNT(*) FROM public.alert_history WHERE user_id = '$USER_UUID') AS alert_history,
    (SELECT COUNT(*) FROM public.alert_rules   WHERE user_id = '$USER_UUID') AS alert_rules,
    (SELECT COUNT(*) FROM public.locations     WHERE user_id = '$USER_UUID') AS locations;
"

echo ""
echo "Done. Profile row preserved — subscription tier, push token, and onboarding state unchanged."
