import { createElement } from "react";
import { defineWidget } from "./defineWidget";
import { mountedRuntimes } from "./runtime";

// Call markDirty on all mounted runtimes. We import from runtime.ts directly
// (not index.ts) to avoid the circular dep: index -> DevConsole -> index.
function triggerRedraw() {
	for (const runtime of mountedRuntimes) {
		runtime.markDirty();
	}
}

const devLogs: string[] = [];
let maxLogs = 100;

/**
 * Attaches to console.log, console.warn, console.error to capture output.
 * Call this once at the start of your application if you want to use DevConsole.
 */
export function attachDevConsole(limit = 100) {
	maxLogs = limit;
	if ((window as unknown as Record<string, unknown>).__ism_console_attached)
		return;
	(window as unknown as Record<string, unknown>).__ism_console_attached = true;

	const originalLog = console.log;
	const originalWarn = console.warn;
	const originalError = console.error;

	const capture = (type: string, ...args: unknown[]) => {
		const msg = args
			.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
			.join(" ");
		devLogs.push(`[${type}] ${msg}`);
		if (devLogs.length > maxLogs) devLogs.shift();
		triggerRedraw(); // Trigger immediate mode UI re-draw
	};

	console.log = (...args) => {
		originalLog(...args);
		capture("log", ...args);
	};
	console.warn = (...args) => {
		originalWarn(...args);
		capture("warn", ...args);
	};
	console.error = (...args) => {
		originalError(...args);
		capture("error", ...args);
	};
}

/**
 * Get the current captured dev logs.
 */
export function getDevLogs(): string[] {
	return devLogs;
}

/**
 * A floating, immediate-mode widget that displays the captured terminal logs.
 * Ensure you have called `attachDevConsole()` before or during your app initialization.
 */
export const DevConsole = defineWidget<{ expanded: boolean }, [], void>({
	name: "DevConsole",
	defaultState: { expanded: false },
	render: ({ id, state, setState }) => {
		if (!state.expanded) {
			return createElement(
				"button",
				{
					key: id,
					type: "button" as const,
					onClick: () => setState({ expanded: true }),
					style: {
						position: "absolute",
						bottom: "8px",
						left: "8px",
						backgroundColor: "rgba(0, 0, 0, 0.8)",
						color: "white",
						fontSize: "10px",
						fontFamily: "monospace",
						padding: "4px 8px",
						borderRadius: "4px",
						border: "1px solid rgba(255, 255, 255, 0.2)",
						zIndex: 99999,
						cursor: "pointer",
					},
				},
				`Logs (${devLogs.length})`,
			);
		}

		return createElement(
			"div",
			{
				key: id,
				style: {
					position: "absolute",
					bottom: "8px",
					left: "8px",
					width: "300px",
					height: "200px",
					backgroundColor: "rgba(0, 0, 0, 0.95)",
					color: "white",
					fontSize: "11px",
					fontFamily: "monospace",
					borderRadius: "6px",
					border: "1px solid rgba(255, 255, 255, 0.2)",
					zIndex: 99999,
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
					boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
				},
			},
			createElement(
				"div",
				{
					onClick: () => setState({ expanded: false }),
					style: {
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						backgroundColor: "rgba(255, 255, 255, 0.1)",
						padding: "4px 8px",
						borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
						cursor: "pointer",
					},
				},
				createElement("span", null, "Dev Console"),
				createElement("span", null, "×"),
			),
			createElement(
				"div",
				{
					style: {
						flex: 1,
						overflowY: "auto",
						padding: "8px",
						display: "flex",
						flexDirection: "column",
						gap: "4px",
					},
					ref: (el: HTMLDivElement | null) => {
						if (el) el.scrollTop = el.scrollHeight;
					},
				},
				devLogs.length === 0
					? createElement(
							"div",
							{
								style: { color: "rgba(255,255,255,0.3)", fontStyle: "italic" },
							},
							"No logs yet",
						)
					: devLogs.map((log, i) =>
							createElement(
								"div",
								{
									key: i,
									style: { wordBreak: "break-word", whiteSpace: "pre-wrap" },
								},
								log,
							),
						),
			),
		);
	},
	getReturnValue: () => undefined,
});
