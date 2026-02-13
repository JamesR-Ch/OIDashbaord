import assert from "node:assert/strict";
import { buildTopPositiveStrikeChanges } from "../services/cme-change.js";

function run() {
  const prev = [
    { strike: 5000, put: 100, call: 120 },
    { strike: 5050, put: 80, call: 90 },
    { strike: 5100, put: 40, call: 20 },
    { strike: 5150, put: 60, call: 70 }
  ];
  const cur = [
    { strike: 5000, put: 140, call: 180 },
    { strike: 5050, put: 70, call: 95 },
    { strike: 5100, put: 20, call: 15 },
    { strike: 5150, put: 61, call: 80 }
  ];

  const top = buildTopPositiveStrikeChanges(prev, cur, 3);

  assert.equal(top.length, 2, "only positive total change strikes should remain");
  assert.equal(top[0].strike, 5000, "largest positive total change should rank #1");
  assert.equal(top[0].total_change, 100);
  assert.equal(top[1].strike, 5150);
  assert.equal(top[1].total_change, 11);

  const none = buildTopPositiveStrikeChanges(
    [{ strike: 5000, put: 10, call: 10 }],
    [{ strike: 5000, put: 9, call: 10 }],
    3
  );
  assert.equal(none.length, 0, "no positive change should return empty list");

  console.log("cme-change tests passed");
}

run();
