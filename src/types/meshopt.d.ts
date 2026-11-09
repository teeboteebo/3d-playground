/* @types/three 0.128 has no declaration for the meshopt decoder that ships with three r128 */
declare module 'three/examples/jsm/libs/meshopt_decoder.module' {
  export const MeshoptDecoder: {
    supported: boolean;
    ready: Promise<void>;
    decodeVertexBuffer(target: Uint8Array, count: number, size: number, source: Uint8Array, filter?: string): void;
    decodeIndexBuffer(target: Uint8Array, count: number, size: number, source: Uint8Array): void;
    decodeIndexSequence(target: Uint8Array, count: number, size: number, source: Uint8Array): void;
    decodeGltfBuffer(target: Uint8Array, count: number, size: number, source: Uint8Array, mode: string, filter?: string): void;
  };
}
