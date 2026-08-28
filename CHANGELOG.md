# Changelog

All notable changes to CustomForge will be documented in this file

## [Unreleased]

### Added

- Non-exported product design guide layer with automatically extracted UV island boundaries
- Optional SVG or PNG design templates plus normalized safe-area and bleed-area guides
- Public design guide visibility APIs, event, and a Workbench toolbar toggle
- Remote product Dialog fields for template URLs and UV boundary visibility
- Automatic design-area generation for static GLB/GLTF models without requiring an existing UV map or named `PrintArea` mesh
- Transferable geometry snapshots, Worker-based topology analysis, deterministic candidate segmentation, and progress/cancellation events
- xatlas Worker/WASM parameterization with transparent runtime overlay meshes that preserve source model materials
- URL, `Blob`, `File`, and `ArrayBuffer` model inputs, including a local GLB field in the Workbench
- Independent textures, Design JSON, viewports, and undo/redo history for multiple design areas
- Design JSON version 2 with model and area identity validation plus version 1 single-area migration
- Public design-area, surface-selection, and editor viewport APIs and events
- Workbench area switching, processing status, wheel zoom, middle-button or Space+drag panning, fit, and 100% controls
- Bundled xatlas and Comlink license notices plus npm artifact checks for Worker/WASM assets

### Changed

- Models supplied without `surfaceMesh` now use automatic design areas by default; `existing-uv` remains an explicit compatibility path
- Automatic UV charts preserve their pixel aspect ratio when fitted into a non-square editor canvas
- Model fingerprints now combine two deterministic hashes and include material groups
- Area fingerprints now include source triangles and generated UV/index data instead of duplicating the area ID
- Product Design JSON loading and design-area switching now restore prior state transactionally after failures
- Existing-UV product loading now validates that the customizable Mesh contains usable triangle UV data

### Fixed

- Normalized xatlas UVs are no longer divided by the atlas dimensions a second time, preventing automatic UV guides and mapped designs from collapsing to a near-zero point
- xatlas WASM is fetched and validated in the page context, forwarded to its Blob Worker with the correct media type, and bounded by an initialization timeout instead of remaining at `Unwrapping surface 0%`
- xatlas initialization failures now stop automatic-area processing with an explicit error instead of being swallowed as individual candidate failures
- xatlas tasks are serialized and rebuild their wrapper after a failed unwrap instead of leaving later candidates waiting indefinitely
- Surface-analysis cancellation rejects the active Promise and cleans up synchronous `postMessage` failures
- Product replacement clears active surface-pick UI state, and disabled surface picking is reflected by the Workbench control
- Product Design JSON loading now rejects a mismatched automatic processor version
- Workbench clears Space-drag state on window blur and distinguishes 100% zoom from fit-and-center

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
