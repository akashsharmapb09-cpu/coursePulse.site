import { useMemo, useState, type CSSProperties } from "react"
import { addPropertyControls, ControlType } from "framer"
import { motion, useReducedMotion } from "framer-motion"

type ChartVariant = "trend" | "comparison" | "sparkline"

interface Props {
    variant: ChartVariant
    accentColor: string
    compact: boolean
    showLabels: boolean
    style?: CSSProperties
}

const PERIODS = ["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8", "W9"]
const TREND = [34, 48, 42, 61, 54, 72, 66, 86, 78]
const CATEGORIES = [
    { label: "Course clarity", value: 78 },
    { label: "Learning pace", value: 64 },
    { label: "Course resources", value: 52 },
]

const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value))

function linePath(points: Array<{ x: number; y: number }>) {
    if (!points.length) return ""
    return points.reduce((path, point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`
        const previous = points[index - 1]
        const midX = (previous.x + point.x) / 2
        return path + ` C ${midX} ${previous.y}, ${midX} ${point.y}, ${point.x} ${point.y}`
    }, "")
}

/**
 * Premium CoursePulse analytics visual system.
 * Uses a conventional time-series line, category comparison bars and compact sparkline.
 * All included values are labelled as illustrative sample data.
 */
// @framerSupportedLayoutWidth any
// @framerSupportedLayoutHeight any
export default function CoursePulseAnalyticsChart({
    variant = "trend",
    accentColor = "#176B45",
    compact = false,
    showLabels = true,
    style,
}: Props) {
    const [active, setActive] = useState<number | null>(null)
    const reducedMotion = useReducedMotion()
    const data = compact ? TREND.slice(2) : TREND

    const points = useMemo(() => {
        const left = variant === "sparkline" ? 8 : 42
        const right = 704
        const top = variant === "sparkline" ? 10 : 15
        const bottom = variant === "sparkline" ? 95 : 205
        const min = Math.min(...data)
        const max = Math.max(...data)
        const range = Math.max(1, max - min)
        return data.map((value, index) => ({
            x: left + (right - left) * (index / Math.max(1, data.length - 1)),
            y: bottom - ((value - (variant === "sparkline" ? min - 9 : 0)) / (variant === "sparkline" ? range + 18 : 100)) * (bottom - top),
            value,
        }))
    }, [data, variant])

    const path = useMemo(() => linePath(points), [points])
    const areaBottom = variant === "sparkline" ? 110 : 214
    const area = points.length
        ? path + ` L ${points[points.length - 1].x} ${areaBottom} L ${points[0].x} ${areaBottom} Z`
        : ""

    const activePoint = active === null ? null : points[active]
    const title = variant === "comparison" ? "Category comparison" : variant === "sparkline" ? "Response activity" : "Feedback response trend"

    return (
        <div
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minHeight: compact ? 105 : 205,
                display: "flex",
                flexDirection: "column",
                gap: compact ? 7 : 10,
                overflow: "hidden",
                background: "transparent",
                color: "#173B2B",
                fontFamily: "Manrope, Inter, sans-serif",
                ...style,
            }}
        >
            {variant !== "sparkline" && showLabels && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ color: "#284C35", fontSize: compact ? 11 : 13, fontWeight: 800, lineHeight: 1.2 }}>{title}</span>
                        <span style={{ color: "#78877B", fontSize: 9, fontWeight: 600, lineHeight: 1.3 }}>Relative index · sample data</span>
                    </div>
                    <span style={{
                        padding: "5px 8px",
                        border: "1px solid #DCE8DC",
                        borderRadius: 6,
                        background: "#F8FBF7",
                        color: "#66806A",
                        fontSize: 8,
                        fontWeight: 800,
                        letterSpacing: "0.055em",
                        whiteSpace: "nowrap",
                    }}>ILLUSTRATIVE</span>
                </div>
            )}

            {variant === "comparison" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: compact ? "4px 0" : "8px 0" }}>
                    {CATEGORIES.map((item, index) => (
                        <div key={item.label} style={{ display: "grid", gridTemplateColumns: compact ? "104px 1fr 27px" : "132px 1fr 30px", alignItems: "center", gap: 10 }}>
                            <span style={{ color: "#53685A", fontSize: compact ? 9 : 10, fontWeight: 700, lineHeight: 1.25 }}>{item.label}</span>
                            <div style={{ height: compact ? 7 : 9, background: "#E9F0E8", borderRadius: 3, overflow: "hidden" }}>
                                <motion.div
                                    initial={reducedMotion ? false : { width: 0 }}
                                    animate={{ width: `${item.value}%` }}
                                    transition={{ duration: reducedMotion ? 0 : 0.7, delay: reducedMotion ? 0 : index * 0.09, ease: [0.22, 1, 0.36, 1] }}
                                    style={{ height: "100%", borderRadius: 3, background: index === 0 ? accentColor : "#75A984" }}
                                />
                            </div>
                            <span style={{ color: "#365A40", fontSize: 9, fontWeight: 800, fontVariantNumeric: "tabular-nums", textAlign: "right" }}>{item.value}</span>
                        </div>
                    ))}
                    <span style={{ marginTop: 1, color: "#869388", fontSize: 8, fontWeight: 600 }}>Illustrative relative index · not live course results</span>
                </div>
            ) : (
                <div style={{ position: "relative", flex: 1, minHeight: 0, width: "100%" }}>
                    <svg
                        viewBox={variant === "sparkline" ? "0 0 720 125" : "0 0 720 238"}
                        width="100%"
                        height="100%"
                        preserveAspectRatio="none"
                        role="img"
                        aria-label="Illustrative feedback response trend over nine sample weeks"
                        style={{ display: "block", overflow: "visible" }}
                    >
                        {variant === "trend" && [0, 25, 50, 75, 100].map((tick) => {
                            const y = 205 - (tick / 100) * 190
                            return (
                                <g key={tick}>
                                    <line x1="42" y1={y} x2="704" y2={y} stroke={tick === 0 ? "#C7D4C8" : "#E7EEE7"} strokeWidth={tick === 0 ? 1.2 : 1} />
                                    <text x="28" y={y + 3} textAnchor="end" fill="#849186" fontSize="9" fontFamily="Manrope, Inter, sans-serif">{tick}</text>
                                </g>
                            )
                        })}

                        <defs>
                            <linearGradient id="cpTrendArea" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor={accentColor} stopOpacity="0.16" />
                                <stop offset="100%" stopColor={accentColor} stopOpacity="0.015" />
                            </linearGradient>
                        </defs>

                        {true && (
                            <path d={area} fill="#EAF3E8" opacity={variant === "sparkline" ? 0.72 : 1} />
                        )}

                        <motion.path
                            d={path}
                            fill="none"
                            stroke={accentColor}
                            strokeWidth={variant === "sparkline" ? 4.8 : 3.2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                            initial={reducedMotion ? false : { pathLength: 0, opacity: 0.65 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{ duration: reducedMotion ? 0 : 1.05, ease: [0.22, 1, 0.36, 1] }}
                        />

                        {points.map((point, index) => (
                            <g key={index}>
                                {variant === "trend" && (
                                    <line x1={point.x} y1={point.y + 10} x2={point.x} y2="205" stroke={active === index ? "#9EB9A2" : "transparent"} strokeDasharray="3 4" strokeWidth="1" />
                                )}
                                <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={active === index ? 6 : variant === "sparkline" ? 0 : 4}
                                    fill="#FFFFFF"
                                    stroke={accentColor}
                                    strokeWidth={active === index ? 2.6 : 2}
                                    tabIndex={0}
                                    onMouseEnter={() => setActive(index)}
                                    onMouseLeave={() => setActive(null)}
                                    onFocus={() => setActive(index)}
                                    onBlur={() => setActive(null)}
                                    style={{ outline: "none", cursor: "crosshair" }}
                                />
                                {variant === "trend" && (
                                    <text x={point.x} y="226" textAnchor="middle" fill="#78877B" fontSize="9" fontWeight="700" fontFamily="Manrope, Inter, sans-serif">{PERIODS[index]}</text>
                                )}
                            </g>
                        ))}

                        {variant === "sparkline" && points.length > 0 && (
                            <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="5" fill={accentColor} stroke="#FFFFFF" strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
                        )}

                        {variant === "trend" && activePoint && (
                            <g>
                                <rect x={clamp(activePoint.x - 48, 42, 610)} y={clamp(activePoint.y - 42, 4, 160)} width="96" height="27" rx="6" fill="#173B2B" />
                                <text x={clamp(activePoint.x, 90, 658)} y={clamp(activePoint.y - 25, 21, 177)} textAnchor="middle" fill="#FFFFFF" fontSize="9" fontWeight="700" fontFamily="Manrope, Inter, sans-serif">
                                    {PERIODS[active] + " · " + activePoint.value + " index"}
                                </text>
                            </g>
                        )}
                    </svg>
                    {variant === "sparkline" && showLabels && (
                        <div style={{ position: "absolute", top: 0, right: 0, color: "#849186", fontSize: 8, fontWeight: 800, letterSpacing: "0.05em" }}>SAMPLE TREND</div>
                    )}
                </div>
            )}
        </div>
    )
}

addPropertyControls(CoursePulseAnalyticsChart, {
    variant: {
        type: ControlType.Enum,
        title: "Chart type",
        options: ["trend", "comparison", "sparkline"],
        optionTitles: ["Trend line", "Category bars", "Sparkline"],
        defaultValue: "trend",
    },
    accentColor: {
        type: ControlType.Color,
        title: "Accent",
        defaultValue: "#176B45",
    },
    compact: {
        type: ControlType.Boolean,
        title: "Compact",
        defaultValue: false,
    },
    showLabels: {
        type: ControlType.Boolean,
        title: "Labels",
        defaultValue: true,
    },
})
