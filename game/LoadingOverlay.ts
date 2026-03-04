import { gsap } from 'gsap';
import { Mesh, PlaneGeometry, type Scene, ShaderMaterial } from 'three';

import { BACKGROUND_COLOR_B, BACKGROUND_COLOR_G, BACKGROUND_COLOR_R } from './constants';

export class LoadingOverlay {
  #scene: Scene;
  #geometry: PlaneGeometry;
  #material: ShaderMaterial;
  #mesh: Mesh;

  constructor(scene: Scene) {
    // BACKGROUND_COLOR_* are sRGB values (0–255). Since renderer.outputColorSpace = SRGBColorSpace,
    // Three.js expects linear values from the shader and applies linear→sRGB itself.
    // Linearizing here (gamma ≈ 2.2) prevents double-conversion that would make the overlay brighter.
    const bgColorVec4Red = Math.pow(parseInt(BACKGROUND_COLOR_R, 10) / 255, 2.2);
    const bgColorVec4Green = Math.pow(parseInt(BACKGROUND_COLOR_G, 10) / 255, 2.2);
    const bgColorVec4Blue = Math.pow(parseInt(BACKGROUND_COLOR_B, 10) / 255, 2.2);

    this.#scene = scene;

    this.#geometry = new PlaneGeometry(2, 2, 1, 1);

    this.#material = new ShaderMaterial({
      transparent: true,
      uniforms: {
        uAlpha: {
          value: 1,
        },
      },
      vertexShader: `
      void main() {
        // For orthographic camera
        // gl_Position = vec4(position.x, position.y, -1.0, 1.0);
        // End orthographic camera

        // For perspective camera
        gl_Position = vec4(position, 1.0);
        // End perspective camera
      }
      `,
      fragmentShader: `
      uniform float uAlpha;

      void main() {
        gl_FragColor = vec4(${bgColorVec4Red}, ${bgColorVec4Green}, ${bgColorVec4Blue}, uAlpha);
      }
      `,
    });

    this.#mesh = new Mesh(this.#geometry, this.#material);
    this.#scene.add(this.#mesh);
  }

  public hide() {
    if (this.#material.uniforms.uAlpha) {
      gsap.to(this.#material.uniforms.uAlpha, {
        value: 0,
        duration: 1.8,
        ease: 'power2.out',
      });
    }
  }

  public update() {}
}
