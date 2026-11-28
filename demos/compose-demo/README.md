# compose-demo

A plain `compose.yaml` (Uptime Kuma) turned into a sklp deploy with one
command, then served by the public sklp demo node:

```bash
sklp init -from compose -to deploy -stack web
```

`.sklp/web/deploy.yaml` is what it wrote, with its `TODO(import)` resolved;
`.sklp/deploy-root.yaml` tells the node which space to run it in.
