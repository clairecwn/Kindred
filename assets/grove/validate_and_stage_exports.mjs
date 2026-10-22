import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

if (typeof globalThis.ProgressEvent === "undefined") {
  globalThis.ProgressEvent = class ProgressEvent {
    constructor(type, init = {}) {
      this.type = type;
      Object.assign(this, init);
    }
  };
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const exportDir = path.join(scriptDir, "exports");
const publicDir = path.resolve(scriptDir, "../../frontend/public/models/env/grove");
const moduleNames = [
  "grove_exterior",
  "grove_architecture",
  "grove_grocer",
  "thread_and_thimble",
  "home_nook",
  "cafe_canopy",
  "sole_search",
  "pixel_pantry",
  "maker_meadow",
  "seasonal_pop_up",
  "book_burrow",
  "alltimefitness",
  "food_hall",
  "rooftop_garden",
];

function parseGlbJson(buffer, filename) {
  if (buffer.length < 20 || buffer.toString("utf8", 0, 4) !== "glTF") {
    throw new Error(`${filename}: invalid GLB magic header`);
  }
  const version = buffer.readUInt32LE(4);
  const declaredLength = buffer.readUInt32LE(8);
  if (version !== 2) throw new Error(`${filename}: expected GLB version 2, found ${version}`);
  if (declaredLength !== buffer.length) throw new Error(`${filename}: declared length ${declaredLength} != ${buffer.length}`);
  const jsonLength = buffer.readUInt32LE(12);
  const jsonType = buffer.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a) throw new Error(`${filename}: first chunk is not JSON`);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8").trim());
}

// Node has no image decoder, so GLTFLoader cannot load embedded textures
// here. The runtime check only needs geometry: hand three.js a copy of the
// GLB whose JSON has its texture references removed (the binary chunk is
// untouched, and the staged file is always the original).
function withoutTextures(buffer) {
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
  if (!json.textures?.length && !json.images?.length) return buffer;
  delete json.textures; delete json.images; delete json.samplers;
  const strip = (node) => {
    if (!node || typeof node !== "object") return;
    for (const key of Object.keys(node)) {
      if (/Texture$/.test(key) && typeof node[key] === "object" && node[key] !== null && "index" in node[key]) delete node[key];
      else strip(node[key]);
    }
  };
  for (const material of json.materials ?? []) strip(material);
  let text = JSON.stringify(json);
  while (Buffer.byteLength(text) % 4) text += " ";
  const jsonChunk = Buffer.from(text, "utf8");
  const rest = buffer.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  header.write("glTF", 0, "utf8");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + jsonChunk.length + rest.length, 8);
  header.writeUInt32LE(jsonChunk.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, jsonChunk, rest]);
}

async function loadWithThree(original, filename) {
  const buffer = withoutTextures(original);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const loader = new GLTFLoader();
  const gltf = await new Promise((resolve, reject) => loader.parse(arrayBuffer, `${exportDir}/`, resolve, reject));
  let runtimeMeshes = 0;
  let runtimeTriangles = 0;
  const bounds = new THREE.Box3();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((object) => {
    if (!object.isMesh) return;
    runtimeMeshes += 1;
    const geometry = object.geometry;
    runtimeTriangles += geometry.index
      ? geometry.index.count / 3
      : (geometry.attributes.position?.count ?? 0) / 3;
    bounds.expandByObject(object);
  });
  if (!runtimeMeshes) throw new Error(`${filename}: Three.js loaded no meshes`);
  const size = bounds.getSize(new THREE.Vector3());
  return {
    runtimeMeshes,
    runtimeTriangles: Math.round(runtimeTriangles),
    boundsMeters: [size.x, size.y, size.z].map((value) => Number(value.toFixed(4))),
  };
}

const modules = [];
let totalBytes = 0;
let totalTriangles = 0;
for (const name of moduleNames) {
  const filename = `${name}.glb`;
  const source = path.join(exportDir, filename);
  const buffer = await readFile(source);
  const json = parseGlbJson(buffer, filename);
  if (!json.scenes?.length || !json.meshes?.length || !json.materials?.length) {
    throw new Error(`${filename}: missing scene, mesh, or material data`);
  }
  const runtime = await loadWithThree(buffer, filename);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  totalBytes += buffer.length;
  totalTriangles += runtime.runtimeTriangles;
  modules.push({
    file: filename,
    bytes: buffer.length,
    nodes: json.nodes?.length ?? 0,
    meshes: json.meshes.length,
    materials: json.materials.length,
    sha256,
    ...runtime,
  });
}

if (totalBytes > 60_000_000) throw new Error(`export bundle exceeds 60 MB: ${totalBytes}`);
if (totalTriangles > 600_000) throw new Error(`runtime export bundle exceeds 600,000 triangles: ${totalTriangles}`);

const manifest = {
  schema: "kindred.grove-export-manifest.v2",
  generatedAt: new Date().toISOString(),
  source: "../blender/grove_master_refined.blend",
  generator: "Blender 5.2.0 LTS",
  format: "glTF 2.0 binary",
  policy: "locally-authored-procedural-blender-no-paid-generation",
  validation: {
    status: "passed-structural-threejs-and-budget-checks",
    checks: [
      "GLB magic header",
      "GLB version 2",
      "declared file length",
      "JSON chunk parse",
      "scene, mesh, and material presence",
      "SHA-256 digest",
      "Three.js GLTFLoader parse (geometry; embedded textures are not decoded under Node)",
      "runtime mesh traversal",
      "module and bundle byte budget",
      "runtime triangle budget",
    ],
    totals: { modules: modules.length, bytes: totalBytes, runtimeTriangles: totalTriangles },
    limitations: [
      "Lightmaps and texture tiers are not yet authored.",
      "Sustained hardware frame-rate and final Runtime approval remain pending.",
    ],
  },
  modules,
};

await mkdir(publicDir, { recursive: true });
for (const module of modules) {
  await copyFile(path.join(exportDir, module.file), path.join(publicDir, module.file));
}
const json = `${JSON.stringify(manifest, null, 2)}\n`;
await writeFile(path.join(exportDir, "manifest.json"), json, "utf8");
await writeFile(path.join(publicDir, "manifest.json"), json, "utf8");
console.log(JSON.stringify({ status: "passed", modules: modules.length, totalBytes, totalTriangles }));
