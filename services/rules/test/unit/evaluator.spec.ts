import { evaluate } from '../../src/evaluator';

describe('evaluator', () => {
  it('evaluates basic all/var/==/> operations', () => {
    const rule = {
      all: [
        { '==': [{ var: 'return.reason' }, 'wrong size'] },
        { '>': [{ var: 'customer.order_count' }, 5] },
      ],
    } as any;
    const ctx = { return: { reason: 'wrong size' }, customer: { order_count: 6 } };
    expect(evaluate(rule, ctx)).toBe(true);
    const ctx2 = { return: { reason: 'wrong size' }, customer: { order_count: 1 } };
    expect(evaluate(rule, ctx2)).toBe(false);
  });

  it('guards against excessive depth', () => {
    const deep: any = {}; let cur = deep;
    for (let i = 0; i < 20; i++) { cur.all = [{}]; cur = cur.all[0]; }
    expect(() => evaluate(deep, {})).toThrow(/Max eval depth/);
  });
});

