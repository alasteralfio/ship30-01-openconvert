// Service worker: the only network caller. Owns the RateProvider abstraction,
// fetches and caches the single USD-anchored rate table, runs the browser.alarms
// refresh, and answers messages (getRates, refreshRates). No DOM logic.
// See overview.md > Architecture.

export {};
