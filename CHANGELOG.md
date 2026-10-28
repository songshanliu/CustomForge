# Changelog

All notable changes to CustomForge will be documented in this file

## [Unreleased]

## [0.3.1] - 2026-10-28

### Fixed

- Recompute Fabric gestures from their starting geometry so edge controls preserve the other scale axis, pointer event density does not change the result, and mouseup does not apply a second containment pass
- Contain active transforms around their fixed anchor and constrain mixed selections together, without repositioning individual members
- Save selection members in world coordinates and retain optional skew angles across Schema 1/2, history and design restoration
- Reject transforms whose finite inputs overflow the resulting geometry before mutating the design or replacing its history

### Added

- Opt-in `objectBoundary: { background: 'overflow' }` in both factories, allowing background bleed while preserving fixed texture/PNG dimensions; the default remains `contain` and ordinary elements remain constrained
- Packaged consumer regressions for continuous real mouse input, event-density independence, fixed anchors, overflow restoration, mixed selections and API idempotency

Boundary configuration belongs to the runtime, not Design JSON. Pass the same option to editing and preview/restoration instances. This release does not change GLB resources, UV mapping, canvas resolution, original materials, or texture edge sampling.

## [0.3.0] - 2026-10-28

### Added

- Automatically fit the 2D editor around the actual printable region with equal-axis scaling, centering, 6% per-side padding, and 16 CSS px container clearance; small regions can enlarge
- Expose `editorView`, `getEditorViewState()`, `fitEditorView()`, and `editorviewchange` through the core and Workbench, including honest invalid-region fallback and bounded extreme zoom
- Cover real mouse/touch transforms, changing DPR, hidden containers, viewport-independent decoded PNG pixels, offscreen objects, text editing, and failed-render recovery in the packaged browser consumer

### Changed

- Separate the editor display viewport from logical texture output; resizing, selection and refitting no longer emit design changes or upload unchanged textures
- Place default text and images inside the actual printable bounds, while explicit API coordinates retain logical canvas semantics
- Cache UV paths per product and display paper padding outside the design texture

The default 2D view changes in this release. To retain whole-canvas sizing, pass `editorView: { fit: 'canvas', paddingRatio: 0, minPadding: 28, allowUpscale: false }`. Saved Schema 1/2 coordinates, mapping, texture resolution, transparency, and model materials are unchanged.

## [0.2.1] - 2026-10-28

### Added

- Opt-in `fit-bounds` and explicit `domain` print mappings with consistent UV0–UV3 selection across the editor and design texture
- Versioned print-node metadata, canvas allocation limits, `initialDesign`, structured diagnostics, and `getPrintSurfaceInfo()` in the core and Workbench
- Schema 2 documents that store the resolved numerical domain, channel, direction, surface, and optional model content revision while retaining Schema 1 defaults for legacy integrations
- Small generated GLB and directional artwork fixtures in the independent package consumer, plus mapping, metadata, serialization, and material regression cases

### Fixed

- Negative print UVs can be explicitly fitted without collapsing all horizontal design samples to a texture edge
- Composite design alpha independently while retaining original UVs, shared geometry, PBR properties, base maps, and texture transforms
- Prepare product changes before committing them, reject incompatible canvas sizes, discard superseded requests, and reset old mapping state on successful switches
- Preserve optional saved model revisions on runtime restore and refresh identity verification after restore and history operations without trusting document metadata as model proof
- Release model-owned ImageBitmaps on replacement and failed preparation, and lose the renderer context when destroying an instance
- Align the package version and consumer tarball paths with the release tag after the `v0.2.0` release gate rejected mismatched metadata

The `v0.2.0` tag did not produce an npm release: its source still declared package version `0.1.2`. Release preparation continues with `0.2.1` without moving the existing tag.

## [0.1.2] - 2026-09-28

### Fixed

- Build high-density printable UV fills without synchronously closing every triangle path
- Remove repeated Canvas 2D and WebGL pixel-readback diagnostics from production rendering

### Changed

- Move nonblank canvas checks into the packaged browser smoke test and cover a generated 47,432-triangle GLB without shipping that fixture in the npm package

## [0.1.1] - 2026-09-21

### Fixed

- Keep the 3D product visible at the maximum zoom-out distance by aligning the camera far clipping plane with the OrbitControls distance limit

## [0.1.0] - 2026-09-21

### Added

- Display the active Mesh UV printable region and boundary as a non-exported editor overlay
- Add an Office-style contextual text formatting bar with font, size, color, highlight, emphasis, alignment, line-height, and letter-spacing controls
- Persist rich text formatting in backward-compatible Design JSON version 1 documents and expose `updateText()`, `editText()`, and `clearSelection()` APIs
- Add stable `ProductCustomizerApi` and `CustomForgeWorkbenchApi` contracts for headless and default-UI integrations
- Expose state snapshots, printable bounds, multi-selection, object transforms, PNG Data URL and Blob output, and 3D view persistence
- Add instance-scoped Workbench classes, runtime theme access, and configurable editor and viewer drawing appearance
- Add validated Workbench extension buttons with stable global, editor, selection, and layer action placements
- Add stable-release metadata checks, independent tarball consumers, and a packaged browser smoke gate
- Add continuous integration and provenance-enabled npm release workflows

### Changed

- Replaced the procedural demo cup with the bundled `cup_decal_small_margins.glb` model, separating `MugBody` from the customizable `PrintArea` overlay
- Keep the design canvas and printable overlay transparent when no base texture is configured
- Replace the shadow-casting viewer setup with balanced non-shadow studio lighting and remove the floor and fixed scene background
- Adjust the initial and reset camera framing for a smaller, more front-facing product view
- Seed the demo with the built-in CustomForge logo and 22px project-name text
- Publish the first non-prerelease version through npm's default `latest` channel without imposing a Node.js engine on browser consumers

### Fixed

- Keep Fabric selection borders and transform controls out of the live 3D texture
- Keep compact layer actions beside the type label so they never cover the layer name
- Present the design canvas as a clean gridded artboard with a restrained UV boundary

## [0.1.0-alpha.2] - 2026-08-27

### Added

- Optional configurable Workbench UI exported from `customforge/workbench`
- Public object querying, selection, removal, naming, visibility, locking, and layer ordering APIs
- Object names, visibility, and locking state in backward-compatible Design JSON version 1 documents
- Undo and redo history with keyboard shortcuts and public history state APIs
- Text composition Dialog with replaceable typography presets
- Image Dialog with upload, configurable background, and decorative element catalogs
- Custom branding, labels, theme tokens, icon visibility, and semantic icon overrides
- Design background images that persist in Design JSON and remain locked at the bottom layer

### Changed

- Built-in demo now consumes the same public Workbench available to package users
- Workbench presentation uses a quieter responsive studio layout with clearer control hierarchy
- Default controls now use softer neutral surfaces, light selection states, and restrained 7px radii
- Workbench now bundles the rounded Nunito Sans UI font with system font fallbacks
- Solid accent buttons now consistently use the configured high-contrast text color
- Layer selection and Dialog transitions now use subtle motion with reduced-motion support
- Nunito Sans is emitted as a cacheable font asset instead of being inlined into the stylesheet
- Package verification now parses actual ESM imports without matching examples inside bundled strings
- The bundled CustomForge logo is now the default Workbench brand mark
- Successful product changes reset design history while preserving current design objects

## [0.1.0-alpha.1] - 2026-08-27

### Changed

- Fabric.js and Three.js are installed automatically as runtime dependencies
- Consumers no longer need to install Fabric.js and Three.js separately
- Library builds continue to keep both engines external

## [0.1.0-alpha.0] - 2026-08-27

### Added

- ESM Library build configuration with source maps
- TypeScript declaration and declaration map generation
- Namespaced core stylesheet exported as `customforge/style.css`
- Local package verification and npm consumer example
- Versioned, Fabric-independent Design JSON types and runtime validation
- Public `saveDesign()` and transactional `loadDesign()` methods
- Design JSON save and load controls in the built-in and npm consumer demos

### Changed

- Fabric.js and Three.js are peer dependencies for Library consumers
- Demo-only Lucide icons are development dependencies
- `ProductCustomizer` no longer exposes its Fabric.js editor or Three.js viewer instances
- Package version `0.1.0-alpha.0` is published publicly under the `alpha` dist-tag
- Text and image objects remain fully inside the editor canvas while being added or transformed
- The built-in demo product no longer includes the obstructive torus handle
- Blob URL images are converted to persistent Data URLs when added
