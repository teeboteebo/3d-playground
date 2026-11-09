import * as THREE from 'three';

/** an sRGB hex colour as a linear-space colour, the space three.js lights in */
export const lin = (hex: string) => new THREE.Color(hex).convertSRGBToLinear();

/** a plain standard material in an sRGB hex colour */
export const std = (hex: string, rough = 0.9, metal = 0) =>
  new THREE.MeshStandardMaterial({ color: lin(hex), roughness: rough, metalness: metal });
