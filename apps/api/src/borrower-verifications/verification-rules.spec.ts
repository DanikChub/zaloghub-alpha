import { describe, expect, it } from 'vitest';
import { date, hash, money, object } from './verification.validation.js';
import {
  assess,
  httpUrl,
  resultInput,
  validateResult,
} from './verification-results.js';
import { DocumentStorageService } from './document-storage.service.js';
import { CHECKS } from './verification.checklist.js';
describe('Verification input and result rules', () => {
  it('distinguishes false, zero and unknown results', () => {
    const result = resultInput({
      resultBoolean: false,
      resultAmount: '0.00',
      currency: 'RUB',
    });
    expect(result.resultBoolean).toBe(false);
    expect(result.resultAmount).toBe('0.00');
    expect(() => resultInput({ resultBoolean: null })).toThrow();
    expect(() =>
      validateResult('PASSPORT_VALIDITY', resultInput({})),
    ).toThrow();
    expect(assess('PASSPORT_VALIDITY', { resultBoolean: false }, [])).toBe(
      'IDENTIFIED',
    );
    expect(assess('TAX_DEBT', { resultAmount: '0.00' }, [])).toBe(
      'NOT_IDENTIFIED',
    );
  });
  it('validates dates, decimal precision and strict request fields', () => {
    expect(() => date('2026-02-30', 'birthDate')).toThrow();
    expect(() => date('2026-13-01', 'birthDate')).toThrow();
    expect(() => money('12.345', 'amount')).toThrow();
    expect(() => money(-1, 'amount')).toThrow();
    expect(() => object({ workspaceId: 'other' }, ['result'])).toThrow();
  });
  it('uses canonical request fingerprints', () => {
    expect(hash({ b: 1, a: { d: 2, c: 3 } })).toBe(
      hash({ a: { c: 3, d: 2 }, b: 1 }),
    );
    expect(hash({ resultBoolean: false })).not.toBe(hash({}));
  });
  it('does not turn ambiguous identities into established debt', () => {
    expect(assess('FSSP', {}, [{ identityMatch: 'POSSIBLE' }])).toBe(
      'NEEDS_REVIEW',
    );
    expect(assess('FSSP', {}, [{ identityMatch: 'REJECTED' }])).toBe(
      'NOT_IDENTIFIED',
    );
    expect(assess('FSSP', {}, [{ identityMatch: 'CONFIRMED' }])).toBe(
      'IDENTIFIED',
    );
    expect(() =>
      validateResult('FSSP', resultInput({ findings: [] })),
    ).toThrow();
  });
  it('requires valid categories and safe external links', () => {
    expect(() =>
      validateResult(
        'CAPACITY',
        resultInput({ resultCode: 'NO_RESULTS_FOUND' }),
      ),
    ).toThrow();
    expect(() => httpUrl('javascript:alert(1)')).toThrow();
    expect(() => httpUrl('https://user:pass@example.test')).toThrow();
  });
  it('keeps checklist codes unique and has no automatic assumptions about medical documents', () => {
    expect(new Set(CHECKS.map((c) => c.code)).size).toBe(CHECKS.length);
    expect(assess('PND_CERTIFICATE', {}, [])).toBe('NEEDS_REVIEW');
  });
  it('rejects missing, disguised or oversized files before writing', async () => {
    const store = new DocumentStorageService();
    await expect(store.save(undefined as never)).rejects.toThrow();
    await expect(
      store.save({
        originalname: 'x.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('<html>'),
        size: 6,
      }),
    ).rejects.toThrow();
    await expect(store.read('../../private')).rejects.toThrow();
  });
});
