/**
 * @ismlib/core -- Immediate-mode UI runtime for Tauri + React
 *
 * @packageDocumentation
 *
 * ## Quick start
 *
 * ```ts
 * import { createApp, defineWidget, end, markDirty } from "@ismlib/core";
 * import "@ismlib/core/styles.css";
 *
 * // 1. Define your widgets
 * const Button = defineWidget<{ clicked: boolean }, [label: string], boolean>({
 *   name: "Button",
 *   defaultState: { clicked: false },
 *   a11y: { role: "button", label: ([label]) => label },
 *   render: ({ id, setState, args, widgetProps }) =>
 *     createElement("button", {
 *       key: id,
 *       ...widgetProps,
 *       ...makeInteractive(() => setState({ clicked: true })),
 *     }, args[0]),
 *   getReturnValue: (state) => state.clicked,
 *   consumeState: (state) => ({ ...state, clicked: false }),
 * });
 *
 * // 2. Write your draw function
 * let count = 0;
 * const App = createApp(() => {
 *   if (Button("Increment")) { count++; markDirty(); }
 * });
 *
 * // 3. Mount
 * createRoot(document.getElementById("root")!).render(createElement(App));
 * ```
 *
 * ## Stability guarantee
 *
 * See `STABILITY.md` in the repository root. The public API listed below
 * is stable from v1.0.0. New behavior is always additive -- new optional
 * parameters or new functions. Existing signatures never change.
 *
 * @since 1.0.0
 */

export { createApp } from "./createApp";
export { defineWidget } from "./defineWidget";
export { ISMLibErrorBoundary } from "./ErrorBoundary";
export { makeInteractive } from "./makeInteractive";
export { extractDisplayLabel } from "./runtime";
export type {
	WidgetA11y,
	WidgetConfig,
	WidgetProps,
	WidgetRenderProps,
} from "./types";

// Runtime convenience functions
// These are thin, documented wrappers around the runtime singleton,
// providing a flat API surface for user draw functions.

import * as errors from "./errors";
import { runtime } from "./runtime";

export { type LayoutProps, layout } from "./layout";
export { runtime };

/**
 * Push an ID segment onto the stack.
 *
 * All widgets called while this segment is active will include it as a
 * prefix in their composite IDs, creating a stable unique identity even
 * when the same widget type appears multiple times.
 *
 * **Always pair with a matching `popId()` call.**
 *
 * @param id - A stable string identifier (e.g., a database row ID, not a loop index)
 *
 * @since 1.0.0
 *
 * @example
 * ```ts
 * for (const item of items) {
 *   pushId(item.id);
 *   Text(item.name);
 *   if (Button("Delete")) { remove(item.id); markDirty(); }
 *   popId();
 * }
 * ```
 */
export function pushId(id: string): void {
	if (!runtime.isDrawing()) {
		throw new Error(errors.idStackOutsideDraw("pushId"));
	}
	runtime.pushIdSegment(id);
}

/**
 * Pop the most recent ID segment from the stack.
 *
 * Must be paired with a preceding `pushId()`. Calling `popId()` with an
 * empty stack logs a warning and is a no-op.
 *
 * @since 1.0.0
 */
export function popId(): void {
	if (!runtime.isDrawing()) {
		throw new Error(errors.idStackOutsideDraw("popId"));
	}
	runtime.popIdSegment();
}

/**
 * Close the innermost open scoped widget.
 *
 * Must be called exactly once for every scoped widget call (e.g., a widget
 * defined with `scoped: true`). Calling `end()` more times than there are
 * open scopes logs an error and is a no-op.
 *
 * @since 1.0.0
 *
 * @example
 * ```ts
 * if (Collapsing("Settings")) {
 *   Slider("Volume", 0, 100);
 *   end(); // closes Collapsing
 * }
 * ```
 */
export function end(): void {
	if (!runtime.isDrawing()) {
		throw new Error(errors.endOutsideDraw());
	}
	runtime.popScope();
}

/**
 * Signal that your app's external state has changed and a new frame is needed.
 *
 * You do **not** need to call this after widget interactions -- those trigger
 * re-renders automatically via `setState`. Call `markDirty()` when you change
 * your own variables from outside the draw function (e.g., from a timer,
 * network response, or Tauri event listener).
 *
 * Multiple `markDirty()` calls within the same microtask batch are coalesced
 * into a single re-render.
 *
 * @since 1.0.0
 *
 * @example
 * ```ts
 * // From a Tauri event
 * listen("download_progress", (e) => {
 *   state.progress = e.payload.percent;
 *   markDirty();
 * });
 *
 * // From a timer
 * setInterval(() => {
 *   state.elapsed++;
 *   markDirty();
 * }, 1000);
 * ```
 */
export function markDirty(): void {
	runtime.markDirty();
}
