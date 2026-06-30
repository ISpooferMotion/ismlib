// Reset the runtime singleton between every test so state doesn't leak
import { afterEach } from "vitest";
import { runtime } from "../runtime";

afterEach(() => {
	// Simulate unmount to reset all state
	runtime.unregisterApp();
});
