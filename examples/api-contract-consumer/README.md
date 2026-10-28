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

The dependency path expects `customforge-0.3.1.tgz` in the `core_code` directory. `--ignore-workspace` keeps this consumer independent from the repository workspace, `--lockfile=false` avoids retaining integrity data for a regenerated tarball, and `--ignore-scripts` prevents transitive install scripts from running during this contract check.

`pnpm test:browser` starts this consumer temporarily in 1440×900 and 390×844 viewports and verifies the packaged model, design operations, history, persistence, PNG output, view state, maximum zoom-out rendering, runtime extensions, and instance teardown in headless Chrome. The desktop pass also creates an in-memory GLB with 47,432 UV triangles, verifies the printable overlay and product switching, and reports the packaged Workbench initialization time and maximum Long Task without adding the fixture to the npm tarball.

## Print mapping contract

Repack the current source as `customforge-0.3.1.tgz` before checking these additions. The published `0.1.2` package does not expose these APIs; installing an older tarball does not validate the current mapping contract.

The browser runner allows 10 minutes per viewport, or 30 minutes when a local real model is supplied. `CUSTOMFORGE_SMOKE_TIMEOUT_MS` accepts a positive integer in milliseconds to adjust this budget on slower software-rendering machines; it does not skip assertions.

`src/printMappingSmoke.ts` imports only the public package entries. Its generated GLBs and asymmetric PNG exercise negative UVs, both vertical directions, UV0–UV3, separate UV islands, metadata sizing before canvas creation, the resolution label, a single initial GLB fetch, numerical Schema 2 restore, history, PNG selection exclusion, failed and superseded loads, mapping reset, and core/Workbench parity. Both viewport passes run these cases.

The material cases check transparent artwork over the original base, including a PBR checker texture using a separate UV channel and `KHR_texture_transform`. Lifecycle cases verify failed image restore preserves design, selection, and history; pending image restore cannot commit after a product switch or destruction; decoded model bitmaps close exactly once; and destruction releases the WebGL context.

The restore cases retain optional document revisions, distinguish them from host-declared model identity, reject known conflicts, and check verification state after undo and redo. See the bilingual root README for metadata, priority, size limits, diagnostics, and the requirement to upgrade Schema 2 readers before enabling writers.

### Optional real-model regression

The default gate needs no external model. To also run the dedicated snowman regression, provide the unmodified `20oz-snowman-source.glb` fixture (SHA-256 `26f775f32b2c7f3942d1c11a1087b775847edab0532c5e5bee482fc4e0357fde`):

```powershell
cd D:\projects\3DRendering\core_code
$env:CUSTOMFORGE_SMOKE_MODEL = 'D:/models/20oz-snowman-source.glb'
$env:CUSTOMFORGE_SMOKE_ARTIFACT_DIR = 'D:/test-output/customforge'
pnpm test:browser
Remove-Item Env:CUSTOMFORGE_SMOKE_MODEL, Env:CUSTOMFORGE_SMOKE_ARTIFACT_DIR
```

This is a regression for that specific fixture, not an arbitrary-model validator. It compares original mapping with both fitted directions across four views, checks the original PBR base through transparent artwork, verifies Schema 2 save/recreation, and switches back to the bundled model. The optional artifact directory receives front/back PNGs, the artwork, and JSON samples. The test server serves only the explicitly supplied file; the asset is not copied into the consumer or npm tarball.

The real-model test explicitly uses 1024×512 for sampling. This does not establish the asset's intended print dimensions. Confirm production canvas dimensions with the asset author.

For a same-machine performance comparison, optionally set `CUSTOMFORGE_SMOKE_BASELINE` to the extracted published `0.1.2` package's `dist` directory, containing `workbench.js`, before the command. This uses the consumer's installed runtime dependencies, disables HTTP caching, excludes warmup runs, and records three initialization/readback samples per implementation. The old package reproduces its original clamping behavior; it does not gain the new mapping API. Readback timing includes frame waits and GPU readback, so it is not a production first-paint metric. Both viewports use software SwiftShader; the mobile viewport does not simulate a physical phone.

## Background boundary regression

The packaged browser consumer exercises `objectBoundary` in both factories, real continuous edge/corner controls, event-density and repeated-endpoint stability, fixed anchors, rotations and skew, mixed selections, absolute API assignments, history, Schema 1/2 restoration, and fixed-size transparent output. The default suite uses generated 1380×800, 1550×1190 and default-size fixtures.

To include an unchanged local production GLB, optionally set `CUSTOMFORGE_BOUNDARY_MODEL` to its absolute path before `pnpm test:browser`. Only the test server exposes that selected file on its loopback interface. Set `CUSTOMFORGE_BOUNDARY_ONLY=1` to run the boundary matrix against that model alone; the remaining smoke contracts still run. `CUSTOMFORGE_SMOKE_EVIDENCE` writes the numerical cases and screenshots. These options do not change SDK runtime behavior or select a product in the normal demo.
