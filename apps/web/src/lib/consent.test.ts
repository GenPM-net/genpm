import { describe, expect, it } from 'vitest';
import { readChoice } from './consent.js';

describe('readChoice', () => {
  it('reads only an explicit decision', () => {
    expect(readChoice('')).toBeNull();
    expect(readChoice('genpm-theme=dark')).toBeNull();
    expect(readChoice('genpm_consent=granted')).toBe('granted');
    expect(readChoice('a=1; genpm_consent=denied; b=2')).toBe('denied');
    // Un valor desconocido o manipulado no cuenta como consentimiento.
    expect(readChoice('genpm_consent=grantedx')).toBeNull();
    expect(readChoice('xgenpm_consent=granted')).toBeNull();
  });
});
