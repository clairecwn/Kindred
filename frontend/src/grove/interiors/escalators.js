// src/grove/interiors/escalators.js
//
// Runs the Grove mall's escalators from the rig authored in Blender. The
// architecture GLB carries each escalator's steps as separate nodes named
// ESC_<pair>_<Up|Down>_Step_<nn>; their rest positions are the path (see
// escalatorMath.js). This file turns each chain into instanced meshes, moves
// the steps round the loop every frame, and hands GroveMallInterior the
// colliders and ride state it needs. A mall export without those nodes
// simply yields an empty system, so older exports keep working.

import * as THREE from "three";
import {
  ESCALATOR, buildChain, stepPosition, chainBlock, findBoarding, startRide, advanceRide,
} from "./escalatorMath.js";

const STEP_NAME = /^ESC_([A-Za-z0-9]+)_(Up|Down)_Step_(\d+)$/;

export function createEscalatorSystem(root, { floorHeight = ESCALATOR.floorHeight } = {}) {
  const config = { ...ESCALATOR, floorHeight };
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const found = new Map();
  root.traverse((obj) => {
    const match = STEP_NAME.exec(obj.name ?? "");
    if (!match) return;
    const key = `${match[1]}:${match[2].toLowerCase()}`;
    if (!found.has(key)) found.set(key, []);
    found.get(key).push({ index: Number(match[3]), node: obj, rest: new THREE.Matrix4().multiplyMatrices(toRoot, obj.matrixWorld) });
  });

  const chains = [];
  const rigs = [];
  for (const [key, steps] of found) {
    steps.sort((a, b) => a.index - b.index);
    const [id, direction] = key.split(":");
    const points = steps.map((step) => new THREE.Vector3().setFromMatrixPosition(step.rest));
    let chain;
    try {
      chain = buildChain({ id: `${id}-${direction}`, direction, points: points.map((p) => ({ x: p.x, y: p.y, z: p.z })) }, config);
    } catch (error) {
      console.warn("[grove] escalator rig skipped", error);
      continue;
    }
    // One step node may hold several meshes (tread and nose strips are two
    // materials), so every mesh under the first step becomes an InstancedMesh.
    const template = steps[0];
    const templateInverse = template.node.matrixWorld.clone().invert();
    const parts = [];
    template.node.traverse((obj) => {
      if (!obj.isMesh) return;
      const instanced = new THREE.InstancedMesh(obj.geometry, obj.material, steps.length);
      instanced.name = `escalator:${chain.id}:${obj.name}`;
      instanced.frustumCulled = false; // the chain spans a storey; culling per instance is not worth it
      instanced.castShadow = false;
      instanced.receiveShadow = false;
      root.add(instanced);
      parts.push({ instanced, local: new THREE.Matrix4().multiplyMatrices(templateInverse, obj.matrixWorld) });
    });
    // Rotation and scale of a step never change; only its position does.
    const basis = template.rest.clone().setPosition(0, 0, 0);
    for (const step of steps) step.node.visible = false;
    chains.push(chain);
    rigs.push({ chain, parts, basis });
  }

  let time = 0;
  const matrix = new THREE.Matrix4();
  const stepMatrix = new THREE.Matrix4();

  function place() {
    for (const { chain, parts, basis } of rigs) {
      for (let i = 0; i < chain.n; i++) {
        const p = stepPosition(chain, i, time, config);
        stepMatrix.copy(basis).setPosition(p.x, p.y, p.z);
        for (const part of parts) {
          matrix.multiplyMatrices(stepMatrix, part.local);
          part.instanced.setMatrixAt(i, matrix);
        }
      }
      for (const part of parts) part.instanced.instanceMatrix.needsUpdate = true;
    }
  }
  place();

  return {
    chains,
    get time() { return time; },
    update(dt) {
      if (!rigs.length) return;
      time += dt;
      place();
    },
    colliders(floor) {
      return chains.map((chain) => chainBlock(chain, floor, config)).filter(Boolean);
    },
    findBoarding(player, floor) {
      return findBoarding(chains, player, floor, config);
    },
    startRide,
    advanceRide(ride, dt) {
      return advanceRide(ride, dt, time, config);
    },
    dispose() {
      for (const { parts } of rigs) for (const part of parts) part.instanced.removeFromParent();
    },
  };
}
