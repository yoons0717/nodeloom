import { describe, expect, it } from 'vitest';
import { GRAPH_SCHEMA_VERSION } from './index.js';

describe('GRAPH_SCHEMA_VERSION', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(GRAPH_SCHEMA_VERSION)).toBe(true);
    expect(GRAPH_SCHEMA_VERSION).toBeGreaterThan(0);
  });
});
