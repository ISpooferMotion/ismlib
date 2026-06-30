/**
 * Represents the absolute positioning coordinates for a widget.
 */
export interface LayoutProps {
	x: number;
	y: number;
}

/**
 * A lightweight internal cursor-based layout engine.
 *
 * This allows widgets to calculate their X/Y coordinates in code (true IMGUI style)
 * rather than relying purely on CSS Flexbox.
 */
class LayoutEngine {
	private cursorX = 0;
	private cursorY = 0;
	private maxLineHeight = 0;

	/**
	 * Reset the layout cursor to the top-left at the start of a frame.
	 */
	beginFrame(): void {
		this.cursorX = 0;
		this.cursorY = 0;
		this.maxLineHeight = 0;
	}

	/**
	 * Get the current cursor position.
	 */
	getPosition(): LayoutProps {
		return { x: this.cursorX, y: this.cursorY };
	}

	/**
	 * Advance the layout cursor after a widget is drawn.
	 *
	 * @param width The width of the drawn widget
	 * @param height The height of the drawn widget
	 * @param sameLine If true, the next widget will be drawn on the same line. If false, wraps to the next line.
	 */
	advance(width: number, height: number, sameLine = false): void {
		if (height > this.maxLineHeight) {
			this.maxLineHeight = height;
		}

		if (sameLine) {
			this.cursorX += width;
		} else {
			this.cursorX = 0;
			this.cursorY += this.maxLineHeight;
			this.maxLineHeight = 0;
		}
	}

	/**
	 * Manually push the cursor to a specific X coordinate.
	 * Useful for alignment (e.g., aligning elements to the right).
	 */
	setCursorPosX(x: number): void {
		this.cursorX = x;
	}

	/**
	 * Manually push the cursor to a specific Y coordinate.
	 */
	setCursorPosY(y: number): void {
		this.cursorY = y;
	}
}

export const layout = new LayoutEngine();
