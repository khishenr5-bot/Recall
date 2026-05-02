#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# setup-branch-protection.sh
#
# Applies GitHub branch protection rules to the "main" branch so that:
#   - The "Lockfile & Typecheck" CI check must pass before merging
#   - Direct pushes to main are blocked (all changes must go through a PR)
#
# Optional: set REQUIRE_REVIEWS=true to also require at least one approving
# review with stale-review dismissal and code-owner review enforcement.
#
# Note: dismissal_restrictions is an org-only feature and is omitted here to
# support personal repositories. Remove this comment if you move to an org repo.
#
# Prerequisites:
#   - curl and git must be installed (standard on macOS/Linux)
#   - GITHUB_TOKEN env var set to a personal access token with repo admin scope
#   - Your account must have admin access to the repository
#
# Note: Remote URL inference supports github.com https and ssh remotes only.
#       For GitHub Enterprise or non-standard remotes, pass owner/repo explicitly.
#
# Usage:
#   GITHUB_TOKEN=ghp_... ./scripts/setup-branch-protection.sh [owner/repo]
#   REQUIRE_REVIEWS=true GITHUB_TOKEN=ghp_... ./scripts/setup-branch-protection.sh [owner/repo]
#
# If owner/repo is omitted, it is inferred from the current git remote.
# ─────────────────────────────────────────────────────────────────────────────

# Require a GitHub token
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "ERROR: GITHUB_TOKEN environment variable is not set." >&2
  echo "       Export a personal access token with repo admin scope:" >&2
  echo "       export GITHUB_TOKEN=ghp_..." >&2
  exit 1
fi

# Default: do not require PR reviews (optional hardening; set to "true" to enable)
REQUIRE_REVIEWS="${REQUIRE_REVIEWS:-false}"

# Resolve repository (owner/repo)
if [[ $# -ge 1 ]]; then
  REPO="$1"
else
  # Infer from the git remote URL (supports both https and ssh remotes)
  REMOTE_URL=$(git remote get-url origin 2>/dev/null || true)
  if [[ -z "${REMOTE_URL:-}" ]]; then
    echo "ERROR: Could not read git remote 'origin'. Pass owner/repo as an argument." >&2
    exit 1
  fi
  # Strip protocol and .git suffix, then extract owner/repo
  # Handles: https://github.com/owner/repo.git  and  git@github.com:owner/repo.git
  REPO=$(echo "${REMOTE_URL}" \
    | sed -E 's|.*github\.com[:/]||' \
    | sed -E 's|\.git$||')
fi

if [[ -z "${REPO:-}" ]]; then
  echo "ERROR: Could not determine the repository. Pass it as an argument: owner/repo" >&2
  exit 1
fi

# Validate that REPO looks like owner/repo (no extra slashes or whitespace)
if ! echo "${REPO}" | grep -qE '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'; then
  echo "ERROR: Repository '${REPO}' does not match the expected 'owner/repo' format." >&2
  echo "       Pass it explicitly as an argument, e.g.: owner/my-repo" >&2
  exit 1
fi

echo "Applying branch protection to main on ${REPO} ..."

# Minimum required review count (used only when REQUIRE_REVIEWS=true)
MIN_REVIEWS=1

# Determine required_pull_request_reviews payload.
# Note: dismissal_restrictions is omitted because it is an org-only field.
# Personal repos will return a 422 error if it is included.
if [[ "${REQUIRE_REVIEWS}" == "true" ]]; then
  PR_REVIEWS_PAYLOAD=$(cat <<JSON
{
  "dismiss_stale_reviews": true,
  "require_code_owner_reviews": true,
  "required_approving_review_count": ${MIN_REVIEWS}
}
JSON
)
else
  PR_REVIEWS_PAYLOAD="null"
fi

# Build the full request body
REQUEST_BODY=$(cat <<JSON
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Lockfile & Typecheck"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": ${PR_REVIEWS_PAYLOAD},
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true
}
JSON
)

# Apply branch protection via the GitHub REST API
HTTP_CODE=$(curl -s -o /tmp/gh-branch-protection-response.json -w "%{http_code}" \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  "https://api.github.com/repos/${REPO}/branches/main/protection" \
  -d "${REQUEST_BODY}")

if [[ "${HTTP_CODE}" -lt 200 || "${HTTP_CODE}" -ge 300 ]]; then
  echo "ERROR: GitHub API returned HTTP ${HTTP_CODE}" >&2
  echo "Response:" >&2
  cat /tmp/gh-branch-protection-response.json >&2
  echo "" >&2
  exit 1
fi

echo ""
echo "Done. Branch protection rules applied to ${REPO}:main"
echo ""
echo "Summary of enforced rules:"
echo "  - CI check 'Lockfile & Typecheck' must pass before merging"
echo "  - Branch must be up-to-date before merging (strict mode)"
echo "  - Direct pushes to main are blocked"
echo "  - Admins are subject to the same rules"
echo "  - Required conversation resolution before merging"
if [[ "${REQUIRE_REVIEWS}" == "true" ]]; then
  echo "  - At least ${MIN_REVIEWS} approving review required"
  echo "  - Stale reviews dismissed on new commits"
  echo "  - Code owner review required"
else
  echo "  (Optional: run with REQUIRE_REVIEWS=true to also enforce PR reviews)"
fi
