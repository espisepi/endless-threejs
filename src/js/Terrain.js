import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Vector2,
  Vector3
} from "three";
import noise from "../shaders/noise2D.glsl";

class Terrain extends Mesh {
  constructor(width, height, segmentsX, segmentsY) {
    let g = terrainGeom(width, height, segmentsX, segmentsY);
    let m = terrainMat();
    super(g, m);
    let that = this;
    this.totalTime = { value: 0 };
    this.widthFactor = { value: 0.5 };
    this.wireframeColor = { value: new Color(0x000000) };
    this.planeStep = { value: height / segmentsY };
    this.planeFactor = { value: width };
    this.planeLimits = { value: height * 0.5 - height / segmentsY };
    this.update = (t) => {
      that.totalTime.value += t;
    };

    function terrainMat() {
      let m = new MeshBasicMaterial({
        color: 0xffffff,
        //side: DoubleSide,
        onBeforeCompile: (shader) => {
          shader.uniforms.time = that.totalTime;
          shader.uniforms.widthFactor = that.widthFactor;
          shader.uniforms.wireframeColor = that.wireframeColor;
          shader.uniforms.planeStep = that.planeStep;
          shader.uniforms.planeFactor = that.planeFactor;
          shader.uniforms.planeLimits = that.planeLimits;
          shader.vertexShader = /* glsl */ `
            uniform float time;
            uniform float planeStep;
            uniform float planeFactor;
            attribute vec3 center;
            varying vec3 vCenter;
            varying vec3 vPos;
            varying vec2 vNcoord;
            ${noise}
            ${shader.vertexShader}
          `.replace(
            /* glsl */ `#include <begin_vertex>`,
            /* glsl */ `#include <begin_vertex>

              float t = time;
              transformed.z += mod(t, planeStep); // move back
              float pz = position.z - (floor(t / planeStep) * planeStep); // position in dependence of time
              vec2 ncoord = vec2(position.x, pz);
              vNcoord = ncoord;
              float ns = snoise((ncoord / planeFactor) * 10.) ; // landscape heights
              ns = clamp(ns * 0.5 + 0.5, 0., 1.);
              ns = pow(ns, 3.);
              float road = smoothstep(0.03, 0.06, abs(uv.x - 0.5)); // road height
              transformed.y = ns * road * 40.;

              vPos = transformed;
              vCenter = center;
            `
          );
          //console.log(shader.vertexShader);
          shader.fragmentShader = /*glsl */ `
    
            uniform float widthFactor;
            uniform vec3 wireframeColor;
            uniform float planeLimits;
            uniform float planeFactor;
            varying vec3 vCenter;
            varying vec3 vPos;
            varying vec2 vNcoord;
    
            float edgeFactorTri() {
              vec3 d = fwidth( vCenter.xyz );
              vec3 a3 = smoothstep( vec3( 0.0 ), d * widthFactor, vCenter.xyz );
              return min( min( a3.x, a3.y ), a3.z );
            }

            float grid(vec2 coord){
              vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
              float line = min(grid.x, grid.y);
              return 1.0 - min(line, 1.0);
            }

            // https://www.youtube.com/watch?v=2R7h76GoIJM ///////
            float Hash21(vec2 p){                               //
              p = fract(p * vec2(234.34, 435.345));             //
              p += dot(p, p + 34.23);                           //
              return fract(p.x * p.y);                          //
            }                                                   //
            float truchet(vec2 uv){                             //
              vec2 tUv = uv * ${segmentsY}. * 4.;               //
              vec2 gv = fract(tUv) - 0.5;                       //
              vec2 id = floor(tUv);                             //
              float n = Hash21(id);                             //
              float width = 0.25;                               //
              if(n < 0.5) gv.x *= -1.;                          //
              float d = abs(abs(gv.x + gv.y) - 0.5);            //
              vec2 fw = fwidth(uv);                             //
              float e = max(fw.x, fw.y);                        //
              float mask = smoothstep(0.1 + e, 0.1, d - width); //
              return mask;                                      //
            }                                                   //
            //////////////////////////////////////////////////////
            ${shader.fragmentShader}
          `.replace(
            /* glsl */ `vec4 diffuseColor = vec4( diffuse, opacity );`,
            /* glsl */ `
              if (abs(vPos.z) > planeLimits) discard; // smooth appearance of plane edges
              
              
              float f = edgeFactorTri();
              vec3 col = mix(wireframeColor, diffuse, step(0.99, f)); // wireframe
              
              float vHeight = vPos.y;
              float hLim = 3.;
              float e = fwidth(vHeight);

              vec3 c = vec3(0.5);
              float fLim = smoothstep(0., e * 3., abs(vHeight - hLim));
              col = mix(col, vec3(0, 1, 1), 1. - fLim); // aqua border
              
              col = mix(col, c, smoothstep(hLim, hLim - e, vHeight)); // below the border
              
              float gf = grid(vUv * vec2(${segmentsX}., ${segmentsY}.) * 2.); // grid
              col = mix(col, wireframeColor, gf);

              float rwidth = (${1.0 / segmentsX}) * 0.5;
              float rf = fwidth(vUv.x);
              float road = smoothstep(rwidth, rwidth - rf, abs(vUv.x - 0.5)); // road sides
              vec2 truchetCoord = vNcoord;
              truchetCoord.y = mod(truchetCoord.y, 1600.);
              vec2 truchetUv = ( truchetCoord / planeFactor) * 0.5;
              c = vec3(1) * truchet(truchetUv); // Truchet pattern
              c = mix(c, vec3(1), smoothstep(12., 50., abs(vPos.z))); // distance whitening
              col = mix(col, c, road);
              
              vec4 diffuseColor = vec4( col, 1. );
    
    
            `
          );
          //console.log(shader.fragmentShader);
        }
      });
      m.defines = { USE_UV: "" };
      return m;
    }

    function terrainGeom(width, height, segmentsX, segmentsY) {
      let pts = [];
      let uvs = [];
      let idx = [];
      let size = new Vector2(width, height);
      let segments = new Vector2(segmentsX, segmentsY);
      let p1 = new Vector2(),
        p2 = new Vector2();
      let pShift = new Vector2(0.5, -0.5);
      let uv1 = new Vector2(),
        uv2 = new Vector2();

      for (let y = 0; y <= segments.y; y++) {
        let ptsPartMajor = [];
        let ptsPartMinor = [];
        let uvsPartMajor = [];
        let uvsPartMinor = [];
        let center = (y + 1) * (segments.x + 1) + segments.x * y;
        for (let x = 0; x <= segments.x; x++) {
          p1.set(x, segments.y - y);
          ptsPartMajor.push(p1.clone());
          getUv(p1, segments, uv1);
          uvsPartMajor.push(uv1.x, uv1.y);

          if (x < segments.x && y < segments.y) {
            p2.set(x, segments.y - y).add(pShift);
            ptsPartMinor.push(p2.clone());
            getUv(p2, segments, uv2);
            uvsPartMinor.push(uv2.x, uv2.y);

            let mid = center + x;
            let top = mid - (segments.x + 1);
            let bot = mid + segments.x;

            let i0 = top;
            let i1 = top + 1;
            let i2 = bot + 1;
            let i3 = bot;
            let i4 = mid;

            // index
            idx.push(i0, i4, i1, i1, i4, i2, i2, i4, i3, i3, i4, i0);
          }
        }
        pts = pts.concat(ptsPartMajor);
        pts = pts.concat(ptsPartMinor);
        uvs = uvs.concat(uvsPartMajor);
        uvs = uvs.concat(uvsPartMinor);
      }
      //console.log(pts);
      let g = new BufferGeometry().setFromPoints(pts);
      g.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
      //console.log(idx);
      g.setIndex(idx);
      let scaleX = size.x / segments.x;
      let scaleY = size.y / segments.y;
      g.scale(scaleX, scaleY, 1);
      g.center();
      g.rotateX(Math.PI * -0.5);
      g = g.toNonIndexed();
      g.computeVertexNormals();

      setupAttributes(g);

      return g;

      function getUv(pos, segments, uv) {
        uv.set(pos.x / segments.x, pos.y / segments.y);
      }

      function setupAttributes(geometry) {
        const vectors = [
          new Vector3(1, 0, 0),
          new Vector3(0, 1, 0),
          new Vector3(0, 0, 1)
        ];

        const position = geometry.attributes.position;
        const centers = new Float32Array(position.count * 3);

        for (let i = 0, l = position.count; i < l; i++) {
          vectors[i % 3].toArray(centers, i * 3);
        }

        geometry.setAttribute("center", new BufferAttribute(centers, 3));
      }
    }
  }
}
export { Terrain };
