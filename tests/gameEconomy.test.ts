import assert from 'node:assert/strict';
import {
  CREATURES,
  getCreatureEffectiveIncome,
  getCreatureSellValue,
  MUTATION_META,
  RARITY_META,
  rollCreature,
  rollMutation,
} from '../src/shared/creatures.ts';
import {
  BASE_PLOTS,
  getConveyorWorldPosition,
  getRebirthRequirement,
  getUpgradeCost,
  UPGRADE_CATALOG,
} from '../src/shared/worldConfig.ts';

function runTests() {
  // 1. Roster completeness: >= 30 unique original Memelings across all 8 rarities
  assert.ok(CREATURES.length >= 30, `Expected at least 30 Memelings, found ${CREATURES.length}`);
  const uniqueIds = new Set(CREATURES.map((c) => c.id));
  assert.equal(uniqueIds.size, CREATURES.length, 'Creature IDs must be unique');

  for (const rarity of Object.keys(RARITY_META)) {
    const count = CREATURES.filter((c) => c.rarity === rarity).length;
    assert.ok(count >= 3, `Expected at least 3 creatures for rarity ${rarity}, got ${count}`);
  }

  // 2. Mutation & level scaling economy math
  const baseInc = getCreatureEffectiveIncome('bloop-cat', 'normal', 1);
  const goldenInc = getCreatureEffectiveIncome('bloop-cat', 'golden', 1);
  const fusedInc = getCreatureEffectiveIncome('bloop-cat', 'normal', 2);
  assert.ok(goldenInc > baseInc, 'Golden mutation must increase passive income');
  assert.ok(fusedInc > baseInc, 'Leveling via fusion must increase passive income');
  assert.equal(
    goldenInc,
    Math.round(baseInc * MUTATION_META.golden.multiplier),
    'Golden multiplier must match definition',
  );

  const sellVal = getCreatureSellValue('bloop-cat', 'normal', 1);
  assert.ok(sellVal > 0 && sellVal < CREATURES[0].price, 'Sell value must be positive and below buy price');

  // 3. World plots & conveyor coordinates
  assert.equal(BASE_PLOTS.length, 8, 'World should provide 8 personal base plots');
  for (const plot of BASE_PLOTS) {
    assert.equal(plot.pedestals.length, 12, 'Each base plot should support up to 12 pedestals');
  }

  const startPos = getConveyorWorldPosition(0, 0);
  const endPos = getConveyorWorldPosition(0, 1);
  assert.ok(endPos.z > startPos.z, 'Conveyor should advance along +Z');

  // 4. Upgrades & Rebirth monotonic progression
  for (const up of UPGRADE_CATALOG) {
    const c0 = getUpgradeCost(up.key, 0);
    const c1 = getUpgradeCost(up.key, 1);
    assert.ok(c1 > c0, `Upgrade ${up.key} cost should scale upward`);
  }

  const r0 = getRebirthRequirement(0);
  const r1 = getRebirthRequirement(1);
  assert.ok(r1.coinCost > r0.coinCost && r1.nextMultiplier > r0.nextMultiplier, 'Rebirth tiers must scale');

  // 5. RNG rolls always return valid entities
  for (let i = 0; i < 50; i++) {
    const c = rollCreature(2);
    const m = rollMutation(2);
    assert.ok(c && c.id, 'rollCreature must return valid creature');
    assert.ok(MUTATION_META[m], 'rollMutation must return valid mutation');
  }

  console.log(`ALL ECONOMY & WORLD TESTS PASSED (${CREATURES.length} Memelings verified)`);
}

runTests();
