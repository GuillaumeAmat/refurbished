# Performance Analysis — Refurbished!

**Date:** 2026-03-22
**Environment:** Intel Iris Xe (Mesa, OpenGL ES 3.2), Chromium, canvas ~1350x940, pixelRatio 1

## 1. Frame Performance (HIGH)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Draw calls/frame | **1122** | **630** | **-44%** |
| Render passes/frame | 21 | 19 | -10% |
| Triangles/frame | 64,675 | 43,487 | -33% |
| P95 frame time | **31.8ms** | **28.4ms** | -11% |
| P99 frame time | **41ms** | **33.1ms** | -19% |
| Max frame time | 44.2ms | 34.7ms | -21% |
| Long frames (>33ms) | 7 / 180 | 2 / 180 | **-71%** |

**Root cause:** Scene (~280 meshes) rendered **4× per frame**: 2 shadow maps + bloom pass + final pass + 11 post-process blur iterations.

**Fixes applied:**
- Shadow-casting lights 2 → 1 (`Environment.ts`)
- Shadow map 1024² → 512² (`Environment.ts`)
- Merged wall body meshes by material via `mergeGeometries` (`LevelBuilder.ts`)
- Stored tick listener refs in `Stage.ts` for proper individual removal

## 2. Memory — Session Lifecycle (MEDIUM)

Heap across 3 play→quit cycles (back at menu):

| State | Before | After |
|-------|--------|-------|
| Fresh load | 56 MB | 60 MB |
| After session 1 | 60 MB | 66 MB |
| After session 2 | 68 MB | 65 MB |
| After session 3 | 70 MB | 64 MB (GC min) |

Before: monotonic growth (+14MB over 3 cycles). After: stable GC sawtooth (64-75MB), no monotonic growth.

**Fixes applied:**
- Physics world reused instead of dispose/reinit — avoids WASM linear memory growth (`Physics.ts`)
- `LevelScreen.dispose()` now cleans up Level + HUDRegionManager (`LevelScreen.ts`)
- `Resources.dispose()` added for full Stage teardown (`Resources.ts`)

## 3. Files Changed

| File | Change |
|------|--------|
| `game/world/Environment.ts` | 1 shadow light, 512² map |
| `game/world/LevelBuilder.ts` | `mergeWallBodies()` — merge wall meshes by material |
| `game/Stage.ts` | Store tick listener refs, explicit removal in dispose, Physics.destroy() on teardown |
| `game/screen/LevelScreen.ts` | Dispose level + HUD on teardown |
| `game/util/Physics.ts` | `dispose()` = soft reset (reuse world), `destroy()` = full WASM teardown |
| `game/util/Resources.ts` | Added `dispose()` for textures/GLTF cleanup |

## 4. What's Working Well

- Bloom at 50% resolution
- InstancedMesh for workbenches
- Object pooling for particles (80 max)
- Canvas texture DPR cap at 2
- Fixed timestep physics with spiral-of-death protection
- Layer-based selective bloom
- Lazy screen initialization
- Proper dispose chain Stage → subsystems
- INP: 64ms, CLS: 0, Accessibility: 100, Best Practices: 100
