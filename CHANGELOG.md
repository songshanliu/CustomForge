# Changelog

All notable changes to CustomForge will be documented in this file

## [Unreleased]

### Added

- ESM Library build configuration with source maps
- TypeScript declaration and declaration map generation
- Namespaced core stylesheet exported as `customforge/style.css`
- Local package verification and npm consumer example

### Changed

- Fabric.js and Three.js are peer dependencies for Library consumers
- Demo-only Lucide icons are development dependencies
- `ProductCustomizer` no longer exposes its Fabric.js editor or Three.js viewer instances
- Package version is prepared as `0.1.0-alpha.0` while remaining private
- Text and image objects remain fully inside the editor canvas while being added or transformed
- The built-in demo product no longer includes the obstructive torus handle
