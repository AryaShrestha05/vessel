import { useEffect, useRef, useCallback } from 'react'

interface ColorBendsProps {
  rotation?: number
  speed?: number
  colors?: string[]
  transparent?: boolean
  autoRotate?: number
  scale?: number
  frequency?: number
  warpStrength?: number
  mouseInfluence?: number
  parallax?: number
  noise?: number
}

const VERTEX_SHADER = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;
  uniform float u_rotation;
  uniform float u_speed;
  uniform float u_scale;
  uniform float u_frequency;
  uniform float u_warpStrength;
  uniform float u_noise;
  uniform float u_autoRotate;
  uniform float u_mouseInfluence;
  uniform float u_parallax;
  uniform vec2 u_mouse;
  uniform vec3 u_colors[4];
  uniform int u_colorCount;
  uniform float u_transparent;

  // Simplex-style noise
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                            + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                             dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
      value += amp * snoise(p);
      p *= 2.0;
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;
    vec2 center = uv - 0.5;

    // Mouse parallax offset
    vec2 mouseOffset = (u_mouse - 0.5) * u_mouseInfluence * u_parallax;
    center -= mouseOffset;

    // Apply rotation (base + auto)
    float rot = radians(u_rotation) + u_autoRotate * u_time * 0.5;
    float cr = cos(rot);
    float sr = sin(rot);
    center = mat2(cr, -sr, sr, cr) * center;

    // Scale
    center *= u_scale;

    // Time
    float t = u_time * u_speed;

    // Warp distortion using noise
    vec2 warp = vec2(
      fbm(center * u_frequency + t * 0.3),
      fbm(center * u_frequency + t * 0.3 + 43.0)
    );
    center += warp * u_warpStrength * 0.4;

    // Additional noise layer
    float n = fbm(center * u_frequency * 1.5 + t * 0.2) * u_noise;

    // Color mixing based on warped position
    float angle = atan(center.y, center.x) / 6.28318 + 0.5;
    float dist = length(center);

    // Blend factor using angle + distance + noise
    float blend = angle + dist * 0.5 + n * 0.3 + t * 0.05;
    blend = fract(blend);

    // Mix colors smoothly
    vec3 col;
    if (u_colorCount <= 1) {
      col = u_colors[0];
    } else if (u_colorCount == 2) {
      col = mix(u_colors[0], u_colors[1], smoothstep(0.0, 1.0, blend));
    } else if (u_colorCount == 3) {
      float seg = blend * 3.0;
      if (seg < 1.0) col = mix(u_colors[0], u_colors[1], smoothstep(0.0, 1.0, seg));
      else if (seg < 2.0) col = mix(u_colors[1], u_colors[2], smoothstep(0.0, 1.0, seg - 1.0));
      else col = mix(u_colors[2], u_colors[0], smoothstep(0.0, 1.0, seg - 2.0));
    } else {
      float seg = blend * 4.0;
      if (seg < 1.0) col = mix(u_colors[0], u_colors[1], smoothstep(0.0, 1.0, seg));
      else if (seg < 2.0) col = mix(u_colors[1], u_colors[2], smoothstep(0.0, 1.0, seg - 1.0));
      else if (seg < 3.0) col = mix(u_colors[2], u_colors[3], smoothstep(0.0, 1.0, seg - 2.0));
      else col = mix(u_colors[3], u_colors[0], smoothstep(0.0, 1.0, seg - 3.0));
    }

    // Add subtle depth variation
    float depth = smoothstep(0.0, 1.5, dist);
    col *= 1.0 - depth * 0.3;

    float alpha = u_transparent > 0.5 ? 0.85 - depth * 0.2 : 1.0;

    gl_FragColor = vec4(col, alpha);
  }
`

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ]
}

export function ColorBends({
  rotation = 0,
  speed = 0.2,
  colors = ['#f47710', '#000000', '#b81fff', '#de560d'],
  transparent = false,
  autoRotate = 0,
  scale = 1.3,
  frequency = 1,
  warpStrength = 1,
  mouseInfluence = 0.5,
  parallax = 0.5,
  noise = 0.25,
}: ColorBendsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const animRef = useRef<number>(0)
  const mouseRef = useRef<[number, number]>([0.5, 0.5])
  const startTimeRef = useRef<number>(Date.now())

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current = [
      (e.clientX - rect.left) / rect.width,
      1.0 - (e.clientY - rect.top) / rect.height,
    ]
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false })
    if (!gl) return
    glRef.current = gl

    // Compile shaders
    const vs = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vs, VERTEX_SHADER)
    gl.compileShader(vs)

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fs, FRAGMENT_SHADER)
    gl.compileShader(fs)

    const program = gl.createProgram()!
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    gl.useProgram(program)
    programRef.current = program

    // Full-screen quad
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    if (transparent) {
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    }

    window.addEventListener('mousemove', handleMouseMove)

    // Set static uniforms
    const setUniform1f = (name: string, v: number) => {
      const loc = gl.getUniformLocation(program, name)
      if (loc) gl.uniform1f(loc, v)
    }
    const setUniform1i = (name: string, v: number) => {
      const loc = gl.getUniformLocation(program, name)
      if (loc) gl.uniform1i(loc, v)
    }

    setUniform1f('u_rotation', rotation)
    setUniform1f('u_speed', speed)
    setUniform1f('u_scale', scale)
    setUniform1f('u_frequency', frequency)
    setUniform1f('u_warpStrength', warpStrength)
    setUniform1f('u_noise', noise)
    setUniform1f('u_autoRotate', autoRotate)
    setUniform1f('u_mouseInfluence', mouseInfluence)
    setUniform1f('u_parallax', parallax)
    setUniform1f('u_transparent', transparent ? 1.0 : 0.0)

    const colorValues = colors.slice(0, 4).map(hexToRgb)
    setUniform1i('u_colorCount', colorValues.length)
    for (let i = 0; i < 4; i++) {
      const c = colorValues[i] || [0, 0, 0]
      const loc = gl.getUniformLocation(program, `u_colors[${i}]`)
      if (loc) gl.uniform3f(loc, c[0], c[1], c[2])
    }

    startTimeRef.current = Date.now()

    // Resize handler
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    // Render loop
    const render = () => {
      const t = (Date.now() - startTimeRef.current) / 1000

      const resLoc = gl.getUniformLocation(program, 'u_resolution')
      if (resLoc) gl.uniform2f(resLoc, canvas.width, canvas.height)

      const timeLoc = gl.getUniformLocation(program, 'u_time')
      if (timeLoc) gl.uniform1f(timeLoc, t)

      const mouseLoc = gl.getUniformLocation(program, 'u_mouse')
      if (mouseLoc) gl.uniform2f(mouseLoc, mouseRef.current[0], mouseRef.current[1])

      gl.drawArrays(gl.TRIANGLES, 0, 6)
      animRef.current = requestAnimationFrame(render)
    }
    animRef.current = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(animRef.current)
      window.removeEventListener('mousemove', handleMouseMove)
      ro.disconnect()
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(buffer)
    }
  }, [rotation, speed, colors, transparent, autoRotate, scale, frequency, warpStrength, mouseInfluence, parallax, noise, handleMouseMove])

  return (
    <canvas
      ref={canvasRef}
      className="colorbends-canvas"
    />
  )
}
