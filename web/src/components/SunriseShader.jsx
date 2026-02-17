import { useRef, useEffect } from 'react';

const VERT = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;

uniform vec2 iResolution;
uniform float iTime;

// Hash-based 3D noise (replaces Shadertoy iChannel0 texture)
float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

float noise(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n = p.x + p.y * 57.0 + 113.0 * p.z;
  return mix(
    mix(mix(hash(n + 0.0), hash(n + 1.0), f.x),
        mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
    mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
        mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y),
    f.z
  );
}

float map(vec3 p) {
  vec3 q = p + 0.2 * vec3(3.0, 0.3, 5.0) * mod(iTime, 3600.0) * 2.0;
  float n = 0.0, f = 0.5;
  n += f * noise(q); q *= 3.001; f *= 0.333;
  n += f * noise(q); q *= 3.002; f *= 0.332;
  n += f * noise(q);
  return n;
}

float scene(vec3 p) {
  return p.y + 2.0 - 0.003 * map(vec3(p.x, 0.0, p.z));
}

vec3 getNormal(vec3 p, float d) {
  float e = 0.05;
  float dx = scene(vec3(e, 0.0, 0.0) + p) - d;
  float dy = scene(vec3(0.0, e, 0.0) + p) - d;
  float dz = scene(vec3(0.0, 0.0, e) + p) - d;
  return normalize(vec3(dx, dy, dz));
}

vec3 shadeBg(vec3 nml, vec2 fragCoord) {
  vec2 aspect = vec2(iResolution.x / iResolution.y, 1.0);
  vec2 uv = (2.0 * fragCoord.xy / iResolution.xy - 1.0) * aspect;

  vec3 bgLight = normalize(vec3(
    sin(iTime * 0.5) * 0.1,
    cos(iTime * 0.1) * 0.6 - 0.3,
    -1.0
  ));

  float sunD = dot(bgLight, nml) > 0.995 ? 1.0 : 0.0;
  vec3 sun = vec3(6.5, 3.5, 2.0);
  float skyPow = dot(nml, vec3(0.0, -1.0, 0.0));
  float horizonPow = pow(1.0 - abs(skyPow), 3.0) * 5.0;
  float sunPow = dot(nml, bgLight);
  float sp = max(sunPow, 0.0);
  float scattering = clamp(1.0 - abs(2.0 * (-bgLight.y)), 0.0, 1.0);

  vec3 bgCol = max(0.0, skyPow) * 2.0 * vec3(0.8);
  bgCol += 0.5 * vec3(0.8) * horizonPow;
  bgCol += sun * (sunD + pow(sp, max(128.0, abs(bgLight.y) * 512.0)));
  bgCol += vec3(0.4, 0.2, 0.15) * (pow(sp, 8.0) + pow(sp, max(8.0, abs(bgLight.y) * 128.0)));
  bgCol *= mix(vec3(0.7, 0.85, 0.95), vec3(1.0, 0.45, 0.1), scattering);
  bgCol *= 1.0 - clamp(bgLight.y * 3.0, 0.0, 0.6);

  float cloudFac = pow(abs(skyPow), 0.8);
  float cc = 0.5; // cloud cover mapped from ufCloudCover = 0.5
  float cloud = 0.0;
  cloud += min(1.0, 1.0 - smoothstep(0.0, cc, map(nml / nml.y))) * 0.4;
  cloud += min(1.0, 1.0 - smoothstep(0.0, cc, map(nml * 1.03 / nml.y))) * 0.4;
  cloud += min(1.0, 1.0 - smoothstep(0.0, cc, map(nml * 3.0 / nml.y))) * 0.3;
  bgCol *= 1.0 + cloudFac * cloud;

  return pow(max(vec3(0.0), bgCol), vec3(2.6));
}

mat3 rotationXY(vec2 angle) {
  float cp = cos(angle.x);
  float sp = sin(angle.x);
  float cy = cos(angle.y);
  float sy = sin(angle.y);
  return mat3(
    cy, -sy, 0.0,
    sy,  cy, 0.0,
    0.0, 0.0, 1.0
  ) * mat3(
    cp, 0.0, -sp,
    0.0, 1.0, 0.0,
    sp, 0.0, cp
  );
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 aspect = vec2(iResolution.x / iResolution.y, 1.0);
  vec2 uv = (2.0 * (fragCoord / iResolution.xy) - 1.0) * aspect;

  mat3 rot = rotationXY(vec2(
    0.2 + 0.1 * cos(0.25 * iTime),
    -0.07 * sin(0.5 + 0.25 * iTime)
  ));

  vec3 d = rot * normalize(vec3(uv, 1.0));
  vec3 p = vec3(uv * -2.0, -9.5);
  vec3 tr = vec3(1.0);

  if (d.y < 0.0) {
    float dist = -2.0 / d.y - p.y / d.y;
    p += d * dist;
    vec3 nml = getNormal(p, 0.0);
    float f = pow(1.0 - dot(d, -vec3(0.0, 1.0, 0.0)), 5.0);
    nml = mix(nml, vec3(0.0, 1.0, 0.0), f);
    d = reflect(d, nml);
    tr *= mix(0.5 * vec3(0.5, 0.9, 0.75), vec3(1.0), f);
  }

  vec3 col = tr * shadeBg(-d, fragCoord);

  // Dithering (replaces texture-based dithering)
  float n = fract(sin(dot(fragCoord, vec2(12.9898, 78.233))) * 43758.5453);
  vec3 dither = (vec3(n, fract(n * 1.7), fract(n * 2.3)) - 0.5) / 64.0;

  gl_FragColor = pow(vec4(dither + (1.0 - exp(-1.3 * col)), 1.0), vec4(1.3));
}
`;

export default function SunriseShader({ className = '' }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const glRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    });

    if (!gl) return;
    glRef.current = gl;

    function compileShader(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }

    const vs = compileShader(gl.VERTEX_SHADER, VERT);
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
      return;
    }

    gl.useProgram(prog);

    // Full-screen triangle strip
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const posAttr = gl.getAttribLocation(prog, 'position');
    gl.enableVertexAttribArray(posAttr);
    gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'iResolution');
    const uTime = gl.getUniformLocation(prog, 'iTime');

    const startTime = performance.now();
    let prevW = 0, prevH = 0;

    function render() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.floor(canvas.clientWidth * dpr);
      const h = Math.floor(canvas.clientHeight * dpr);

      if (w !== prevW || h !== prevH) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        prevW = w;
        prevH = h;
      }

      const t = (performance.now() - startTime) / 1000;
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, t * 0.4);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      frameRef.current = requestAnimationFrame(render);
    }

    render();

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}
