import '@testing-library/jest-dom/vitest';

class MockEventSource {
	constructor(url, options) {
		this.url = url;
		this.withCredentials = options?.withCredentials;
		this.onopen = null;
		this.onmessage = null;
		this.onerror = null;
		this.closed = false;
	}

	close() {
		this.closed = true;
	}
}

globalThis.EventSource = MockEventSource;
