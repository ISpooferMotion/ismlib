<div align="center">
  <img src="./assets/logo.svg" alt="ISMLib Logo" width="64" />
</div>

<h1 align="center">@ispoofermotion/core</h1>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue.svg?style=for-the-badge" alt="Version" />
  <img src="https://img.shields.io/badge/license-Proprietary-red.svg?style=for-the-badge" alt="License: Proprietary" />
  <img src="https://img.shields.io/badge/React-19.0.0-61DAFB.svg?style=for-the-badge&logo=react" alt="React 19" />
</p>

<p align="center">
  The core declarative rendering engine and widget system for your UI.
</p>

## Overview

`@ispoofermotion/core` provides a highly optimized, React-based runtime for any UI layer. It abstracts away complex React state and layout thrashing by offering a specialized `defineWidget` API tailored for high-frequency IPC state streaming and headless rendering synchronization.

### Installation

```bash
bun add @ispoofermotion/core
```

## Architecture

* **Widget System (`defineWidget`)**: A declarative factory for defining UI components with isolated state boundaries, built-in accessibility scaffolding, and predictable re-render cycles.
* **Runtime Orchestration (`createApp`)**: A customized application mount wrapper that handles global error boundaries, React 19 concurrent mode initialization, and root-level IPC injection.
* **Style Engine**: Bundles the baseline `styles.css` containing global aesthetic resets and tactile layout primitives.

## Usage

### Defining a Widget

```tsx
import { defineWidget } from "@ispoofermotion/core";
import { createElement } from "react";

export const ProfileCard = defineWidget({
  name: "ProfileCard",
  defaultState: { clicked: false },
  render: ({ state, setState, args }) => {
    return createElement("div", null, `Hello ${args[0]}`);
  }
});
```

### Development Scripts

| Command             | Description                                  |
| ------------------- | -------------------------------------------- |
| `bun run build`     | Bundles the library using `tsup`.            |
| `bun run dev`       | Watches source files and rebuilds on change. |
| `bun run test`      | Runs the test suite via Vitest.              |
| `bun run lint`      | Runs the Biome linter across `src/`.         |
| `bun run typecheck` | Validates TypeScript types.                  |

## License

Proprietary and Confidential. Unauthorized copying, distribution, or usage of this file, via any medium, is strictly prohibited.

---

## Changelog

### [2.0.0] - 2026-07-01

#### Added

* **Storage Adapters**: Introduced `StorageAdapter` interface. Widgets can now be flagged with `persistent: true` to automatically restore state (e.g., from `localStorage`) across application restarts.

* **Environment Contexts**: Added `pushContext`, `popContext`, and `getContext` APIs for native immediate-mode dependency injection (similar to React Context).
* **Layering & Portals**: Added `pushLayer` and `popLayer` to render overlapping interfaces like tooltips and modals natively.
* **Scope Memoization**: Introduced `memoBlock(id, deps, drawClosure)` for aggressive CPU time reduction by deep-cloning subtrees dynamically when dependencies haven't changed.
* **Focus Management**: Integrated `FocusManager` into the runtime. `makeInteractive` now listens to focus events globally. Added `setFocus` and `isFocused`.
* **DevTools Hook**: The engine now securely mounts to `window.__ISMLIB_DEVTOOLS__`, allowing extensions to query internal layout buffers and the state store without polling.
* (7b9e80f) **Tests**: Fixed TypeScript type errors by providing missing layoutProps in test mocks.
* (b5c12c5) **Chore**: Configured package for `@ispoofermotion` organization release.

#### Changed

* **Architectural Overhaul**: Removed the global `runtime` singleton. The engine now uses a React-style thread-local dispatcher pattern (`getActiveRuntime()`), supporting multiple independent `ismlib` instances on a single page.

* **Garbage Collection**: Replaced frame-count based state expiration with a robust, time-based GC using `Date.now()`.
* **Layout System**: Completely deleted absolute positional coordinate tracking (`cursorX`/`cursorY`). Layouts are now cleanly deferred to native CSS Flexbox and Grid.

#### Removed

* Removed explicit layout properties (`layoutProps`) globally from the widget definitions, adopting a modern declarative DOM integration pattern.

### [1.0.0] - 2026-06-30

* Initial release with `defineWidget`, `createApp`, and virtual DOM to React runtime adapter.
