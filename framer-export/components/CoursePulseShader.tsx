import { useEffect, useRef, type CSSProperties } from "react"
import { addPropertyControls, ControlType } from "framer"

interface CoursePulseShaderProps {
    speed?: number
    style?: CSSProperties
}

// @framerSupportedLayoutWidth any
// @framerSupportedLayoutHeight any
export default function CoursePulseShader({ speed = 1, style }: CoursePulseShaderProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const gl = canvas.getContext("webgl", {
            alpha: true,
            antialias: false,
            depth: false,
            stencil: false,
            powerPreference: "low-power",
        })
        if (!gl) return

        const vertexSource = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
}`

        const fragmentSource = `
precision mediump float;
varying vec2 vUv;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
        value += amplitude * noise(p);
        p = p * 2.03 + vec2(17.2, 9.1);
        amplitude *= 0.5;
    }
    return value;
}
void main() {
    vec2 uv = vUv;
    vec2 p = (uv - 0.5) * vec2(uResolution.x / max(uResolution.y, 1.0), 1.0);
    float time = uTime * 0.075;
    float field = fbm(p * 2.1 + vec2(time, -time * 0.7));
    float wave = sin((p.x * 2.1 + field * 1.4 + uPointer.x * 0.18 + time) * 3.0);
    float ribbon = exp(-abs(p.y + (field - 0.5) * 0.35 + wave * 0.035) * 5.4);
    float halo = exp(-length((p - vec2(uPointer.x * 0.22, uPointer.y * 0.13)) * vec2(0.72, 1.2)) * 2.4);
    float grain = noise(uv * uResolution * 0.32) * 0.035;
    vec3 deep = vec3(0.012, 0.070, 0.045);
    vec3 forest = vec3(0.055, 0.265, 0.145);
    vec3 leaf = vec3(0.30, 0.62, 0.37);
    vec3 light = vec3(0.82, 0.92, 0.62);
    vec3 color = mix(deep, forest, smoothstep(0.12, 0.88, field));
    color = mix(color, leaf, ribbon * 0.44);
    color += light * halo * 0.10;
    color += grain;
    float vignette = smoothstep(1.15, 0.15, length((uv - 0.5) * vec2(1.25, 1.0)));
    gl_FragColor = vec4(color * (0.78 + vignette * 0.22), 0.94);
}
`

        const compile = (type: number, source: string) => {
            const shader = gl.createShader(type)
            if (!shader) return null
            gl.shaderSource(shader, source)
            gl.compileShader(shader)
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                gl.deleteShader(shader)
                return null
            }
            return shader
        }

        const vertex = compile(gl.VERTEX_SHADER, vertexSource)
        const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
        if (!vertex || !fragment) {
            if (vertex) gl.deleteShader(vertex)
            if (fragment) gl.deleteShader(fragment)
            return
        }

        const program = gl.createProgram()
        if (!program) {
            gl.deleteShader(vertex)
            gl.deleteShader(fragment)
            return
        }
        gl.attachShader(program, vertex)
        gl.attachShader(program, fragment)
        gl.linkProgram(program)
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            gl.deleteProgram(program)
            gl.deleteShader(vertex)
            gl.deleteShader(fragment)
            return
        }

        const buffer = gl.createBuffer()
        if (!buffer) {
            gl.deleteProgram(program)
            gl.deleteShader(vertex)
            gl.deleteShader(fragment)
            return
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1, 1, -1, -1, 1,
            -1, 1, 1, -1, 1, 1,
        ]), gl.STATIC_DRAW)

        gl.useProgram(program)
        const position = gl.getAttribLocation(program, "aPosition")
        gl.enableVertexAttribArray(position)
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

        const resolution = gl.getUniformLocation(program, "uResolution")
        const pointer = gl.getUniformLocation(program, "uPointer")
        const time = gl.getUniformLocation(program, "uTime")
        const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
        const compactQuery = window.matchMedia("(max-width: 760px)")
        const pointerPosition = { x: 0, y: 0 }
        let width = 1
        let height = 1
        let frame = 0
        let visible = true
        let disposed = false

        const resize = () => {
            const ratio = Math.min(window.devicePixelRatio || 1, compactQuery.matches ? 1 : 1.35)
            width = Math.max(1, Math.floor(canvas.clientWidth * ratio))
            height = Math.max(1, Math.floor(canvas.clientHeight * ratio))
            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width
                canvas.height = height
            }
            gl.viewport(0, 0, width, height)
            gl.uniform2f(resolution, width, height)
        }

        const draw = (seconds: number) => {
            if (disposed) return
            gl.uniform1f(time, seconds * Math.max(0, speed))
            gl.uniform2f(pointer, pointerPosition.x, pointerPosition.y)
            gl.drawArrays(gl.TRIANGLES, 0, 6)
        }

        const stop = () => {
            if (frame) window.cancelAnimationFrame(frame)
            frame = 0
        }

        const loop = (timestamp: number) => {
            if (disposed || reducedMotionQuery.matches || !visible || document.hidden) {
                frame = 0
                return
            }
            draw(timestamp * 0.001)
            frame = window.requestAnimationFrame(loop)
        }

        const start = () => {
            if (reducedMotionQuery.matches) {
                draw(2.4)
                return
            }
            if (!frame && visible && !document.hidden) frame = window.requestAnimationFrame(loop)
        }

        const onPointerMove = (event: PointerEvent) => {
            if (event.pointerType === "touch") return
            const bounds = canvas.getBoundingClientRect()
            pointerPosition.x = ((event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 2
            pointerPosition.y = (0.5 - (event.clientY - bounds.top) / Math.max(bounds.height, 1)) * 2
        }
        const onPointerLeave = () => {
            pointerPosition.x = 0
            pointerPosition.y = 0
        }
        const onVisibility = () => {
            if (document.hidden) stop()
            else start()
        }
        const onMotionPreference = () => {
            stop()
            if (reducedMotionQuery.matches) draw(2.4)
            else start()
        }

        resize()
        const observer = typeof IntersectionObserver !== "undefined"
            ? new IntersectionObserver((entries) => {
                visible = entries.some((entry) => entry.isIntersecting)
                if (visible) start()
                else stop()
            }, { threshold: 0.01 })
            : null
        observer?.observe(canvas)
        canvas.addEventListener("pointermove", onPointerMove, { passive: true })
        canvas.addEventListener("pointerleave", onPointerLeave, { passive: true })
        document.addEventListener("visibilitychange", onVisibility)
        window.addEventListener("resize", resize, { passive: true })
        reducedMotionQuery.addEventListener?.("change", onMotionPreference)
        start()

        return () => {
            disposed = true
            stop()
            observer?.disconnect()
            canvas.removeEventListener("pointermove", onPointerMove)
            canvas.removeEventListener("pointerleave", onPointerLeave)
            document.removeEventListener("visibilitychange", onVisibility)
            window.removeEventListener("resize", resize)
            reducedMotionQuery.removeEventListener?.("change", onMotionPreference)
            gl.deleteBuffer(buffer)
            gl.deleteProgram(program)
            gl.deleteShader(vertex)
            gl.deleteShader(fragment)
        }
    }, [speed])

    return (
        <div style={{
            position: "relative",
            width: "100%",
            height: "100%",
            minHeight: 180,
            overflow: "hidden",
            background: "radial-gradient(ellipse at 50% 42%, #3B7850 0%, #245B3A 48%, #123522 100%)",
            ...style,
        }}>
            <canvas ref={canvasRef} aria-hidden="true" style={{
                display: "block",
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
            }} />
        </div>
    )
}

addPropertyControls(CoursePulseShader, {
    speed: {
        type: ControlType.Number,
        title: "Motion speed",
        defaultValue: 1,
        min: 0,
        max: 1.5,
        step: 0.05,
    },
})
