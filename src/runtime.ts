import * as errors from "./errors";
import { layout } from "./layout";
import type { FrameEntry } from "./types";

/**
 * Tracks an open scoped widget (e.g., Collapsing, Window).
 * Scopes nest: children are appended to the innermost scope's FrameEntry.
 */
interface ScopeEntry {
	id: string;
	label: string;
	frameEntry: FrameEntry;
}

/**
 * Object pool for zero-allocation FrameEntry nodes.
 */
class FramePool {
	private pool: FrameEntry[] = [];
	private index = 0;

	reset(): void {
		this.index = 0;
	}

	acquire(): FrameEntry {
		if (this.index >= this.pool.length) {
			this.pool.push({
				id: "",
				widgetName: "",
				args: [],
				scoped: false,
				children: [],
				defaultState: null,
				widgetProps: {
					"data-ismlib-widget": "",
					"data-ismlib-id": "",
					className: "",
				},
				layoutProps: { x: 0, y: 0 },
				renderFn: () => null,
				consumeStateFn: undefined,
			} as unknown as FrameEntry);
		}
		const entry = this.pool[this.index++] as FrameEntry;
		entry.children.length = 0;
		return entry;
	}
}

/**
 * The immediate-mode runtime engine.
 *
 * Manages widget state persistence, the ID stack for scoping,
 * the per-frame widget tree (frame buffer), and scheduling re-renders
 * through a registered React trigger.
 *
 * There is exactly one Runtime instance per application (singleton).
 */
class Runtime {
	/** Widget state persisted across frames, keyed by composite ID */
	private stateStore = new Map<string, unknown>();

	/** ID stack for pushId/popId scoping */
	private idStack: string[] = [];

	/** Per-frame collision counter: how many times each raw ID has appeared */
	private collisionCounter = new Map<string, number>();

	/** Raw IDs that have already emitted a duplicate warning this frame */
	private duplicateWarned = new Set<string>();

	/** Current frame's root-level entries */
	private frameRoot: FrameEntry[] = [];

	/** Object pool to prevent allocating FrameEntry objects every frame */
	private framePool = new FramePool();

	/** TTL for graceful state exits (id -> frames left) */
	private stateTTL = new Map<string, number>();
	private static readonly GC_TTL_FRAMES = 60; // Keep state alive for 1s at 60fps after unmounting

	/** Stack of open scoped widgets for end() matching */
	private scopeStack: ScopeEntry[] = [];

	/** Whether we're inside a beginFrame/endFrame pass */
	private drawing = false;

	/** Registered React re-render trigger */
	private rerenderFn: (() => void) | null = null;

	/** Whether a re-render has been requested but not yet processed */
	private dirty = false;

	/** Whether an app component is currently mounted */
	private appMounted = false;

	/// App lifecycle \\\

	/**
	 * Register the React re-render trigger. Called by createApp on mount.
	 * Only one app instance is supported at a time.
	 */
	registerApp(rerenderFn: () => void): void {
		this.appMounted = true;
		this.rerenderFn = rerenderFn;
	}

	/**
	 * Deregister the app and clear all state. Called by createApp on unmount.
	 */
	unregisterApp(): void {
		this.appMounted = false;
		this.rerenderFn = null;
		this.stateStore.clear();
		this.idStack = [];
		this.collisionCounter.clear();
		this.duplicateWarned.clear();
		this.frameRoot.length = 0;
		this.framePool.reset();
		this.stateTTL.clear();
		this.scopeStack.length = 0;
		this.drawing = false;
		this.dirty = false;
	}

	/**
	 * Whether an app is currently mounted.
	 */
	isAppMounted(): boolean {
		return this.appMounted;
	}

	/// Frame lifecycle \\\

	/**
	 * Start a new frame. Clears the frame buffer and per-frame counters.
	 * Must be paired with endFrame().
	 */
	beginFrame(): void {
		this.drawing = true;
		this.frameRoot.length = 0;
		this.framePool.reset();
		this.collisionCounter.clear();
		this.duplicateWarned.clear();
		this.scopeStack.length = 0;
		this.idStack.length = 0;
		this.dirty = false;
		layout.beginFrame();
	}

	/**
	 * End the current frame. Validates scope closure and garbage-collects
	 * state for widgets that disappeared since the previous frame.
	 */
	endFrame(): void {
		// Validate all scopes were closed
		if (this.scopeStack.length > 0) {
			const unclosed = this.scopeStack.map((s) => s.label);
			console.error(errors.unclosedScopes(unclosed));
		}

		// Collect current frame's IDs
		const currentIds = new Set<string>();
		this.collectIds(this.frameRoot, currentIds);

		// TTL-based GC: allow graceful state exits (e.g. for AnimatePresence)
		for (const [id, ttl] of this.stateTTL.entries()) {
			if (currentIds.has(id)) {
				this.stateTTL.set(id, Runtime.GC_TTL_FRAMES);
			} else {
				const newTtl = ttl - 1;
				if (newTtl <= 0) {
					this.stateStore.delete(id);
					this.stateTTL.delete(id);
				} else {
					this.stateTTL.set(id, newTtl);
				}
			}
		}

		// Initialize TTL for new IDs
		for (const id of currentIds) {
			if (!this.stateTTL.has(id)) {
				this.stateTTL.set(id, Runtime.GC_TTL_FRAMES);
			}
		}

		this.drawing = false;
	}

	/**
	 * Whether we're currently inside a draw pass.
	 */
	isDrawing(): boolean {
		return this.drawing;
	}

	/**
	 * Get the current frame buffer (root-level entries).
	 */
	getFrameBuffer(): FrameEntry[] {
		return this.frameRoot;
	}

	/// Widget state \\\

	/**
	 * Look up or initialize persistent state for a widget by ID.
	 * If no state exists, a deep clone of defaultState is stored and returned.
	 */
	getState<S>(id: string, defaultState: S): S {
		if (!this.stateStore.has(id)) {
			this.stateStore.set(id, structuredClone(defaultState));
		}
		return this.stateStore.get(id) as S;
	}

	/**
	 * Update persistent state for a widget by ID.
	 * Accepts a direct value or an updater function (prev => next).
	 * Triggers a re-render via markDirty().
	 */
	setState(id: string, updater: unknown): void {
		const current = this.stateStore.get(id);
		const next =
			typeof updater === "function"
				? (updater as (prev: unknown) => unknown)(current)
				: updater;
		this.stateStore.set(id, next);
		this.markDirty();
	}

	/// ID system \\\

	/**
	 * Build a composite ID from the current ID stack, widget name, and label.
	 *
	 * ID composition rules:
	 * - Stack prefix: all pushId values joined with "/"
	 * - Widget name: always included for type-level disambiguation
	 * - Label handling:
	 *   - "Label##suffix" -> full string used as-is (display is "Label")
	 *   - "Label###stableId" -> only "stableId" used for ID (display is "Label")
	 *   - "Label" -> used as-is
	 *   - undefined -> widget name used as fallback
	 * - Collision: second occurrence of the same raw ID gets "__2" appended (with warning)
	 */
	buildId(widgetName: string, label: string | undefined): string {
		let idPart: string;

		if (label !== undefined) {
			// ### convention: only text after ### is the ID
			const tripleHashIdx = label.indexOf("###");
			if (tripleHashIdx !== -1) {
				idPart = label.substring(tripleHashIdx + 3);
			} else {
				// ## convention (or no hash): full string is the ID
				idPart = label;
			}
		} else {
			// No label: use widget name as ID component
			idPart = widgetName;
		}

		// Compose: stack/WidgetName/idPart
		const stackPrefix =
			this.idStack.length > 0 ? `${this.idStack.join("/")}/` : "";
		const rawId = `${stackPrefix}${widgetName}/${idPart}`;

		// Collision detection and auto-disambiguation
		const count = this.collisionCounter.get(rawId) ?? 0;
		this.collisionCounter.set(rawId, count + 1);

		if (count > 0) {
			if (!this.duplicateWarned.has(rawId) && label !== undefined) {
				const displayLabel = extractDisplayLabel(label);
				console.warn(errors.duplicateId(widgetName, displayLabel));
				this.duplicateWarned.add(rawId);
			}
			return `${rawId}__${count + 1}`;
		}

		return rawId;
	}

	// Scope management (for scoped widgets + end()) \\\

	/**
	 * Push a scope onto the scope stack. Called by scoped widgets.
	 * Subsequent widget registrations become children of this scope's FrameEntry.
	 * Also pushes the scope's ID onto the ID stack for nested ID composition.
	 */
	pushScope(id: string, label: string, frameEntry: FrameEntry): void {
		this.scopeStack.push({ id, label, frameEntry });
		this.idStack.push(id);
	}

	/**
	 * Pop the innermost scope. Called by end().
	 * Pops both the scope stack and the ID stack.
	 */
	popScope(): void {
		if (this.scopeStack.length === 0) {
			console.error(errors.endWithoutScope());
			return;
		}
		this.scopeStack.pop();
		this.idStack.pop();
	}

	/**
	 * Acquire a pooled FrameEntry for zero-allocation rendering.
	 */
	acquireFrameEntry(): FrameEntry {
		return this.framePool.acquire();
	}

	/**
	 * Get the children array of the innermost open scope,
	 * or the frame root if no scopes are open.
	 */
	getCurrentParentChildren(): FrameEntry[] {
		if (this.scopeStack.length > 0) {
			const top = this.scopeStack[this.scopeStack.length - 1];
			if (top) {
				return top.frameEntry.children;
			}
		}
		return this.frameRoot;
	}

	// ID stack (pushId / popId) \\\

	/**
	 * Push an ID segment onto the stack.
	 * All widgets registered while this segment is on the stack
	 * will have it as a prefix in their composite IDs.
	 */
	pushIdSegment(id: string): void {
		this.idStack.push(id);
	}

	/**
	 * Pop the most recent ID segment from the stack.
	 */
	popIdSegment(): void {
		if (this.idStack.length === 0) {
			console.warn(errors.popIdEmpty());
			return;
		}
		this.idStack.pop();
	}

	// Scheduling \\\

	/**
	 * Signal that the UI needs a re-render.
	 * Calls the registered React trigger. No-ops if already dirty.
	 */
	markDirty(): void {
		if (this.dirty) return;
		this.dirty = true;
		if (this.rerenderFn) {
			const trigger = this.rerenderFn;
			// Always defer to a microtask. Calling a React dispatch
			// synchronously during render or a useEffect flush causes
			// "Too many re-renders". The microtask runs after React
			// finishes its current work, which is always safe.
			Promise.resolve().then(() => {
				if (this.rerenderFn) trigger();
			});
		}
	}

	// Transient state consumption \\\

	/**
	 * Walk the current frame buffer and call consumeStateFn on each widget
	 * that defines one. This resets one-shot event flags (e.g., "clicked").
	 * Called by the React bridge after DOM commit (in useEffect).
	 */
	consumeTransientState(): void {
		this.consumeEntries(this.frameRoot);
	}

	// Internals \\\

	private collectIds(entries: FrameEntry[], ids: Set<string>): void {
		for (const entry of entries) {
			ids.add(entry.id);
			this.collectIds(entry.children, ids);
		}
	}

	private consumeEntries(entries: FrameEntry[]): void {
		for (const entry of entries) {
			if (entry.consumeStateFn) {
				const currentState = this.stateStore.get(entry.id);
				if (currentState !== undefined) {
					this.stateStore.set(entry.id, entry.consumeStateFn(currentState));
				}
			}
			this.consumeEntries(entry.children);
		}
	}
}

/**
 * Extract the display label from a raw label string.
 * Strips ## and ### suffixes for display purposes.
 *
 * Examples:
 * - "Delete##item_3" -> "Delete"
 * - "Score###player_hp" -> "Score"
 * - "Hello world" -> "Hello world"
 */
export function extractDisplayLabel(label: string): string {
	const tripleHashIdx = label.indexOf("###");
	if (tripleHashIdx !== -1) {
		return label.substring(0, tripleHashIdx);
	}
	const doubleHashIdx = label.indexOf("##");
	if (doubleHashIdx !== -1) {
		return label.substring(0, doubleHashIdx);
	}
	return label;
}

/** Singleton runtime instance. Internal to the library. */
export const runtime = new Runtime();
