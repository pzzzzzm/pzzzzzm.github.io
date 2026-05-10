// Lazy generator cache. Same shape as SODA / IWOCA — see
// apps/gray-codes/soda-spanning-trees/cache.js for rationale.

export class PathSequence {
  constructor(genFactory, totalCount) {
    this.genFactory = genFactory;
    this.iter = genFactory();
    this.cache = [];
    this.exhausted = false;
    this.totalCount = totalCount;
  }
  get total() { return this.totalCount; }
  cachedCount() { return this.cache.length; }
  has(i) { return i >= 0 && i < this.cache.length; }
  get(i) {
    if (i < 0 || i >= this.cache.length) return undefined;
    return this.cache[i];
  }
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
    const n = sample.path.length;
    // path int array + op object (alpha/beta/gamma arrays + flags)
    const perState = 32 + (24 + 8 * n) + (24 + 8 * n) * 3 + 80;
    return this.cache.length * perState;
  }
}
