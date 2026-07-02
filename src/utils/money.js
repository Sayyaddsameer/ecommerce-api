// All financial math happens in integer cents to avoid floating-point
// rounding errors (e.g. 0.1 + 0.2 !== 0.3). Postgres NUMERIC columns are
// read back by `pg` as strings, so we parse them explicitly here rather
// than letting them silently become JS floats.

function toCents(decimalStringOrNumber) {
  const num =
    typeof decimalStringOrNumber === 'string'
      ? parseFloat(decimalStringOrNumber)
      : decimalStringOrNumber;
  return Math.round(num * 100);
}

function centsToDecimalString(cents) {
  return (cents / 100).toFixed(2);
}

module.exports = { toCents, centsToDecimalString };
