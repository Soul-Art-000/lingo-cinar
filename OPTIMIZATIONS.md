### 1) Optimization Summary

The current optimization health of the application is generally solid. The core game loop operates synchronously and is O(N) optimized for word validation. However, there are significant cost and algorithmic bottlenecks concerning how external database calls are handled and how the dictionary is processed in memory.

**Top 3 Highest-Impact Improvements:**
1. **Firestore Leaderboard Caching**: Fetching the top 10 scores triggers an uncached database read every time the modal opens.
2. **Word Pool Allocation overhead**: `[...TDK]` creates a massive short-lived array and iterates over ~20,000 strings to compute unicode lengths on every game start.
3. **Missing Reliability for Score Saves**: `fsSave` is purely fire-and-forget; transient network drops permanently lose user scores.

**Biggest Risk if No Changes Are Made:**
**Firestore Cost Amplification.** Because there is no caching or rate-limiting on the leaderboard reads, a user repeatedly opening the "Solo Oyna" menu will rapidly consume the Firebase Free Tier quota (10 document reads per click), leading to immediate billing risks or service denial.

---

### 2) Findings (Prioritized)

#### Missing TTL Cache for Firestore Leaderboard
* **Category**: Caching / Cost / DB
* **Severity**: Critical
* **Impact**: Cost, Network Latency
* **Evidence**: `$("soloBtn").addEventListener("click", ... drawLeaderboard(); ...)` calls `fsTop()` which triggers `fetch(runQuery)` with `limit: 10`.
* **Why it’s inefficient**: Opening the menu executes a fresh network request and consumes 10 Firebase reads. Toggling the menu 100 times costs 1,000 reads.
* **Recommended fix**: Implement a 60-second in-memory TTL cache for `fsTop()`. Only execute the `fetch` if the cache is empty or expired.
* **Tradeoffs / Risks**: The leaderboard may be up to 60 seconds stale.
* **Expected impact estimate**: 95%+ reduction in Firebase read costs.
* **Removal Safety**: Safe
* **Reuse Scope**: Local file

#### O(N) Set Spread and Unicode Iteration for Word Pooling
* **Category**: Memory / Algorithm
* **Severity**: Medium
* **Impact**: CPU, Memory Allocation, GC Spikes
* **Evidence**: `const pool = [...TDK].filter(w => m.lens.includes(len(w)));` in the mode selection handler.
* **Why it’s inefficient**: It converts a ~20,000-item `Set` into an `Array`, then calls `len(w)` which does `[...w].length` to safely count unicode characters. Spreading strings into character arrays 20,000 times causes massive, unnecessary object allocation and Garbage Collection pressure.
* **Recommended fix**: Pre-compute and group words by length **once** during application startup: `const WORDS_BY_LEN = { 4: [], 5: [], 6: [], 7: [] };`.
* **Tradeoffs / Risks**: Very slight initial memory footprint increase (storing arrays alongside the Set).
* **Expected impact estimate**: Eliminates ~40,000 object/array allocations per game start. Immediate execution instead of ~10-20ms blocking.
* **Removal Safety**: Safe
* **Reuse Scope**: Local file

#### Silent Failures on Score Submission (No Retry)
* **Category**: Reliability
* **Severity**: Medium
* **Impact**: User Experience, Data Integrity
* **Evidence**: `const fsSave = (name, score) => fetch(...).catch(() => {});`
* **Why it’s inefficient**: The fetch is fire-and-forget. A 1-second Wi-Fi drop means a hard-earned high score is permanently lost.
* **Recommended fix**: Wrap `fsSave` with a retry mechanism or an offline queue (saving pending submissions to `localStorage` and retrying them when the app boots or network returns).
* **Tradeoffs / Risks**: Increases logic complexity.
* **Expected impact estimate**: Prevents 100% of score loss from transient network errors.
* **Removal Safety**: Safe
* **Reuse Scope**: Local file

#### `words.js` Parsing Overhead and Bundle Size
* **Category**: Build / I/O
* **Severity**: Low
* **Impact**: JavaScript Parse Time, Disk/Network Size
* **Evidence**: Assuming `words.js` is structured as `const TDK = new Set(["abajur", "abaküs", ...]);`.
* **Why it’s inefficient**: Parsing 20,000 distinct strings into a Set takes AST parsing time. The thousands of quote characters and commas inflate the file size.
* **Recommended fix**: Compress the dictionary payload into a single string and split it: `const TDK = new Set("abajur,abaküs,...".split(","));`.
* **Tradeoffs / Risks**: Negligible.
* **Expected impact estimate**: ~15-20% smaller `words.js` payload, faster JS engine parsing.
* **Removal Safety**: Safe
* **Reuse Scope**: Module

#### Redundant DOM Node Lookups in Hot Paths
* **Category**: Frontend
* **Severity**: Low
* **Impact**: CPU (Micro-optimization)
* **Evidence**: `document.querySelector('[data-k="${cur[i]}"]')` inside `submit()` and `[...rowEl().children]` on every keystroke in `paint()`.
* **Why it’s inefficient**: Querying the DOM dynamically for static elements (the keyboard layout) on every keystroke adds rendering overhead.
* **Recommended fix**: Cache the keyboard key elements in a `Map` during initialization. Cache the current row's tile elements when `startRow()` is called.
* **Tradeoffs / Risks**: Requires managing DOM element references.
* **Expected impact estimate**: Millisecond-level gains; mostly just good practice.
* **Removal Safety**: Safe
* **Reuse Scope**: Local file

---

### 3) Quick Wins (Do First)

1. **Add TTL Cache to `fsTop()`**: Can be implemented in 5 lines of code. Instantly secures the database from cost amplification.
2. **Pre-group TDK Words**: Replace the `[...TDK].filter()` on click with a one-time loop at the bottom of the script that populates length-specific arrays.
3. **Format `words.js`**: Convert the dictionary to a single `.split(",")` string to trim bytes.

---

### 4) Deeper Optimizations (Do Next)

1. **Offline Queue Sync**: Build a `syncScores()` function that runs on load, pushing any unsubmitted scores stored in `localStorage` to Firestore.
2. **Virtual Keyboard Map**: Create a `const keyNodes = new Map()` on boot to map letters (e.g., "A") to their respective `<button>` DOM nodes, preventing `querySelector` in the game loop.
3. **Web Worker Dictionary**: Move the TDK filtering and validation logic to a Web Worker so that parsing and memory allocation never block the main UI thread.

---

### 5) Validation Plan

* **Benchmarks**: 
  - Measure the time taken by `$("modes").addEventListener("click")` before and after pre-grouping words using `performance.now()`. Target: < 1ms.
* **Profiling strategy**:
  - Run the Chrome DevTools Performance Profiler during rapid keystrokes to ensure `paint()` DOM lookups are not causing Forced Synchronous Layouts.
* **Metrics to compare before/after**:
  - Check the Firebase Console "Usage" tab. Firestore reads should flatline to max 10 reads per minute per active user, rather than spiking with every button click.
* **Test cases**:
  - Disable network via DevTools. Finish a ranked game. Re-enable network. Verify the score is properly retried and submitted.

---

### 6) Optimized Code / Patch

**Firestore TTL Cache Patch:**
```javascript
let fsCache = null;
let fsCacheTime = 0;

async function fsTop() {
  const now = Date.now();
  // 60-second TTL
  if (fsCache && now - fsCacheTime < 60000) return fsCache;

  const r = await fetch(`${FS}:runQuery`, { ... });
  if (!r.ok) throw r.status;
  
  fsCache = (await r.json()).filter(x => x.document).map(...);
  fsCacheTime = now;
  return fsCache;
}
```

**Word Pre-grouping Patch:**
```javascript
// Run once on load instead of every game start
const WORDS_BY_LEN = { 4: [], 5: [], 6: [], 7: [] };
TDK.forEach(w => {
  const l = [...w].length; // Compute unicode length once
  if (WORDS_BY_LEN[l]) WORDS_BY_LEN[l].push(w);
});

// Inside mode selection handler:
// O(1) fetch instead of O(N) filter
let pool = [];
m.lens.forEach(l => pool.push(...WORDS_BY_LEN[l]));
```
