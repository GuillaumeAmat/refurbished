#!/usr/bin/env bash
# PreToolUse hook: blocks npm, npx, pnpm — use yarn instead

input=$(cat)
command=$(echo "$input" | jq -r '.tool_input.command // ""')

if echo "$command" | grep -qE '(^|[[:space:];&|`$(])(npm|npx|pnpm)[[:space:];|&`$]|^(npm|npx|pnpm)$'; then
  echo "Blocked: use yarn instead of npm/npx/pnpm. Alternatives: yarn add, yarn dlx, yarn." >&2
  exit 2
fi

exit 0
