import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Test setup for the pricing golden tests.
 *
 * Scope is deliberately narrow: `tests/` only, node environment, no jsdom, no
 * React rendering. These tests pin what a customer is CHARGED, and every
 * number they check comes out of a pure function. Keeping the runner this
 * small is what makes `npm test` finish in under a second, which is what makes
 * it something you actually run before pushing a price change.
 */
export default defineConfig({
    resolve: {
        alias: { '@': path.resolve(__dirname, '.') },
    },
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],
    },
});
