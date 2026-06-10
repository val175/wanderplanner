import { describe, it, expect } from 'vitest'
import { calculateBalances, simplifyDebts, buildSplits } from './splitwise'

const T = (id) => ({ id, name: id })

describe('buildSplits', () => {
  it('splits equally and gives the rounding remainder to the last member', () => {
    const splits = buildSplits(100, ['a', 'b', 'c'], 'equal')
    expect(splits.a).toBe(33.33)
    expect(splits.b).toBe(33.33)
    expect(splits.c).toBe(33.34)
    expect(splits.a + splits.b + splits.c).toBeCloseTo(100, 2)
  })

  it('always sums exactly to the total in equal mode', () => {
    for (const total of [10, 99.99, 0.01, 1234.56, 7]) {
      for (const n of [1, 2, 3, 4, 5, 7]) {
        const ids = Array.from({ length: n }, (_, i) => `p${i}`)
        const sum = Object.values(buildSplits(total, ids, 'equal')).reduce((s, v) => s + v, 0)
        expect(sum).toBeCloseTo(total, 2)
      }
    }
  })

  it('computes percent mode from customValues', () => {
    const splits = buildSplits(200, ['a', 'b'], 'percent', { a: 75, b: 25 })
    expect(splits).toEqual({ a: 150, b: 50 })
  })

  it('passes through amount mode values rounded to cents', () => {
    const splits = buildSplits(200, ['a', 'b'], 'amount', { a: 120.55, b: 79.45 })
    expect(splits).toEqual({ a: 120.55, b: 79.45 })
  })

  it('returns {} for empty members or unknown mode', () => {
    expect(buildSplits(100, [], 'equal')).toEqual({})
    expect(buildSplits(100, ['a'], 'nonsense')).toEqual({})
  })
})

describe('calculateBalances', () => {
  const travelers = [T('a'), T('b'), T('c')]

  it('credits the payer and debits the others', () => {
    const log = [{ paidBy: 'a', amount: 90, splits: { a: 30, b: 30, c: 30 } }]
    const bal = calculateBalances(log, travelers)
    expect(bal).toEqual({ a: 60, b: -30, c: -30 })
  })

  it('reconstructs equal splits from splitBetween when splits map is missing', () => {
    const log = [{ paidBy: 'a', amount: 90, splitBetween: ['a', 'b', 'c'] }]
    const bal = calculateBalances(log, travelers)
    expect(bal).toEqual({ a: 60, b: -30, c: -30 })
  })

  it('skips entries with unknown payers and unknown split members', () => {
    const log = [
      { paidBy: 'ghost', amount: 100, splits: { a: 50, b: 50 } },
      { paidBy: 'a', amount: 50, splits: { b: 25, ghost: 25 } },
    ]
    const bal = calculateBalances(log, travelers)
    expect(bal).toEqual({ a: 25, b: -25, c: 0 })
  })

  it('coerces string shares to numbers', () => {
    const log = [{ paidBy: 'a', amount: 60, splits: { a: '20', b: '20', c: '20' } }]
    const bal = calculateBalances(log, travelers)
    expect(bal).toEqual({ a: 40, b: -20, c: -20 })
  })

  it('nets out to ~zero across all balances', () => {
    const log = [
      { paidBy: 'a', amount: 100, splits: { a: 33.33, b: 33.33, c: 33.34 } },
      { paidBy: 'b', amount: 45.5, splits: { a: 15.17, b: 15.17, c: 15.16 } },
      { paidBy: 'c', amount: 10, splits: { a: 5, c: 5 } },
    ]
    const bal = calculateBalances(log, travelers)
    const sum = Object.values(bal).reduce((s, v) => s + v, 0)
    expect(sum).toBeCloseTo(0, 2)
  })
})

describe('simplifyDebts', () => {
  it('settles a simple two-person debt', () => {
    expect(simplifyDebts({ a: 50, b: -50 })).toEqual([{ from: 'b', to: 'a', amount: 50 }])
  })

  it('collapses chains: A owes B, B owes C → A pays C', () => {
    // a owes 50 (to b), b is net zero-ish… chain: a -50, b 0, c +50
    const tx = simplifyDebts({ a: -50, b: 0, c: 50 })
    expect(tx).toEqual([{ from: 'a', to: 'c', amount: 50 }])
  })

  it('produces at most n-1 transactions and conserves money', () => {
    const balances = { a: 120.5, b: -30.25, c: -50.25, d: -40 }
    const tx = simplifyDebts(balances)
    expect(tx.length).toBeLessThanOrEqual(3)
    const paid = {}
    tx.forEach(({ from, to, amount }) => {
      paid[from] = (paid[from] || 0) - amount
      paid[to] = (paid[to] || 0) + amount
    })
    // After settling, each person's net cash movement equals their balance:
    // creditors receive what they're owed, debtors pay what they owe.
    Object.entries(balances).forEach(([id, bal]) => {
      expect(paid[id] || 0).toBeCloseTo(bal, 1)
    })
  })

  it('returns [] when already settled (within a cent)', () => {
    expect(simplifyDebts({ a: 0.004, b: -0.004 })).toEqual([])
    expect(simplifyDebts({})).toEqual([])
  })

  it('never loops forever on awkward floats', () => {
    const tx = simplifyDebts({ a: 0.01, b: 0.01, c: -0.02 })
    expect(Array.isArray(tx)).toBe(true)
  })
})
