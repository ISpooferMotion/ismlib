# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-07-01

### Added

- **Storage Adapters**: Introduced `StorageAdapter` interface. Widgets can now be flagged with `persistent: true` to automatically restore state (e.g., from `localStorage`) across application restarts.
- **Environment Contexts**: Added `pushContext`, `popContext`, and `getContext` APIs for native immediate-mode dependency injection (similar to React Context).
- **Layering & Portals**: Added `pushLayer` and `popLayer` to render overlapping interfaces like tooltips and modals natively.
- **Scope Memoization**: Introduced `memoBlock(id, deps, drawClosure)` for aggressive CPU time reduction by deep-cloning subtrees dynamically when dependencies haven't changed.
- **Focus Management**: Integrated `FocusManager` into the runtime. `makeInteractive` now listens to focus events globally. Added `setFocus` and `isFocused`.
- **DevTools Hook**: The engine now securely mounts to `window.__ISMLIB_DEVTOOLS__`, allowing extensions to query internal layout buffers and the state store without polling.
- (7b9e80f) **Tests**: Fixed TypeScript type errors by providing missing layoutProps in test mocks.
- (b5c12c5) **Chore**: Configured package for `@ispoofermotion` organization release.

### Changed

- **Architectural Overhaul**: Removed the global `runtime` singleton. The engine now uses a React-style thread-local dispatcher pattern (`getActiveRuntime()`), supporting multiple independent `ismlib` instances on a single page.
- **Garbage Collection**: Replaced frame-count based state expiration with a robust, time-based GC using `Date.now()`.
- **Layout System**: Completely deleted absolute positional coordinate tracking (`cursorX`/`cursorY`). Layouts are now cleanly deferred to native CSS Flexbox and Grid.

### Removed

- Removed explicit layout properties (`layoutProps`) globally from the widget definitions, adopting a modern declarative DOM integration pattern.

## [1.0.0] - 2026-06-30

### Added

- Core widget factory `defineWidget` to standardize stateful React component generation.
- Virtual DOM to React runtime adapter in `runtime.ts` for IPC synchronization.
- Application mount wrapper `createApp.tsx` utilizing React 19 concurrent features.
- Global error boundary implementation tailored for Tauri error recovery.
- Automated bundler configuration using `tsup` for ESM, CJS, and DTS output generation.
- High-performance testing pipeline utilizing `vitest` and `happy-dom`.
- Initial baseline UI primitive definitions and CSS structural classes (`styles.css`).
