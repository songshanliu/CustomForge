# Local npm consumer

This project imports the core types, Workbench entry, styles, bundled logo, and runtime dependencies only through the local npm tarball

Build and pack the Library from the repository root before installing this example

```powershell
cd D:\projects\3DRendering\core_code
pnpm pack:local
cd examples\npm-consumer
pnpm install --ignore-workspace --lockfile=false --ignore-scripts
pnpm check
pnpm build
pnpm dev
```

The dependency path in `package.json` expects `customforge-0.1.1.tgz` in the repository root. The example intentionally does not keep a lockfile because each local pack produces new tarball integrity data

`--ignore-workspace` is required because this example deliberately consumes the tarball as an independent project instead of joining the parent pnpm workspace

The browser example explicitly ignores the optional native `canvas` build and does not require `pnpm approve-builds`

Fabric.js and Three.js are installed transitively through CustomForge and are deliberately absent from this consumer's direct dependencies

The example verifies Workbench branding, theme tokens, configurable asset catalogs, Design JSON types, history controls, and the built-in product without importing repository source files

For a strict repository-independent check, copy this directory outside the repository and replace the `customforge` dependency with the absolute path to that tarball
