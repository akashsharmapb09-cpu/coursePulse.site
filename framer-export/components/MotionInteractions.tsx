import { forwardRef, type ComponentType } from "react"
import { useMotionValue, useSpring, useReducedMotion, useScroll, useTransform } from "framer-motion"

export function withCursorTilt(Component: ComponentType<any>): ComponentType<any> {
    return forwardRef<any, any>(function CursorTilt(props, ref) {
        const { style, onPointerMove: originalMove, onPointerLeave: originalLeave, ...rest } = props
        const reducedMotion = useReducedMotion()
        const rawX = useMotionValue(0)
        const rawY = useMotionValue(0)
        const rotateX = useSpring(rawX, { stiffness: 220, damping: 25, mass: 0.65 })
        const rotateY = useSpring(rawY, { stiffness: 220, damping: 25, mass: 0.65 })

        const handleMove = (event: any) => {
            originalMove?.(event)
            if (reducedMotion || event.pointerType === "touch") return
            const rect = event.currentTarget.getBoundingClientRect()
            if (!rect.width || !rect.height) return
            const px = (event.clientX - rect.left) / rect.width - 0.5
            const py = (event.clientY - rect.top) / rect.height - 0.5
            rawX.set(-py * 7)
            rawY.set(px * 9)
        }

        const handleLeave = (event: any) => {
            rawX.set(0)
            rawY.set(0)
            originalLeave?.(event)
        }

        return (
            <Component
                {...rest}
                ref={ref}
                onPointerMove={handleMove}
                onPointerLeave={handleLeave}
                style={{
                    ...style,
                    transformPerspective: 1100,
                    transformStyle: "preserve-3d",
                    rotateX: reducedMotion ? 0 : rotateX,
                    rotateY: reducedMotion ? 0 : rotateY,
                    willChange: reducedMotion ? style?.willChange : "transform",
                }}
            />
        )
    })
}

export function withMagneticButton(Component: ComponentType<any>): ComponentType<any> {
    return forwardRef<any, any>(function MagneticButton(props, ref) {
        const { style, onPointerMove: originalMove, onPointerLeave: originalLeave, ...rest } = props
        const reducedMotion = useReducedMotion()
        const rawX = useMotionValue(0)
        const rawY = useMotionValue(0)
        const x = useSpring(rawX, { stiffness: 360, damping: 24, mass: 0.45 })
        const y = useSpring(rawY, { stiffness: 360, damping: 24, mass: 0.45 })

        const handleMove = (event: any) => {
            originalMove?.(event)
            if (reducedMotion || event.pointerType === "touch") return
            const rect = event.currentTarget.getBoundingClientRect()
            if (!rect.width || !rect.height) return
            const dx = (event.clientX - (rect.left + rect.width / 2)) * 0.18
            const dy = (event.clientY - (rect.top + rect.height / 2)) * 0.18
            rawX.set(Math.max(-7, Math.min(7, dx)))
            rawY.set(Math.max(-6, Math.min(6, dy)))
        }

        const handleLeave = (event: any) => {
            rawX.set(0)
            rawY.set(0)
            originalLeave?.(event)
        }

        return (
            <Component
                {...rest}
                ref={ref}
                onPointerMove={handleMove}
                onPointerLeave={handleLeave}
                whileHover={reducedMotion ? undefined : { scale: 1.035, y: -2 }}
                whileTap={reducedMotion ? undefined : { scale: 0.97 }}
                transition={{ type: "spring", stiffness: 340, damping: 25, mass: 0.55 }}
                style={{
                    ...style,
                    x: reducedMotion ? 0 : x,
                    y: reducedMotion ? 0 : y,
                    willChange: reducedMotion ? style?.willChange : "transform",
                }}
            />
        )
    })
}

export function withScrollNav(Component: ComponentType<any>): ComponentType<any> {
    return forwardRef<any, any>(function ScrollNav(props, ref) {
        const { style, ...rest } = props
        const reducedMotion = useReducedMotion()
        const { scrollY } = useScroll()
        const rawBackground = useTransform(scrollY, [0, 64], [0.78, 0.97])
        const backgroundOpacity = useSpring(rawBackground, { stiffness: 260, damping: 32, mass: 0.72 })
        const rawShadow = useTransform(scrollY, [0, 64], [0, 1])
        const shadowProgress = useSpring(rawShadow, { stiffness: 260, damping: 32, mass: 0.72 })
        const backgroundColor = useTransform(backgroundOpacity, value => 'rgba(255, 255, 255, ' + value + ')')
        const boxShadow = useTransform(shadowProgress, value => '0 10px 30px rgba(18,59,43,' + (value * 0.075) + ')')
        return (
            <Component
                {...rest}
                ref={ref}
                style={{
                    ...style,
                    backgroundColor: reducedMotion ? '#FFFFFF' : backgroundColor,
                    boxShadow: reducedMotion ? 'none' : boxShadow,
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    borderBottom: '1px solid rgba(220,231,216,0.9)',
                    zIndex: 50,
                    willChange: reducedMotion ? style?.willChange : 'background-color, box-shadow',
                }}
            />
        )
    })
}