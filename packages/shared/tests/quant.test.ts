import assert from "node:assert/strict";
import {
  safePctChange,
  safeAbsChange,
  pearsonCorrelation,
  olsBeta,
  zScore,
  computeRelativeStrength
} from "../src/quant";

function almostEqual(a: number | null, b: number, eps = 1e-9) {
  assert.ok(a !== null, "value should not be null");
  assert.ok(Math.abs((a as number) - b) <= eps, `expected ${b}, got ${a}`);
}

function run() {
  almostEqual(safePctChange(110, 100), 10);
  almostEqual(safeAbsChange(110, 100), 10);
  assert.equal(safePctChange(100, 0), null);

  const corr = pearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8]);
  almostEqual(corr, 1);

  const beta = olsBeta([1, 2, 3, 4], [2, 4, 6, 8]);
  almostEqual(beta, 2);

  const z = zScore(15, [10, 12, 14, 16, 18]);
  assert.ok(z !== null, "z-score should exist");
  assert.ok(Math.abs((z as number) - 0.6324555320336759) < 1e-9);

  const rs = computeRelativeStrength(1.2, 0.4, 0.5, -0.2);
  assert.ok(rs !== null, "relative strength should exist");
  assert.ok(Math.abs((rs as number) - 0.61) < 1e-9);

  console.log("quant tests passed");
}

run();
