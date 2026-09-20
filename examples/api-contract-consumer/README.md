# Local API contract consumer

This standalone project installs CustomForge only from the generated local npm tarball. It verifies both package entry points, public interface declarations, scoped styles, runtime assets, and the production browser bundle.

```powershell
cd D:\projects\3DRendering\core_code
pnpm pack:local
cd examples\api-contract-consumer
pnpm install --ignore-workspace --ignore-scripts
pnpm dev
```

The development server uses `http://localhost:5175/`. The fixed port fails fast when `5175` is already occupied instead of silently switching to another port.

Run the package contract checks separately when needed:

```powershell
pnpm check
pnpm build
```

The dependency path expects `customforge-0.1.0-alpha.2.tgz` in the `core_code` directory. `--ignore-workspace` keeps this consumer independent from the repository workspace, while `--ignore-scripts` prevents transitive install scripts from running during this contract check.
