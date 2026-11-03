import { CSSProperties } from "react"
import { addPropertyControls, ControlType } from "framer"
import { motion, useReducedMotion, useScroll, useSpring } from "framer-motion"

interface CoursePulseScrollProgressProps {
    color?: string
    trackColor?: string
    style?: CSSProperties
}

// @framerSupportedLayoutWidth any
// @framerSupportedLayoutHeight fixed
export default function CoursePulseScrollProgress({
    color = "#C9F36A",
    trackColor = "rgba(18,59,43,0.08)",
    style,
}: CoursePulseScrollProgressProps) {
    const reducedMotion = useReducedMotion()
    const { scrollYProgress } = useScroll()
    const progress = useSpring(scrollYProgress, {
        stiffness: 210,
        damping: 32,
        mass: 0.65,
    })

    return (
        <div
            aria-hidden="true"
            style={{
                position: "relative",
                width: "100%",
                height: 3,
                overflow: "hidden",
                background: trackColor,
                ...style,
            }}
        >
            <motion.div
                style={{
                    width: "100%",
                    height: "100%",
                    background: color,
                    transformOrigin: "left center",
                    scaleX: reducedMotion ? scrollYProgress : progress,
                    borderRadius: 99,
                    boxShadow: "0 0 9px rgba(201,243,106,0.30)",
                }}
            />
        </div>
    )
}


addPropertyControls(CoursePulseScrollProgress, {
    color: { type: ControlType.Color, title: "Progress", defaultValue: "#C9F36A" },
    trackColor: { type: ControlType.Color, title: "Track", defaultValue: "#EAF2E7" },
})
