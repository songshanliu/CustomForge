# Local npm consumer

This project imports CustomForge only through the local npm tarball

Build and pack the Library from the repository root before installing this example

```powershell
cd D:\project\CustomForge\CustomForge
pnpm pack:local
cd examples\npm-consumer
pnpm install --ignore-workspace
pnpm check
pnpm build
pnpm dev
```

The dependency path in `package.json` expects `customforge-0.1.0-alpha.0.tgz` in the repository root

`--ignore-workspace` is required because this example deliberately consumes the tarball as an independent project instead of joining the parent pnpm workspace

The browser example explicitly ignores the optional native `canvas` build and does not require `pnpm approve-builds`

For a strict repository-independent check, copy this directory outside the repository and replace the `customforge` dependency with the absolute path to that tarball
