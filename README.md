# sklp demo

The page of the public sklp demo node: paste a public repo, the node follows
it, and everyone sees the spaces it runs, their logs and the image tags the
node rolled on its own.

- `apps/core`: Go. Holds the demo node's context and reads its control API
  (spaces, state, manifests, follows, image watches, logs) with the node's
  certificate pinned. Every rule — a space's health verdict, which repo owns a
  space — is computed here.
- `apps/web`: TanStack Start. Renders the screens and relays `/api/core/*` to
  the core.

## Run it

```bash
cp .env.example .env    # fill the demo context: server, token, fingerprint
sklp dev stack          # core :4100, web :5273
```

## Deploy

`.sklp/prod/deploy.yaml` runs on the demo node itself, as the `sklp-demo`
space:

```bash
sklp run publish                         # rg.fr-par.scw.cloud/sklp-demo/{core,web}, a public namespace
sklp deploy apply prod -context demo
```
