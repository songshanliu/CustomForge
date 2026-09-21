# Changelog

All notable changes to CustomForge will be documented in this file

## [Unreleased]

### Added

- Display the active Mesh UV printable region and boundary as a non-exported editor overlay
- Add an Office-style contextual text formatting bar with font, size, color, highlight, emphasis, alignment, line-height, and letter-spacing controls
- Persist rich text formatting in backward-compatible Design JSON version 1 documents and expose `updateText()`, `editText()`, and `clearSelection()` APIs
- Add stable `ProductCustomizerApi` and `CustomForgeWorkbenchApi` contracts for headless and default-UI integrations
- Expose state snapshots, printable bounds, multi-selection, object transforms, PNG Data URL and Blob output, and 3D view persistence
- Add instance-scoped Workbench classes, runtime theme access, and configurable editor and viewer drawing appearance
- Add validated Workbench extension buttons with stable global, editor, selection, and layer action placements

### Changed

- Replaced the procedural demo cup with the bundled `cup_decal_small_margins.glb` model, separating `MugBody` from the customizable `PrintArea` overlay
- Keep the design canvas and printable overlay transparent when no base texture is configured
- Replace the shadow-casting viewer setup with balanced non-shadow studio lighting and remove the floor and fixed scene background
- Adjust the initial and reset camera framing for a smaller, more front-facing product view
- Seed the demo with the built-in CustomForge logo and 22px project-name text

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
