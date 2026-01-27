import { NodeIO } from '@gltf-transform/core';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
import {
  dedup,
  prune,
  flatten,
  weld,
  simplify,
  reorder,
  quantize,
  textureCompress,
  draco,
} from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import type { Document, Transform } from '@gltf-transform/core';

// File mapping configuration for robot parts (GLB files)
interface GLBFileConfig {
  input: string;
  output: string;
  transparencyRule: 'none' | 'all' | 'corps';
  scale: number;
}

const ROBOT_PARTS: GLBFileConfig[] = [
  { input: 'Batterie.glb', output: 'battery_full.glb', transparencyRule: 'corps', scale: 0.85 },
  { input: 'Batterie low.glb', output: 'battery_low.glb', transparencyRule: 'corps', scale: 0.85 },
  { input: 'Chassis.glb', output: 'chassis.glb', transparencyRule: 'none', scale: 0.85 },
  { input: 'Chassis 1.glb', output: 'chassis_broken.glb', transparencyRule: 'none', scale: 0.85 },
  { input: 'Écran réparé.glb', output: 'screen_repaired.glb', transparencyRule: 'all', scale: 0.85 },
  { input: 'Écran cassé.glb', output: 'screen_broken.glb', transparencyRule: 'all', scale: 0.85 },
];

const ROBOT_INPUT_DIR = path.resolve(import.meta.dirname, '../temp/hd');
const OUTPUT_DIR = path.resolve(import.meta.dirname, '../public/models');

// Apply scale to root nodes
function applyScale(scaleFactor: number): Transform {
  return (document: Document) => {
    const root = document.getRoot();
    for (const scene of root.listScenes()) {
      for (const node of scene.listChildren()) {
        const currentScale = node.getScale();
        node.setScale([
          currentScale[0] * scaleFactor,
          currentScale[1] * scaleFactor,
          currentScale[2] * scaleFactor,
        ]);
      }
    }
  };
}

// Apply transparency based on rule
function applyTransparency(rule: 'none' | 'all' | 'corps'): Transform {
  return (document: Document) => {
    if (rule === 'none') return;

    const root = document.getRoot();
    const processedMaterials = new Set<string>();

    for (const node of root.listNodes()) {
      const mesh = node.getMesh();
      if (!mesh) continue;

      const meshName = mesh.getName()?.toLowerCase() || '';
      const nodeName = node.getName()?.toLowerCase() || '';

      let shouldApply = false;
      if (rule === 'all') {
        shouldApply = true;
      } else if (rule === 'corps') {
        shouldApply = meshName.includes('corps') || nodeName.includes('corps');
      }

      if (shouldApply) {
        for (const primitive of mesh.listPrimitives()) {
          let material = primitive.getMaterial();
          if (material) {
            const materialName = material.getName() || 'unnamed';
            const parents = material.listParents();
            if (parents.length > 2 && !processedMaterials.has(materialName)) {
              material = material.clone();
              primitive.setMaterial(material);
            }
            material.setAlpha(0.5);
            material.setAlphaMode('BLEND');
            processedMaterials.add(materialName);
          }
        }
      }
    }
  };
}

async function main() {
  console.log('Initializing optimizers...');

  // Initialize MeshoptSimplifier and Encoder
  await MeshoptSimplifier.ready;
  await MeshoptEncoder.ready;

  // Initialize Draco encoder
  const dracoEncoder = await draco3d.createEncoderModule();
  const dracoDecoder = await draco3d.createDecoderModule();

  // Create IO with extensions
  const io = new NodeIO()
    .registerExtensions([KHRDracoMeshCompression])
    .registerDependencies({
      'draco3d.encoder': dracoEncoder,
      'draco3d.decoder': dracoDecoder,
    });

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Process robot parts (GLB files)
  console.log(`\n🤖 Processing ${ROBOT_PARTS.length} robot parts...\n`);

  for (const file of ROBOT_PARTS) {
    const inputPath = path.join(ROBOT_INPUT_DIR, file.input);
    const outputPath = path.join(OUTPUT_DIR, file.output);

    if (!fs.existsSync(inputPath)) {
      console.warn(`⚠️  Skipping ${file.input} - file not found`);
      continue;
    }

    const inputStats = fs.statSync(inputPath);
    console.log(`📦 Processing ${file.input} (${(inputStats.size / 1024 / 1024).toFixed(2)} MB)...`);

    try {
      const document = await io.read(inputPath);

      await document.transform(
        dedup(),
        prune(),
        flatten(),
        weld({ tolerance: 0.0001 }),
        simplify({
          simplifier: MeshoptSimplifier,
          ratio: 0.10,
          error: 0.001,
        }),
        reorder({ encoder: MeshoptEncoder }),
        quantize(),
        textureCompress({
          targetFormat: 'webp',
          encoder: sharp,
        }),
        draco({ method: 'edgebreaker' }),
        applyScale(file.scale),
        applyTransparency(file.transparencyRule),
      );

      await io.write(outputPath, document);

      const outputStats = fs.statSync(outputPath);
      const reduction = ((1 - outputStats.size / inputStats.size) * 100).toFixed(1);

      console.log(`   ✅ Saved to ${file.output} (${(outputStats.size / 1024 / 1024).toFixed(2)} MB, -${reduction}%)`);
      console.log(`   📝 Transparency: ${file.transparencyRule}, Scale: ${file.scale}`);
      console.log('');
    } catch (error) {
      console.error(`   ❌ Error processing ${file.input}:`, error);
    }
  }

  console.log('🎉 Done!');
}

main().catch(console.error);
