// Copyright (c) Manfred Foissner. All rights reserved.
// License: See LICENSE.txt in the project root.

// ============================================================
// SeededRandom.js - Deterministic Random Number Generator
// ============================================================
// Uses Mulberry32 algorithm for fast, seedable random numbers
// Same seed = same map every time

export class SeededRandom {
  constructor(seed) {
    this.seed = (seed >>> 0);
    this.state = (seed >>> 0);
  }
  
  // Reset to original seed
  reset() {
    this.state = (this.seed >>> 0);
  }
  
  // Set new seed
  setSeed(seed) {
    this.seed = (seed >>> 0);
    this.state = (seed >>> 0);
  }
  
  // Get next random float [0, 1)
  next() {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  // Compatibility alias used by newer world-theme passes
  unit() {
    return this.next();
  }
  
  // Random float in range [min, max)
  range(min, max) {
    return min + this.next() * (max - min);
  }
  
  // Random integer in range [min, max] (inclusive)
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
  
  // Random boolean with probability
  chance(probability = 0.5) {
    return this.next() < probability;
  }
  
  // Pick random element from array
  pick(array) {
    if (!array || array.length === 0) return null;
    return array[this.int(0, array.length - 1)];
  }
  
  // Shuffle array (returns new array)
  shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  
  // Generate seed from string (for named seeds like "ACT1_ZONE2")
  static fromString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return (hash >>> 0);
  }
}

export default SeededRandom;
