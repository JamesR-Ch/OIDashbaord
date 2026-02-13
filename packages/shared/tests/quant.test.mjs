import assert from "node:assert/strict";
import {
  safePctChange,
  safeAbsChange,
  pearsonCorrelation,
  olsBeta,
  zScore,
  computeRelativeStrength
} from "../dist/quant.js";

function almostEqual(a, b, eps = 1e-9) {
  assert.ok(a !== null, "value should not be null");
  assert.ok(Math.abs(a - b) <= eps, `expected ${b}, got ${a}`);
}

almostEqual(safePctChange(110, 100), 10);
almostEqual(safeAbsChange(110, 100), 10);
assert.equal(safePctChange(100, 0), null);

const corr = pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8]);
almostEqual(corr, 1);

const beta = olsBeta([1, 2, 3, 4], [2, 4, 6, 8]);
almostEqual(beta, 2);

const z = zScore(15, [10, 12, 14, 16, 18]);
assert.ok(z !== null, "z-score should exist");
assert.ok(Math.abs(z - 0.31622776601683794) < 1e-9);

const rs = computeRelativeStrength(1.2, 0.4, 0.5, -0.2);
assert.ok(rs !== null, "relative strength should exist");
assert.ok(Math.abs(rs - 0.635) < 1e-9);

console.log("quant tests passed");
