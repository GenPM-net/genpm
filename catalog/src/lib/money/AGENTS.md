# @core/money — rules for AI agents

## Purpose
Money as `{ amount, currency }` with `amount` an integer of minor units (cents) and an ISO 4217 code, so commerce
modules never use floats. Parsing from decimal strings, safe arithmetic that refuses mixed currencies, rounding,
percentages, lossless allocation (splitting a discount across lines), charm prices (`.99`), formatting with `Intl`
and conversion with a rates table. Pure functions: no tables, no network.

## Map
- `index.ts` — public API: `money`, `parseMoney`, `add`, `sub`, `sum`, `multiply`, `percent`, `allocate`, `charmPrice`, `format`, `toDecimalString`, `convert`, `currencyDecimals`.
- `money.ts` — implementation. The `Money` type comes from @core/contracts.

## Integration
1. Nothing to configure. Store money in two columns: `amount integer` (minor units) and `currency text`.
2. User input: `parseMoney('19,99', 'EUR')` (never `Number(input) * 100`).
3. Display: `format(price, locale)`; APIs/JSON-LD: `toDecimalString(price)`.
4. Split amounts: `allocate(discount, lines.map((l) => l.subtotal.amount))`.
5. Verify: `add(money(1, 'EUR'), money(1, 'USD'))` throws.

## Conventions
- All arithmetic through these helpers; JPY has 0 decimals and KWD 3, so never assume 100.
- Percentages round half-up by default; pass `'half-even'` where your accounting requires it.
- Exchange rates are inputs (store the rate used with each order); this module does not fetch them.

## Don't
- Don't use floats for prices, totals or taxes, and don't add amounts of different currencies.
- Don't round intermediate results before the final step unless the business rule says so.
