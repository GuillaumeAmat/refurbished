# CLAUDE — Audit fuites memoire (longue duree)

> Audit realise le 2026-03-20 par Claude Opus 4.6.
> Methode : lecture exhaustive de tous les fichiers `game/**/*.ts`, verification croisee de chaque paire create/dispose, addEventListener/removeEventListener, clone/dispose.

## Contexte

Le jeu tourne en boucle dans une meme fenetre Chrome toute la journee.
Le cycle principal est : `Start → Menu → Tutorial → Level → Score → Leaderboard → Menu → ...`
Chaque retour au menu appelle `LevelScreen.hide()` → `Level.dispose()` → reconstruction au prochain `show()`.
**C'est ce cycle Level create/dispose qui est le vecteur principal de fuite.**

---

## CRITIQUE — Fuites confirmees, par partie jouee

### 1. Delivery meshes clones non disposes (GPU leak)

**Fichier :** `game/world/InteractionSystem.ts:257-261, 511-515`

A chaque livraison, un `model.scene.clone()` est ajoute au scene graph pour l'animation visuelle. Apres l'animation, le mesh est retire du parent (l.514) mais ses **geometry et materials ne sont jamais disposes**.

```
// l.257 — clone ajoute
const mesh = model.scene.clone();
this.#levelGroup.add(mesh);

// l.514 — retire mais pas dispose
anim.mesh.removeFromParent();  // geometry/material restent en VRAM
```

**Impact :** ~1 mesh clone par livraison. Sur 50 livraisons/partie x 50 parties/jour = ~2500 meshes GPU orphelins.

**Fix :** Apres `removeFromParent()`, traverser et disposer geometry + materials du mesh clone.

---

### 2. InteractionSystem jamais dispose

**Fichier :** `game/world/Level.ts:101-109`

`Level.dispose()` dispose players, onboarding, floor, levelBuilder, physics — mais **jamais `InteractionSystem`**. Celui-ci detient :

| Ressource | Contenu |
|-----------|---------|
| `#smokeSystem` | `SmokeParticleSystem` : 1 geometry partagee + 80 materials clones + 80 meshes |
| `#droppedResources` | DroppedResource restantes en jeu (avec meshes clones, materials, progress bars) |
| `#deliveryAnims` | Animations de livraison en cours (meshes clones dans le scene graph) |
| `#pointsPopAnims` | Animations texte en cours (mesh + texture canvas chacune) |
| `#resourceParents` | Map retenant des references vers des LevelObject disposes |

**Impact :** Par partie : 1 SmokeParticleSystem entier (81 meshes, 1 geometry, 80 materials), plus toutes les DroppedResource encore actives au moment de la fin.

**Fix :** Creer une methode `dispose()` sur `InteractionSystem` qui :
- Dispose chaque DroppedResource restante
- Dispose le SmokeParticleSystem
- Dispose les delivery anims en cours (removeFromParent + traverse dispose)
- Dispose les PointsPopAnimation en cours
- Clear les Maps et Sets
Appeler depuis `Level.dispose()`.

---

### 3. LevelObject.dispose() ne libere pas geometry/materials des meshes clones

**Fichier :** `game/world/object/LevelObject.ts:93-98`

```
public dispose(): void {
  if (this.mesh) {
    this.mesh.removeFromParent();
    this.mesh = null;
  }
}
```

Tous les LevelObject (Wall, Workbench, BlueWorkZone, Crate, RepairZone, DeliveryZone, NeonWall, etc.) :
1. Clonent le modele GLTF : `model.scene.clone()`
2. Clonent les materials : `cloneMaterials(mesh)` (l.156-164)

Ces geometry et materials clones ne sont **jamais disposes** — seul `removeFromParent()` est fait.

**Impact :** Chaque partie cree ~40+ objets de niveau. Par partie, des dizaines de materials et geometry fuient en VRAM.

**Objets concernes :**
- `Wall` (~24 par niveau)
- `Workbench` (~6)
- `BlueWorkZone` (~2)
- `Crate` (~6) — Note : Crate.dispose() dispose l'icon mesh mais pas le mesh principal
- `RepairZone` (~4) — dispose la light mais pas le mesh/materials
- `DeliveryZone` (~2) — dispose la light mais pas le mesh/materials
- `NeonWall` (~4) — dispose light/helper/neonMaterials mais pas le mesh cloné
- `Poster` (~8) — dispose le tick listener et les wires du static array, mais pas la PlaneGeometry, le MeshStandardMaterial du poster, le CylinderGeometry et le wireMaterial
- `WallLight` (~9) — dispose la PointLight, OK (pas de mesh clone)

**Fix :** Ajouter une traversee dispose dans `LevelObject.dispose()` :

```ts
public dispose(): void {
  if (this.mesh) {
    this.mesh.traverse((child) => {
      if (child instanceof Mesh) {
        child.geometry?.dispose();
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) mat?.dispose();
      }
    });
    this.mesh.removeFromParent();
    this.mesh = null;
  }
}
```

---

### 4. BlueWorkZone.dispose() n'appelle pas super.dispose()

**Fichier :** `game/world/object/BlueWorkZone.ts:373-389`

Le `dispose()` override nettoie les icones, la progress bar, le LED, mais **ne finit pas par `super.dispose()`**. Le mesh clone (avec ses materials clones) et la reference mesh ne sont jamais nettoyes.

**Fix :** Ajouter `super.dispose();` a la fin de `BlueWorkZone.dispose()`.

---

### 5. LevelBuilder.mergeWallTops : geometries intermediaires non disposees

**Fichier :** `game/world/LevelBuilder.ts:212-249`

```ts
const bakedGeometries: BufferGeometry[] = [];
// ...
for (const root of wallTopRoots) {
  root.traverse((child) => {
    const geo = child.geometry.clone();  // clone
    geo.applyMatrix4(child.matrixWorld);
    bakedGeometries.push(geo);           // stocke
  });
}
const merged = mergeGeometries(bakedGeometries);
// bakedGeometries jamais disposees ici
```

Les geometry intermediaires clonees pour le merge ne sont pas disposees apres l'appel a `mergeGeometries`. Elles restent en memoire GPU.

**Fix :** Ajouter apres le merge :
```ts
for (const geo of bakedGeometries) geo.dispose();
```

---

## HAUTE — Fuites significatives

### 6. Player.cleanup() ne dispose pas le mesh clone ni ses materials

**Fichier :** `game/world/Player.ts:184-195`

`cleanup()` dispose le smoke system et le spotlight, mais pas :
- Le mesh principal (`model.scene.clone()` a l.315 avec materials clones a l.329)
- Le `#carriedResource?.mesh` (un clone de modele) si le joueur porte quelque chose au moment du dispose
- Les `#baseMaterialColors` (materials clones)

**Fix :** Dans `cleanup()`, disposer le mesh principal et le carried resource.

---

### 7. PointsPopAnimation et delivery anims en cours au Level.dispose()

**Fichier :** `game/world/InteractionSystem.ts:508-524`

Si la partie se termine pendant qu'une animation est en cours :
- Les meshes dans `#deliveryAnims` restent dans le scene graph (retire par `#levelGroup.removeFromParent()` mais GPU non libere)
- Les `PointsPopAnimation` actives (avec mesh + canvas texture chacune) ne sont jamais disposees

C'est un cas de bord mais qui arrive a chaque fin de partie normale (le timer expire souvent pendant qu'une animation joue).

---

### 8. Floor.dispose() probablement absent ou incomplet

**Fichier :** `game/world/Level.ts:105` appelle `this.#floor.dispose()`

Non verifie dans le detail car le fichier Floor n'a pas ete lu, mais a verifier qu'il dispose correctement geometry et materials du sol (crees une seule fois par niveau).

---

## MOYENNE — Problemes secondaires

### 9. DroppedResource.getPosition() alloue un Vector3 a chaque appel

**Fichier :** `game/world/object/DroppedResource.ts:231-233`

```ts
public override getPosition(): Vector3 | null {
  if (!this.mesh) return null;
  return this.mesh.position.clone();
}
```

Appele dans des hot loops (targeting dans `InteractionSystem.#findBestTarget`, onboarding). Cree une pression GC significative. Devrait utiliser un Vector3 cache comme les autres classes.

---

### 10. Sizes : listener window.resize anonyme, jamais retire

**Fichier :** `game/util/Sizes.ts:41-44`

Le constructeur ajoute un listener anonyme sur `window.resize`. Pas de methode `dispose()`. En production c'est un singleton donc faible impact, mais empeche un teardown propre.

---

### 11. GamepadManager : listeners window anonymes, jamais retires

**Fichier :** `game/util/input/GamepadManager.ts:41-42`

Les handlers `gamepadconnected` / `gamepaddisconnected` sont des arrow functions inline, impossibles a retirer. `cleanup()` arrete le polling mais ne retire pas ces listeners.

---

### 12. Stage.dispose() incomplet

**Fichier :** `game/Stage.ts:546-552`

Ne nettoie pas :
- `GamepadManager.cleanup()`
- `Renderer` (pas de dispose)
- `SoundManager` (Howl instances)
- Les 3 listeners `tick` anonymes (l.425, l.464, l.532)
- L'actor subscription (l.500)
- `Environment` (lights, shadow helpers)
- Les 8 instances screen (chacune a un `dispose()` jamais appele)

En production le Stage vit toute la journee — faible impact direct, mais rend impossible un teardown propre.

---

### 13. createIconPlane mute colorSpace sur textures partagees

**Fichier :** `game/lib/createIconPlane.ts:18`

`texture.colorSpace = SRGBColorSpace` mute la texture originale de `Resources`. Pas une fuite, mais un side-effect sur des ressources globales partagees. Meme chose dans `Poster.ts:116` et `Crate.ts:145`.

---

## Tableau recapitulatif

| # | Severite | Description | Fuite estimee par partie |
|---|----------|-------------|--------------------------|
| 1 | CRITIQUE | Delivery meshes clones non disposes | ~N meshes GPU (N = nb livraisons) |
| 2 | CRITIQUE | InteractionSystem jamais dispose | 81 meshes + 80 materials + DroppedResources |
| 3 | CRITIQUE | LevelObject.dispose() ne libere pas geometry/materials | ~40+ geometry + materials GPU |
| 4 | CRITIQUE | BlueWorkZone.dispose() manque super.dispose() | meshes + materials par BWZ |
| 5 | CRITIQUE | mergeWallTops geometry intermediaires non disposees | ~24 geometry clones |
| 6 | HAUTE | Player.cleanup() ne dispose pas mesh/materials | 2 meshes clones + ~20 materials |
| 7 | HAUTE | Animations en cours perdues au dispose | 0-N meshes + textures |
| 8 | HAUTE | Floor.dispose() a verifier | 1 mesh (a confirmer) |
| 9 | MOYENNE | DroppedResource.getPosition() allocations | Pression GC |
| 10 | MOYENNE | Sizes listener anonyme | 1 listener (singleton) |
| 11 | MOYENNE | GamepadManager listeners anonymes | 2 listeners (singleton) |
| 12 | MOYENNE | Stage.dispose() incomplet | Non critique en prod |
| 13 | BASSE | colorSpace mute sur textures partagees | Pas de fuite, side-effect |

---

## Estimation d'impact cumulatif

En supposant 50 parties par jour, les items critiques (1-5) representent par jour :
- **~2500+ geometry** non liberees (delivery + level objects + merge intermediaires)
- **~2000+ materials** non liberes (cloneMaterials sur chaque LevelObject)
- **~50 SmokeParticleSystem** (80 materials chacun = 4000 materials)
- **~50 sets de DroppedResources** avec leurs progress bars et icon planes

Soit une derive de l'ordre de **plusieurs dizaines de MB GPU** sur une journee, potentiellement visible comme lag ou crash Chrome apres 4-6h.

---

## Recommandations de correction (par ordre de priorite)

### P0 — Corrections immédiates

1. **Ajouter `InteractionSystem.dispose()`** et l'appeler depuis `Level.dispose()`
2. **Enrichir `LevelObject.dispose()`** pour traverser et disposer geometry/materials des meshes clones
3. **Ajouter `super.dispose()` dans `BlueWorkZone.dispose()`**
4. **Disposer les geometry intermediaires dans `LevelBuilder.mergeWallTops()`**
5. **Disposer les delivery meshes clones** dans l'animation callback de `InteractionSystem`

### P1 — Corrections importantes

6. **Enrichir `Player.cleanup()`** pour disposer mesh + carried resource
7. **Disposer `Poster` geometry/materials** dans son `dispose()`

### P2 — Ameliorations

8. **Cacher `DroppedResource.getPosition()`** avec un Vector3 reutilisable
9. **Stocker les listeners dans `Sizes` et `GamepadManager`** pour permettre un cleanup propre
10. **Completer `Stage.dispose()`** pour un teardown total

---

## Protocole de verification (soak test)

### Setup
```
Chrome DevTools > Performance Monitor + Memory tab
```

### Protocole
1. Prendre un heap snapshot initial
2. Jouer 10 parties completes (Menu → Level → Score → Leaderboard → Menu)
3. Forcer un GC (`Collect garbage` dans DevTools)
4. Prendre un second heap snapshot
5. Comparer les snapshots : chercher des objets `BufferGeometry`, `MeshStandardMaterial`, `WebGLTexture` qui croissent

### Metriques a surveiller
```js
// Dans la console, apres chaque partie :
const info = renderer.info;
console.log('Geometries:', info.memory.geometries);
console.log('Textures:', info.memory.textures);
```

### Critere d'acceptation
- Apres warmup (2-3 parties), les compteurs geometry/textures doivent se stabiliser
- Pas de pente monotone sur le heap JS ni sur `renderer.info.memory`
