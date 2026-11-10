import * as THREE from 'three';

/*
 * The scene was lit and tuned under three.js r128. Later releases manage colour, measure light in physical units
 * and filter soft shadows differently, which would visibly change every room. These patches keep the r128 look:
 *
 *  - colours: hex values are used as given (the scene converts its sRGB colours to linear itself, see lin())
 *  - light units: r128 multiplied every direct and sky light by π; light colours are scaled the same way here
 *  - falloff: point and spot lights fade as (1 − d / distance)^decay, as in r128, not with the inverse square
 *  - soft shadows: r128's 17-tap grid (9 taps for point lights), spread over shadow.radius texels, in place of the
 *    dithered 5-tap disk, so the lamps' heavily blurred shadows stay smooth
 *
 * The patches match code, not comments (the published build strips shader comments). Each patch checks it found its target, so an upgrade that changes the shaders fails loudly instead of quietly
 * changing the look.
 */

function patch(chunk: keyof typeof THREE.ShaderChunk, from: string | RegExp, to: string): void {
  const src = THREE.ShaderChunk[chunk];
  const out = src.replace(from, to);
  if (out === src) throw new Error(`legacyLook: could not patch ShaderChunk.${chunk} (${String(from).slice(0, 60)})`);
  (THREE.ShaderChunk as Record<string, string>)[chunk] = out;
}

const grid17 = (() => {
  const o = [
    ['dx0', 'dy0'], ['0.0', 'dy0'], ['dx1', 'dy0'],
    ['dx2', 'dy2'], ['0.0', 'dy2'], ['dx3', 'dy2'],
    ['dx0', '0.0'], ['dx2', '0.0'], ['0.0', '0.0'], ['dx3', '0.0'], ['dx1', '0.0'],
    ['dx2', 'dy3'], ['0.0', 'dy3'], ['dx3', 'dy3'],
    ['dx0', 'dy1'], ['0.0', 'dy1'], ['dx1', 'dy1'],
  ];
  const taps = o.map(([x, y]) => `texture( shadowMap, vec3( shadowCoord.xy + vec2( ${x}, ${y} ), shadowCoord.z ) )`);
  return `vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float dx0 = - texelSize.x * shadowRadius;
				float dy0 = - texelSize.y * shadowRadius;
				float dx1 = + texelSize.x * shadowRadius;
				float dy1 = + texelSize.y * shadowRadius;
				float dx2 = dx0 / 2.0;
				float dy2 = dy0 / 2.0;
				float dx3 = dx1 / 2.0;
				float dy3 = dy1 / 2.0;
				shadow = ( ${taps.join(' + ')} ) * ( 1.0 / 17.0 );`;
})();

/** left in the patched chunk, so the patches run once per page even if this module is evaluated again (HMR) */
const MARKER = '// legacyLook';

export function applyLegacyLook(): void {
  THREE.ColorManagement.enabled = false;
  if (THREE.ShaderChunk.shadowmap_pars_fragment.includes(MARKER)) return;

  patch(
    'lights_pars_begin',
    /float getDistanceAttenuation\([^)]*\) \{[\s\S]*?return distanceFalloff;\s*\}/,
    `float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	if ( cutoffDistance > 0.0 && decayExponent > 0.0 ) return pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );
	return 1.0;
}`,
  );
  patch('lights_pars_begin', 'light.color = sunLight.color;', 'light.color = sunLight.color * PI;');
  patch('lights_pars_begin', 'light.color = directionalLight.color;', 'light.color = directionalLight.color * PI;');
  patch('lights_pars_begin', 'light.color = pointLight.color;', 'light.color = pointLight.color * PI;');
  patch('lights_pars_begin', 'light.color = spotLight.color * spotAttenuation;', 'light.color = spotLight.color * spotAttenuation * PI;');
  patch(
    'lights_pars_begin',
    'vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );',
    'vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight ) * PI;',
  );

  patch('shadowmap_pars_fragment', /vec2 texelSize = vec2\( 1\.0 \) \/ shadowMapSize;\s*vec2 radius = shadowRadius \* texelSize;[\s\S]*?\) \* 0\.2;/, grid17);
  patch(
    'shadowmap_pars_fragment',
    /float texelSize = shadowRadius \/ shadowMapSize\.x;[\s\S]*?shadow \*= 0\.2;/,
    `${MARKER}
			vec2 offset = vec2( - 1.0, 1.0 ) * shadowRadius / ( shadowMapSize.y * 2.0 );
			vec3 offsets[ 9 ] = vec3[ 9 ]( offset.xyy, offset.yyy, offset.xxy, offset.yxy, offset.xxx, offset.yxx, offset.xyx, offset.yyx, vec3( 0.0 ) );
			shadow = 0.0;
			for ( int i = 0; i < 9; i ++ ) {
				vec3 direction = bd3D + offsets[ i ];
				vec3 absDirection = abs( direction );
				// r128 added shadow.bias to the light distance as a fraction of near..far; r187 adds it to the
				// perspective depth, where the same bias grows with the square of the distance. Apply it as r128
				// did, then convert to the cube face's depth (this scene does not use a reversed depth buffer).
				float z = lightDistance * max( max( absDirection.x, absDirection.y ), absDirection.z ) + shadowBias * depthRange;
				float dp = shadowCameraFar / depthRange - shadowCameraNear * shadowCameraFar / ( depthRange * z );
				shadow += texture( shadowMap, vec4( direction, dp ) );
			}
			shadow /= 9.0;`,
  );
}
