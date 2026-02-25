/**
 * Splitwise-style utility functions.
 * All pure JS — no external dependencies.
 */

/**
 * Given a spending log and a list of travelers, compute each person's net balance.
 * Positive = they are owed money. Negative = they owe money.
 *
 * @param {Array} spendingLog - array of spending entries
 * @param {Array} travelers   - array of { id, name } objects
 * @returns {{ [id]: number }} net balance per traveler
 */
export function calculateBalances(spendingLog, travelers) {
    const balances = {}
    travelers.forEach(t => { balances[t.id] = 0 })

    for (const entry of spendingLog) {
        const { paidBy, splits } = entry
        if (!paidBy || !splits) continue

        for (const [id, share] of Object.entries(splits)) {
            if (id === paidBy) continue // payer's own share — zero net

            // Always apply both sides. If an ID isn't in the travelers list yet,
            // initialize it so we don't silently drop credits/debits.
            if (!(paidBy in balances)) balances[paidBy] = 0
            if (!(id in balances)) balances[id] = 0

            balances[paidBy] += share  // payer is owed
            balances[id] -= share  // member owes
        }
    }

    return balances
}


/**
 * Minimum Cash Flow algorithm — reduces a set of balances into the fewest
 * possible transactions to settle all debts.
 *
 * If A owes B ₱50 and B owes C ₱50, this simplifies to: A owes C ₱50.
 *
 * @param {{ [id]: number }} balances - net balance per person
 * @returns {Array<{ from: string, to: string, amount: number }>}
 */
export function simplifyDebts(balances) {
    const transactions = []

    // Work with mutable copies, rounding to 2 decimal places to avoid float issues
    const bal = {}
    for (const [id, v] of Object.entries(balances)) {
        bal[id] = Math.round(v * 100) / 100
    }

    const getMax = () => Object.entries(bal).reduce((a, b) => b[1] > a[1] ? b : a)
    const getMin = () => Object.entries(bal).reduce((a, b) => b[1] < a[1] ? b : a)

    const total = Object.values(bal).reduce((s, v) => s + Math.abs(v), 0)
    if (total < 0.01) return []

    let iterations = 0
    while (iterations++ < 1000) {
        const [creditorId, credit] = getMax()
        const [debtorId, debt] = getMin()

        if (credit < 0.01 || debt > -0.01) break // all settled

        const amount = Math.min(credit, -debt)
        const rounded = Math.round(amount * 100) / 100

        if (rounded < 0.01) break

        transactions.push({ from: debtorId, to: creditorId, amount: rounded })

        bal[creditorId] = Math.round((bal[creditorId] - rounded) * 100) / 100
        bal[debtorId] = Math.round((bal[debtorId] + rounded) * 100) / 100
    }

    return transactions
}

/**
 * Build the splits map for an expense given a mode.
 *
 * @param {number}   total         - total expense amount
 * @param {string[]} memberIds     - traveler IDs splitting this expense
 * @param {string}   mode          - 'equal' | 'amount' | 'percent'
 * @param {object}   customValues  - { [id]: number } for amount/percent modes
 * @returns {{ [id]: number }} amount each person owes of this expense
 */
export function buildSplits(total, memberIds, mode, customValues = {}) {
    if (!memberIds.length) return {}

    if (mode === 'equal') {
        const share = Math.round((total / memberIds.length) * 100) / 100
        const splits = {}
        let remaining = total
        memberIds.forEach((id, i) => {
            if (i === memberIds.length - 1) {
                // Last person absorbs rounding difference
                splits[id] = Math.round(remaining * 100) / 100
            } else {
                splits[id] = share
                remaining = Math.round((remaining - share) * 100) / 100
            }
        })
        return splits
    }

    if (mode === 'percent') {
        const splits = {}
        memberIds.forEach(id => {
            const pct = Number(customValues[id] || 0) / 100
            splits[id] = Math.round(total * pct * 100) / 100
        })
        return splits
    }

    // 'amount' mode — custom amounts provided directly
    if (mode === 'amount') {
        const splits = {}
        memberIds.forEach(id => {
            splits[id] = Math.round((Number(customValues[id] || 0)) * 100) / 100
        })
        return splits
    }

    return {}
}
