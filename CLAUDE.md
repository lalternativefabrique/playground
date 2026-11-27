# sklp-demo

The page of the public sklp demo node. Go core (`apps/core`, Echo) reads the
node's control API; TanStack Start web (`apps/web`) renders and relays
`/api/core/*` to it. No database, no accounts.

## Conventions
- All code, comments, commit messages in English.
- Minimal comments: only what the code cannot say.
- Business rules (health verdicts, ownership) live in the core, never in web.
- `sklp flow start <name>` / `sklp flow end`; never push `main` unasked.
- No GitHub Actions: pipelines run through sklp.
