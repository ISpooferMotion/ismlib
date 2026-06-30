/**
 * `makeInteractive` -- accessibility helper for widget authors.
 *
 * Returns props that make any DOM element fully keyboard-accessible:
 * - `tabIndex` for focus reachability
 * - `onKeyDown` handler that fires `onClick` on Enter and Space
 * - `role` if provided
 *
 * Spread these onto the same element as `widgetProps` to get keyboard
 * accessibility without implementing it per-widget.
 *
 * @param onClick - The action to perform when the user activates the element
 * @param options - Optional overrides
 * @returns Props to spread onto the root DOM element
 *
 * @since 1.0.0
 *
 * @example
 * ```ts
 * import { makeInteractive } from "@ismlib/core";
 *
 * render: ({ id, state, setState, widgetProps }) => {
 *   const interactive = makeInteractive(() => setState({ clicked: true }));
 *   return createElement("div", {
 *     key: id,
 *     ...widgetProps,
 *     ...interactive,
 *   }, "Click me");
 * }
 * ```
 */
export function makeInteractive(
	onClick: () => void,
	options: {
		/**
		 * Override the default tabIndex (0 = in natural tab order).
		 * Pass -1 to remove from tab order (e.g., a disabled element).
		 */
		tabIndex?: number;
		/**
		 * Keys that trigger onClick in addition to Enter and Space.
		 * Values are KeyboardEvent.key strings.
		 */
		extraKeys?: string[];
		/** Whether the element is disabled. Disabled elements are not interactive. */
		disabled?: boolean;
	} = {},
): {
	tabIndex: number;
	onKeyDown: (e: KeyboardEvent) => void;
	onClick: () => void;
	"aria-disabled"?: boolean;
} {
	const { tabIndex = 0, extraKeys = [], disabled = false } = options;

	const activationKeys = new Set(["Enter", " ", ...extraKeys]);

	const handleKeyDown = (e: KeyboardEvent) => {
		if (disabled) return;
		if (activationKeys.has(e.key)) {
			e.preventDefault();
			onClick();
		}
	};

	const handleClick = () => {
		if (!disabled) onClick();
	};

	return {
		tabIndex: disabled ? -1 : tabIndex,
		onKeyDown: handleKeyDown,
		onClick: handleClick,
		...(disabled ? { "aria-disabled": true } : {}),
	};
}
