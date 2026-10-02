import test from "node:test";
import assert from "node:assert/strict";
import { BUILDINGS, MALL_EXTERIOR, MALL_PARK, buildColliders, doorPoints } from "../worldLayout.js";

test("Canopy Park has a generous open arrival and two collidable supports", () => {
  assert.ok(MALL_PARK.portal.clearWidth >= 2.4);
  assert.equal(MALL_PARK.portal.posts.length, 2);
  const posts = buildColliders().filter((collider) => collider.label === "park-portal-post");
  assert.equal(posts.length, 2);
  assert.deepEqual(
    posts.map(({ cx, cz }) => ({ x: cx, z: cz })),
    MALL_PARK.portal.posts,
  );
});

test("the outdoor Commons promises a real multi-storey mall", () => {
  assert.ok(MALL_EXTERIOR.height >= 9);
  assert.ok(MALL_EXTERIOR.width >= 28);
  const shell = buildColliders().find((collider) => collider.label === "building-wall"
    && collider.minZ === MALL_EXTERIOR.center.z - MALL_EXTERIOR.depth / 2);
  assert.ok(shell);
});

test("the park lobby triggers only after crossing its real doorway", () => {
  const lobby = BUILDINGS.find((building) => building.id === "commons-park-lobby");
  assert.ok(lobby);
  const { doorPoint, approachPoint } = doorPoints(lobby);
  assert.ok(approachPoint.z > doorPoint.z, "entry trigger should sit inside the south-facing doorway");
  assert.ok(lobby.returnPoint.z < doorPoint.z, "exit should return to the park side of the doorway");
  const blockedAtDoorCenter = buildColliders().some((collider) => collider.kind !== "walkable"
    && collider.kind !== "circle"
    && doorPoint.x >= collider.minX && doorPoint.x <= collider.maxX
    && doorPoint.z >= collider.minZ && doorPoint.z <= collider.maxZ);
  assert.equal(blockedAtDoorCenter, false);
});

test("every discovery remains inside the park while clearing the hero", () => {
  for (const discovery of MALL_PARK.discoveries) {
    const fromCenter = Math.hypot(discovery.x - MALL_PARK.center.x, discovery.z - MALL_PARK.center.z);
    const fromHero = Math.hypot(discovery.x - MALL_PARK.hero.x, discovery.z - MALL_PARK.hero.z);
    assert.ok(fromCenter < MALL_PARK.radius);
    assert.ok(fromHero > MALL_PARK.hero.radius + 1.5);
  }
});
