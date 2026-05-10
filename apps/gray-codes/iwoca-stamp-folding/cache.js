// Lazy cached wrapper around a generator. Same shape as SODA's cache.js —
// see that file for the rationale on lazy generation, no persistence to
// disk, and chunked-reveal-with-buffer at the call site.

export class FoldingSequence {
  constructor(genFactory, totalCount) {
    this.genFactory = genFactory;
    this.iter = genFactory();
    this.cache = [];
    this.exhausted = false;
    this.totalCount = totalCount;     // may be null if unknown
  }

  get total() { return this.totalCount; }

  get(i) {
    if (i < 0 || i >= this.cache.length) return undefined;
    return this.cache[i];
  }

  has(i) { return i >= 0 && i < this.cache.length; }

  cachedCount() { return this.cache.length; }

  generateUpTo(targetIdx) {
    while (this.cache.length <= targetIdx && !this.exhausted) {
      const r = this.iter.next();
      if (r.done) { this.exhausted = true; break; }
      this.cache.push(r.value);
    }
    return this.cache.length;
  }

  estimatedBytes() {
    if (this.cache.length === 0) return 0;
    const sample = this.cache[0];
    const n = sample.perm.length;
    // perm Int-ish array + q Int-ish array + op object + wrapper overhead.
    const perState = 32 + (24 + 8 * n) + (24 + 8 * n) + 80;
    return this.cache.length * perState;
  }
}
