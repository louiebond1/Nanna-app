"use strict";
// Small in-memory token bucket. Best effort: it slows guessing of room codes
// and runaway clients, it isn't a security boundary on its own.
class RateLimiter {
  constructor({ capacity, refillPerSecond, now = () => Date.now() }) {
    this.capacity = capacity;
    this.refill = refillPerSecond;
    this.now = now;
    this.buckets = new Map();
  }

  take(key) {
    const t = this.now();
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.capacity, at: t };
      this.buckets.set(key, b);
    }
    b.tokens = Math.min(this.capacity, b.tokens + ((t - b.at) / 1000) * this.refill);
    b.at = t;
    if (this.buckets.size > 10000) this.sweep(t);
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  }

  sweep(t) {
    for (const [k, b] of this.buckets) if (t - b.at > 10 * 60 * 1000) this.buckets.delete(k);
  }
}

module.exports = { RateLimiter };
