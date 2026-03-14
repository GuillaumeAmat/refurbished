import {
  CanvasTexture,
  DoubleSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';
import QRCode from 'qrcode';

export interface QRCodePlaneResult {
  mesh: Mesh;
  width: number;
  dispose: () => void;
}

export async function createQRCodePlane(
  url: string,
  worldHeight: number,
): Promise<QRCodePlaneResult> {
  const canvas = document.createElement('canvas');

  await QRCode.toCanvas(canvas, url, {
    width: 512,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const texture = new CanvasTexture(canvas);
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;

  const aspect = canvas.width / canvas.height;
  const worldWidth = worldHeight * aspect;

  const geometry = new PlaneGeometry(worldWidth, worldHeight);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: DoubleSide,
  });

  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 999;

  return {
    mesh,
    width: worldWidth,
    dispose: () => {
      texture.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
