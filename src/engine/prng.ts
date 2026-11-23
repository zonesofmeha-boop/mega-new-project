/**
 * Mulberry32 seeded Pseudo-Random Number Generator.
 * Provides deterministic pseudo-random sequences for repeatable simulations.
 */
export class SeededPRNG {
  private state: number;

  constructor(seed: number = 1337) {
    this.state = seed >>> 0;
  }

  /** Returns next random float in [0, 1) */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns random integer in [min, max] inclusive */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns true with probability p (0 <= p <= 1) */
  public chance(p: number): boolean {
    return this.next() < p;
  }

  /** Picks a random element from an array */
  public choice<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot choose from empty array');
    }
    const idx = Math.floor(this.next() * array.length);
    return array[idx];
  }

  /** Resets state to a specific seed */
  public reseed(seed: number): void {
    this.state = seed >>> 0;
  }
}

export const defaultPRNG = new SeededPRNG(42);
