// Content script: scan the DOM for prices, request the cached rate table from the
// worker once, convert locally, rewrite/annotate matches, and keep up with dynamic
// pages via a throttled MutationObserver. Enforces the active allow/deny rule and
// reports the dominant currency for source auto-detect.
// See overview.md > Architecture.

export {};
