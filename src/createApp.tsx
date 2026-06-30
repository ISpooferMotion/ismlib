import type { ReactNode } from "react";
import { createElement, Fragment, useEffect, useReducer } from "react";
import { ISMLibErrorBoundary } from "./ErrorBoundary";
import { runtime } from "./runtime";
import type { FrameEntry } from "./types";

/**
 * Render a single FrameEntry to a React element.
 * Retrieves the widget's current state, creates a setState callback,
 * recursively renders children, and calls the entry's render closure.
 */
function renderEntry(entry: FrameEntry): ReactNode {
	const state = runtime.getState(entry.id, entry.defaultState);

	const setState = (updater: unknown) => {
		runtime.setState(entry.id, updater);
	};

	// Recursively render children for scoped widgets
	const children =
		entry.children.length > 0
			? createElement(
					Fragment,
					null,
					...entry.children.map((child) =>
						createElement(Fragment, { key: child.id }, renderEntry(child)),
					),
				)
			: null;

	return entry.renderFn({
		id: entry.id,
		state,
		setState,
		args: entry.args,
		children,
		widgetProps: entry.widgetProps,
		layoutProps: entry.layoutProps,
	});
}

/**
 * Render the full frame buffer to a React element tree.
 * Each entry is wrapped in a keyed Fragment for stable reconciliation.
 */
function renderFrameBuffer(entries: FrameEntry[]): ReactNode {
	if (entries.length === 0) return null;
	return createElement(
		Fragment,
		null,
		...entries.map((entry) =>
			createElement(Fragment, { key: entry.id }, renderEntry(entry)),
		),
	);
}

/**
 * Create the root React component for an immediate-mode app.
 *
 * Takes a draw function that describes the entire UI through widget calls.
 * Returns a standard `React.FC` wrapped in an `ISMLibErrorBoundary` that
 * shows a friendly message instead of a blank screen on error.
 *
 * The returned component:
 * 1. Registers a re-render trigger with the runtime on mount
 * 2. Runs `beginFrame` → `drawFn` → `endFrame` on each render (the "draw pass")
 * 3. Converts the frame buffer to React elements (the "commit")
 * 4. Consumes transient widget state after DOM commit (`useEffect`)
 * 5. Cleans up all runtime state on unmount
 *
 * @param drawFn - Pure function describing the UI for one frame.
 *   Call widget functions here. No React hooks or JSX.
 *
 * @since 1.0.0
 *
 * @example
 * ```ts
 * import { createApp, markDirty } from "@ismlib/core";
 * import { Button, Text } from "./widgets";
 *
 * let count = 0;
 *
 * const App = createApp(() => {
 *   Text("Count: " + count);
 *   if (Button("Increment")) {
 *     count++;
 *     markDirty();
 *   }
 * });
 *
 * createRoot(document.getElementById("root")!).render(createElement(App));
 * ```
 */
export function createApp(drawFn: () => void): React.FC {
	function ISMLib() {
		// Force re-render by incrementing a counter.
		// This is the only React state in the entire system.
		const [, forceRender] = useReducer((x: number) => x + 1, 0);

		// Register the re-render trigger on mount, clean up on unmount
		useEffect(() => {
			runtime.registerApp(forceRender);
			return () => {
				runtime.unregisterApp();
			};
		}, []);

		// Consume transient state (e.g., button "clicked" flags) after every commit.
		// Runs after React has flushed DOM updates, so the user's draw function
		// sees the event on exactly one frame before it's cleared.
		useEffect(() => {
			runtime.consumeTransientState();
		});

		// Run the draw pass: describe this frame as pure data
		let drawError: string | null = null;
		runtime.beginFrame();
		try {
			drawFn();
		} catch (err: unknown) {
			drawError = err instanceof Error ? err.message : String(err);
		}
		runtime.endFrame();

		// If the draw function threw, show a friendly error
		if (drawError) {
			return createElement(
				"pre",
				{
					style: {
						color: "#ff6b6b",
						padding: "16px",
						fontFamily: "monospace",
						fontSize: "14px",
						whiteSpace: "pre-wrap",
						wordBreak: "break-word",
					},
				},
				drawError,
			);
		}

		// Convert frame buffer to React elements
		const frameBuffer = runtime.getFrameBuffer();
		return createElement(
			"div",
			{ "data-ismlib-root": "" },
			renderFrameBuffer(frameBuffer),
		);
	}

	ISMLib.displayName = "ISMLib";

	// Wrap in an error boundary so uncaught errors from widget render functions
	// show a friendly message instead of a blank screen.
	function ISMLibApp() {
		return createElement(ISMLibErrorBoundary, null, createElement(ISMLib));
	}
	ISMLibApp.displayName = "ISMLibApp";

	return ISMLibApp;
}
