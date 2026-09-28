# Local API contract consumer

This standalone project installs CustomForge only from the generated local npm tarball. It verifies both package entry points, public interface declarations, scoped styles, runtime assets, and the production browser bundle.

The page also acts as a host customization example. It supplies a different logo, brand copy, labels, theme, and canvas appearance through public options, then uses the instance `className` to scope a desktop layout with a left tool rail and a right-side layer panel. It registers extension commands in all four stable button placements and exercises synchronous state predicates, asynchronous loading, selection context, and layer context. The package source and Workbench DOM are not modified for this example.

```powershell
cd D:\projects\3DRendering\core_code
pnpm pack:local
cd examples\api-contract-consumer
pnpm install --ignore-workspace --lockfile=false --ignore-scripts
pnpm dev
```

The development server uses `http://localhost:5175/`. The fixed port fails fast when `5175` is already occupied instead of silently switching to another port.

Run the package contract checks separately when needed:

```powershell
pnpm check
pnpm build
```

The dependency path expects `customforge-0.1.2.tgz` in the `core_code` directory. `--ignore-workspace` keeps this consumer independent from the repository workspace, `--lockfile=false` avoids retaining integrity data for a regenerated tarball, and `--ignore-scripts` prevents transitive install scripts from running during this contract check.

`pnpm test:browser` starts this consumer temporarily in 1440×900 and 390×844 viewports and verifies the packaged model, design operations, history, persistence, PNG output, view state, maximum zoom-out rendering, runtime extensions, and instance teardown in headless Chrome. The desktop pass also creates an in-memory GLB with 47,432 UV triangles, verifies the printable overlay and product switching, and reports the packaged Workbench initialization time and maximum Long Task without adding the fixture to the npm tarball.
