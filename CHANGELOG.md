# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-06-30

### Added

- Core widget factory `defineWidget` to standardize stateful React component generation.
- Virtual DOM to React runtime adapter in `runtime.ts` for IPC synchronization.
- Application mount wrapper `createApp.tsx` utilizing React 19 concurrent features.
- Global error boundary implementation tailored for Tauri error recovery.
- Automated bundler configuration using `tsup` for ESM, CJS, and DTS output generation.
- High-performance testing pipeline utilizing `vitest` and `happy-dom`.
- Initial baseline UI primitive definitions and CSS structural classes (`styles.css`).
