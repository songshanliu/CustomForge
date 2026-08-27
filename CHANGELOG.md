# Changelog

All notable changes to CustomForge will be documented in this file

## [Unreleased]

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
