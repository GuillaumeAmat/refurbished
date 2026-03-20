# CODEX — Audit fuites memoire (longue duree)

## Contexte

Le jeu doit tourner en continu sur une journee complete dans le meme onglet Chrome, avec des parties qui s'enchainent.  
L'objectif est d'eviter toute accumulation memoire (CPU et GPU) au fil des cycles.

## Resume executif

L'audit met en evidence plusieurs risques de fuite a fort impact, en particulier sur:

- le cycle de vie global (`Stage`, `Time`, `Renderer`, ecrans HUD),
- la gestion des listeners (`tick`, `resize`, `gamepad`),
- la liberation des ressources Three.js (geometries, materials, textures, render targets),
- des references conservées dans des singletons (`Environment` notamment).

Le risque principal n'est pas un crash immediat, mais une derive progressive de la memoire sur des sessions longues.

## Risques critiques identifies

### 1) Teardown incomplet de la scene et du rendu

**Fichiers concernes:**

- `game/Stage.ts`
- `game/util/Renderer.ts`
- `game/LoadingOverlay.ts`

**Constat:**

- `Stage.dispose()` ne nettoie pas explicitement tous les objets crees durant le jeu.
- Le `Renderer` ne dispose pas ses `EffectComposer`, passes et render targets.
- `LoadingOverlay` ne propose pas de `dispose()` pour liberer geometry/material.

**Impact:**

- Accumulation GPU probable lors de cycles de montage/demontage.

### 2) Listeners `Time` non purges

**Fichier:**

- `game/util/Time.ts`

**Constat:**

- `dispose()` annule le `requestAnimationFrame`, mais ne purge pas les listeners `tick`.
- `Stage` enregistre plusieurs callbacks `tick` anonymes difficiles a desinscrire.

**Impact:**

- Retention de closures et d'objets volumineux (renderer, ecrans, overlays) entre cycles.

### 3) Multiplication des listeners `resize`

**Fichiers:**

- `game/util/Sizes.ts`
- `game/Stage.ts`
- `game/util/Renderer.ts`
- `game/world/Camera.ts`

**Constat:**

- Plusieurs `new Sizes()` creent plusieurs listeners `window.resize`.
- Pas de nettoyage robuste et centralise.

**Impact:**

- Croissance lente des listeners et retention d'instances.

### 4) Liberation GPU incomplète des objets Three.js clones

**Fichiers:**

- `game/world/object/LevelObject.ts`
- `game/world/Player.ts`
- `game/world/InteractionSystem.ts`
- `game/world/object/DroppedResource.ts`

**Constat:**

- Sur certains chemins, des meshes clones sont seulement detaches de la scene sans `dispose()` complet des ressources GPU.

**Impact:**

- Derive memoire GPU sur longues sequences d'interactions.

### 5) Accumulation de references dans `Environment`

**Fichier:**

- `game/world/Environment.ts`

**Constat:**

- Les joueurs sont enregistres mais pas desinscrits systematiquement.

**Impact:**

- Accumulation d'objets references au fil des cycles de niveau.

## Risques moyens / a surveiller

- `OnboardingManager`: timer `setTimeout` de demarrage non annule au `dispose()`.
- `LevelBuilder.mergeWallTops`: geometries intermediaires a disposer apres merge.
- `LeaderboardOverlayHUD`: risque de doublon d'intervalle si `show()` est rejoue sans `hide()`.
- Chemins de `dispose()` heterogenes selon les classes d'objets monde.

## Recommandations prioritaires

1. **Unifier le teardown global dans `Stage.dispose()`**
   - stocker toutes les references creees,
   - disposer explicitement ecrans, HUD, renderer, overlays, subscriptions.

2. **Durcir `Time` et `Sizes`**
   - purge listeners dans `Time.dispose()`,
   - singleton `Sizes` unique + listener `resize` nettoyable.

3. **Introduire un helper de disposal Three.js**
   - utilitaire central `disposeObject3D(root)` pour geometries/materials/textures.

4. **Ajouter `Renderer.dispose()` et `LoadingOverlay.dispose()`**
   - liberation explicite des compositors, passes et render targets.

5. **Nettoyer les references singleton**
   - `Environment`: `unregisterPlayer` / reset explicite au cycle de vie du niveau.

## Plan de verification (soak test)

### Protocole

- Boucler pendant au moins 2h sur:
  - `Menu -> Level -> Score -> Menu`,
  - plus sorties/retours sur la page du jeu.

### Metriques

- Heap snapshots Chrome DevTools (avant / apres / toutes les 20 min),
- `renderer.info.memory` (textures, geometries, programs),
- comptage listeners critiques (`resize`, `tick`, gamepad events).

### Critere d'acceptation

- Stabilisation apres warmup,
- absence de pente monotone significative de la memoire.

## Conclusion

Le socle actuel fonctionne, mais comporte plusieurs points de retention qui peuvent degrader la session sur tres longue duree.  
Le traitement des points critiques ci-dessus reduira fortement le risque de derive memoire en production evenementielle.

