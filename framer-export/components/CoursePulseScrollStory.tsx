import { useEffect, useRef, useState, type CSSProperties } from "react"
import { addPropertyControls, ControlType } from "framer"
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion"

interface CoursePulseScrollStoryProps {
    accentColor: string
    style?: CSSProperties
}

const STEPS = [
    {
        number: "01",
        eyebrow: "ORGANISE COURSES",
        title: "Start with the right course context.",
        body: "Set up the course workspace and make the right feedback forms available to eligible students.",
        tag: "COURSE WORKSPACE",
    },
    {
        number: "02",
        eyebrow: "COLLECT STUDENT VOICE",
        title: "Give every student a clear way to respond.",
        body: "Students share their experience through structured feedback forms designed around the course.",
        tag: "STUDENT FEEDBACK",
    },
    {
        number: "03",
        eyebrow: "UNDERSTAND PATTERNS",
        title: "See the themes behind the responses.",
        body: "Review course-level trends, rating distributions and aggregate patterns without exposing individual answers.",
        tag: "AGGREGATE INSIGHTS",
    },
    {
        number: "04",
        eyebrow: "IMPROVE WITH CONTEXT",
        title: "Turn feedback into a better conversation.",
        body: "Use the shared picture to guide thoughtful academic discussions and the next course feedback cycle.",
        tag: "COURSE IMPROVEMENT",
    },
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const colors = {
    pine: "#123B2B",
    forest: "#176B45",
    emerald: "#16834F",
    leaf: "#7DAA7C",
    sage: "#EAF3E8",
    pale: "#F5F8F2",
    line: "#DCE7DC",
    text: "#294B34",
    muted: "#6C7D70",
}

function TinyDot({ color = "#7BAA7D" }: { color?: string }) {
    return <span style={{ width: 6, height: 6, borderRadius: 99, background: color, display: "inline-block", flex: "0 0 auto" }} />
}

function WindowBar({ label }: { label: string }) {
    return (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, paddingBottom: 13, borderBottom: "1px solid #EDF1EA" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                {[ "#E5ECE3", "#E5ECE3", "#E5ECE3" ].map((c, i) => <span key={i} style={{ width: 6, height: 6, borderRadius: 99, background: c }} />)}
                <span style={{ marginLeft: 5, color: colors.pine, font: "800 9px Manrope, Inter, sans-serif", letterSpacing: "0.04em" }}>COURSEPULSE</span>
            </div>
            <span style={{ color: colors.forest, background: "#EDF5EA", border: "1px solid #DDEBDD", borderRadius: 5, padding: "4px 7px", font: "800 7px Manrope, Inter, sans-serif", letterSpacing: "0.06em" }}>{label}</span>
        </div>
    )
}

function FormPreview() {
    return (
        <div style={{ display: "grid", gap: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                    <div style={{ color: "#829084", font: "700 8px Manrope, Inter, sans-serif", letterSpacing: "0.07em" }}>COURSE FEEDBACK</div>
                    <div style={{ color: colors.pine, font: "700 16px Satoshi, Inter, sans-serif", marginTop: 4 }}>Foundations of Learning</div>
                </div>
                <div style={{ borderRadius: 7, background: "#F3F7F1", border: "1px solid #E5ECE2", padding: "7px 9px", color: colors.muted, font: "700 8px Manrope, Inter, sans-serif" }}>FORM 01</div>
            </div>
            <div style={{ border: "1px solid #E5ECE2", borderRadius: 10, padding: 13, background: "#FBFCFA" }}>
                <div style={{ color: colors.text, font: "700 11px Manrope, Inter, sans-serif", lineHeight: 1.45 }}>How clear were the course learning goals?</div>
                <div style={{ color: "#879488", font: "500 8px Manrope, Inter, sans-serif", marginTop: 4 }}>Select the response that best reflects your experience.</div>
                <div style={{ display: "flex", gap: 7, marginTop: 13 }}>
                    {["1", "2", "3", "4", "5"].map((n, i) => (
                        <div key={n} style={{ flex: 1, height: 31, display: "grid", placeItems: "center", borderRadius: 7, border: i === 3 ? "1px solid #A9CBA6" : "1px solid #E3EBE1", background: i === 3 ? "#E6F1E2" : "#FFFFFF", color: i === 3 ? colors.forest : "#718174", font: "800 9px Manrope, Inter, sans-serif" }}>{n}</div>
                    ))}
                </div>
            </div>
            <div style={{ border: "1px solid #E5ECE2", borderRadius: 10, padding: 13, background: "#FFFFFF" }}>
                <div style={{ color: colors.text, font: "700 10px Manrope, Inter, sans-serif" }}>Anything else you would like to share?</div>
                <div style={{ marginTop: 9, height: 33, border: "1px solid #EEF2EC", borderRadius: 6, background: "#FCFDFC" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#829084", font: "600 8px Manrope, Inter, sans-serif" }}>Structured student feedback</span>
                <span style={{ background: colors.forest, color: "#FFFFFF", borderRadius: 100, padding: "7px 12px", font: "800 8px Manrope, Inter, sans-serif" }}>Continue</span>
            </div>
        </div>
    )
}

function CoursePreview() {
    const rows = [
        ["Foundations of Learning", "Feedback open"],
        ["Learning Design", "In progress"],
        ["Education Research", "Course workspace"],
    ]
    return (
        <div style={{ display: "grid", gap: 10 }}>
            <div>
                <div style={{ color: "#829084", font: "800 8px Manrope, Inter, sans-serif", letterSpacing: "0.07em" }}>INSTRUCTOR WORKSPACE</div>
                <div style={{ color: colors.pine, font: "700 16px Satoshi, Inter, sans-serif", marginTop: 4 }}>Your courses</div>
            </div>
            {rows.map(([name, status], index) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: 12, border: "1px solid #E5ECE2", borderRadius: 9, background: index === 0 ? "#F5F9F3" : "#FFFFFF" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                        <span style={{ width: 28, height: 28, flex: "0 0 auto", display: "grid", placeItems: "center", borderRadius: 7, background: "#E9F2E6", color: colors.forest, font: "800 9px Manrope, Inter, sans-serif" }}>0{index + 1}</span>
                        <span style={{ color: colors.text, font: "700 9px Manrope, Inter, sans-serif", lineHeight: 1.35 }}>{name}</span>
                    </div>
                    <span style={{ flex: "0 0 auto", color: index === 0 ? "#35784A" : "#78877A", font: "700 7px Manrope, Inter, sans-serif", whiteSpace: "nowrap" }}>{status}</span>
                </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 1px" }}>
                <span style={{ color: "#829084", font: "600 8px Manrope, Inter, sans-serif" }}>Role-aware course access</span>
                <TinyDot />
            </div>
        </div>
    )
}

function InsightsPreview() {
    return (
        <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 8 }}>
                <div>
                    <div style={{ color: "#829084", font: "800 8px Manrope, Inter, sans-serif", letterSpacing: "0.07em" }}>AGGREGATE REPORT</div>
                    <div style={{ color: colors.pine, font: "700 16px Satoshi, Inter, sans-serif", marginTop: 4 }}>Course insights</div>
                </div>
                <span style={{ color: "#728476", font: "700 7px Manrope, Inter, sans-serif", background: "#F4F7F2", padding: "5px 7px", borderRadius: 5 }}>SAMPLE VIEW</span>
            </div>
            <div style={{ border: "1px solid #E5ECE2", borderRadius: 9, padding: 11, background: "#FFFFFF" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#718174", font: "700 8px Manrope, Inter, sans-serif" }}>
                    <span>Response pattern</span><span>Illustrative</span>
                </div>
                <svg viewBox="0 0 320 92" width="100%" height="100" preserveAspectRatio="none" style={{ display: "block", marginTop: 8 }}>
                    {[18, 42, 66].map(y => <line key={y} x1="2" y1={y} x2="318" y2={y} stroke="#EDF2EC" strokeWidth="1" />)}
                    <path d="M4 67 C31 63 35 48 67 52 S109 58 132 38 S173 49 194 31 S232 42 254 20 S291 33 316 15 L316 83 L4 83 Z" fill="#EAF3E8" />
                    <path d="M4 67 C31 63 35 48 67 52 S109 58 132 38 S173 49 194 31 S232 42 254 20 S291 33 316 15" fill="none" stroke={colors.forest} strokeWidth="2.7" strokeLinecap="round" />
                    <circle cx="316" cy="15" r="3.5" fill="#FFFFFF" stroke={colors.forest} strokeWidth="2" />
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#89968B", font: "600 7px Manrope, Inter, sans-serif" }}><span>Earlier</span><span>Recent</span></div>
            </div>
            <div style={{ display: "grid", gap: 9 }}>
                {[
                    ["Course clarity", "78%"],
                    ["Learning pace", "64%"],
                    ["Course resources", "52%"],
                ].map(([label, value], i) => (
                    <div key={label} style={{ display: "grid", gridTemplateColumns: "105px 1fr 28px", alignItems: "center", gap: 8 }}>
                        <span style={{ color: "#64766A", font: "700 7px Manrope, Inter, sans-serif" }}>{label}</span>
                        <span style={{ height: 5, background: "#EAF0E8", borderRadius: 9, overflow: "hidden" }}><span style={{ display: "block", width: value, height: "100%", background: i === 0 ? colors.forest : "#85AA85", borderRadius: 9 }} /></span>
                        <span style={{ textAlign: "right", color: "#526B59", font: "800 7px Manrope, Inter, sans-serif" }}>{value}</span>
                    </div>
                ))}
            </div>
            <div style={{ color: "#8A968C", font: "600 7px Manrope, Inter, sans-serif" }}>Illustrative sample data · no individual answers shown</div>
        </div>
    )
}

function ImprovementPreview() {
    return (
        <div style={{ display: "grid", gap: 12 }}>
            <div>
                <div style={{ color: "#829084", font: "800 8px Manrope, Inter, sans-serif", letterSpacing: "0.07em" }}>COURSE REVIEW</div>
                <div style={{ color: colors.pine, font: "700 16px Satoshi, Inter, sans-serif", marginTop: 4 }}>Bring the picture together</div>
            </div>
            {[
                ["Review the response themes", "Discuss the aggregate patterns with the course team."],
                ["Consider the course experience", "Use student perspectives to guide the conversation."],
                ["Plan the next feedback cycle", "Keep the next review grounded in course context."],
            ].map(([title, description], index) => (
                <div key={title} style={{ display: "flex", gap: 10, alignItems: "start", padding: 12, border: "1px solid #E5ECE2", borderRadius: 9, background: "#FFFFFF" }}>
                    <span style={{ width: 22, height: 22, display: "grid", placeItems: "center", borderRadius: 7, background: "#E9F2E6", color: colors.forest, font: "800 8px Manrope, Inter, sans-serif", flex: "0 0 auto" }}>{index + 1}</span>
                    <span style={{ display: "grid", gap: 4 }}>
                        <span style={{ color: colors.text, font: "700 9px Manrope, Inter, sans-serif" }}>{title}</span>
                        <span style={{ color: "#718174", font: "500 8px Manrope, Inter, sans-serif", lineHeight: 1.45 }}>{description}</span>
                    </span>
                </div>
            ))}
            <div style={{ padding: "9px 11px", borderRadius: 7, background: "#EAF3E8", color: "#466A4D", font: "700 8px Manrope, Inter, sans-serif" }}>A thoughtful next step starts with a clear shared view.</div>
        </div>
    )
}

function StageScreen({ index }: { index: number }) {
    const screens = [<CoursePreview />, <FormPreview />, <InsightsPreview />, <ImprovementPreview />]
    return <>{screens[index] ?? screens[0]}</>
}

/**
 * Sticky side preview + scroll-driven four-step product story.
 * Desktop/tablet pin the product visual while the steps scroll beside it.
 * Phone reflows to a single column and keeps the same active-step storytelling.
 */
// @framerSupportedLayoutWidth any
// @framerSupportedLayoutHeight auto
export default function CoursePulseScrollStory({
    accentColor = "#176B45",
    style,
}: CoursePulseScrollStoryProps) {
    const [activeStep, setActiveStep] = useState(0)
    const [isMobile, setIsMobile] = useState(false)
    const [isTablet, setIsTablet] = useState(false)
    const stepsRef = useRef<HTMLDivElement>(null)
    const reducedMotion = useReducedMotion()

    const { scrollYProgress } = useScroll({
        target: stepsRef,
        offset: ["start 72%", "end 28%"],
    })

    useMotionValueEvent(scrollYProgress, "change", (value) => {
        setActiveStep(clamp(Math.floor(value * STEPS.length), 0, STEPS.length - 1))
    })

    useEffect(() => {
        const mobile = window.matchMedia("(max-width: 700px)")
        const tablet = window.matchMedia("(max-width: 1040px)")
        const update = () => {
            setIsMobile(mobile.matches)
            setIsTablet(tablet.matches && !mobile.matches)
        }
        update()
        mobile.addEventListener?.("change", update)
        tablet.addEventListener?.("change", update)
        return () => {
            mobile.removeEventListener?.("change", update)
            tablet.removeEventListener?.("change", update)
        }
    }, [])

    const storyTransition = reducedMotion
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 230, damping: 25, mass: 0.82 }

    const visualHeight = isMobile ? 390 : isTablet ? 455 : 520

    return (
        <section
            aria-label="How CoursePulse works"
            style={{
                width: "100%",
                maxWidth: 1160,
                margin: "0 auto",
                padding: isMobile ? "62px 19px 68px" : "86px 24px 94px",
                boxSizing: "border-box",
                color: colors.pine,
                ...style,
            }}
        >
            <div style={{ maxWidth: 770, marginBottom: isMobile ? 25 : 37 }}>
                <div style={{
                    color: accentColor,
                    font: "800 10px Manrope, Inter, sans-serif",
                    letterSpacing: "0.13em",
                    lineHeight: 1.3,
                    textTransform: "uppercase",
                    marginBottom: 13,
                }}>A SIMPLE, REPEATABLE PROCESS</div>
                <h2 style={{
                    margin: 0,
                    color: colors.pine,
                    font: `700 ${isMobile ? 34 : isTablet ? 40 : 46}px/1.06 Satoshi, Inter, sans-serif`,
                    letterSpacing: "-0.045em",
                    maxWidth: 700,
                }}>From student voice to better decisions.</h2>
                <p style={{
                    margin: "14px 0 0",
                    maxWidth: 650,
                    color: colors.muted,
                    font: `${isMobile ? 13 : 14}px/1.65 Manrope, Inter, sans-serif`,
                }}>Follow the feedback cycle as it moves through the CoursePulse workspace—from course setup to student responses, aggregate insights and the next course conversation.</p>
            </div>

            <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "minmax(0, 1fr)" : isTablet ? "minmax(0, 0.92fr) minmax(0, 1.08fr)" : "minmax(0, 0.96fr) minmax(0, 1.04fr)",
                alignItems: "start",
                gap: isMobile ? 23 : isTablet ? 24 : 42,
            }}>
                {/* Sticky product visual */}
                <div style={{
                    position: isMobile ? "relative" : "sticky",
                    top: isMobile ? "auto" : 98,
                    alignSelf: "start",
                    minWidth: 0,
                    zIndex: 1,
                }}>
                    <div style={{
                        height: visualHeight,
                        boxSizing: "border-box",
                        border: "1px solid #D9E6D8",
                        borderRadius: isMobile ? 17 : 22,
                        padding: isMobile ? 13 : 17,
                        background: "linear-gradient(150deg, #F4F8F1 0%, #EAF3E8 100%)",
                        boxShadow: "0 16px 42px rgba(18,59,43,0.075), 0 2px 6px rgba(18,59,43,0.035)",
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                    }}>
                        <WindowBar label={STEPS[activeStep].tag} />
                        <div style={{
                            position: "relative",
                            flex: 1,
                            minHeight: 0,
                            paddingTop: 15,
                        }}>
                            <AnimatePresence mode="wait" initial={false}>
                                <motion.div
                                    key={activeStep}
                                    initial={reducedMotion ? false : { opacity: 0, y: 12, filter: "blur(3px)" }}
                                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                                    exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(2px)" }}
                                    transition={storyTransition}
                                    style={{
                                        height: "100%",
                                        borderRadius: 12,
                                        border: "1px solid #E3EBE1",
                                        padding: isMobile ? 11 : 14,
                                        boxSizing: "border-box",
                                        background: "#FFFFFF",
                                        overflow: "auto",
                                    }}
                                >
                                    <StageScreen index={activeStep} />
                                </motion.div>
                            </AnimatePresence>
                        </div>
                        <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                            paddingTop: 12,
                            color: "#6F8272",
                            font: "700 8px Manrope, Inter, sans-serif",
                            letterSpacing: "0.08em",
                        }}>
                            <span>PRODUCT WALKTHROUGH</span>
                            <span style={{ color: colors.forest }}>{String(activeStep + 1).padStart(2, "0")} / 04</span>
                        </div>
                        <div style={{ height: 3, background: "#DCE8D9", borderRadius: 99, overflow: "hidden", marginTop: 8 }}>
                            <motion.div
                                animate={{ width: `${((activeStep + 1) / STEPS.length) * 100}%` }}
                                transition={storyTransition}
                                style={{ height: "100%", background: accentColor, borderRadius: 99 }}
                            />
                        </div>
                    </div>
                    {!isMobile && (
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 12, color: "#839084", font: "600 9px Manrope, Inter, sans-serif" }}>
                            <TinyDot color={accentColor} />
                            Scroll to explore each stage
                        </div>
                    )}
                </div>

                {/* Scroll-driven story steps */}
                <div ref={stepsRef} style={{ display: "grid", gap: isMobile ? 12 : 18, minWidth: 0 }}>
                    {STEPS.map((step, index) => {
                        const active = activeStep === index
                        return (
                            <motion.article
                                key={step.number}
                                initial={false}
                                animate={{
                                    opacity: active ? 1 : 0.72,
                                    y: active || reducedMotion ? 0 : 4,
                                    borderColor: active ? "#9DBD9D" : "#E2EAE0",
                                    backgroundColor: active ? "#F1F7EF" : "#FFFFFF",
                                    boxShadow: active ? "0 10px 28px rgba(18,59,43,0.075)" : "0 2px 8px rgba(18,59,43,0.025)",
                                }}
                                transition={storyTransition}
                                style={{
                                    minHeight: isMobile ? 178 : isTablet ? 208 : 232,
                                    boxSizing: "border-box",
                                    border: "1px solid #E2EAE0",
                                    borderRadius: 17,
                                    padding: isMobile ? 17 : 21,
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "space-between",
                                    gap: 20,
                                    position: "relative",
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                                    <span style={{
                                        color: active ? accentColor : "#849387",
                                        font: "800 9px Manrope, Inter, sans-serif",
                                        letterSpacing: "0.12em",
                                    }}>{step.eyebrow}</span>
                                    <span style={{
                                        color: active ? "#FFFFFF" : "#6E826F",
                                        background: active ? accentColor : "#EFF4EC",
                                        width: 29,
                                        height: 29,
                                        display: "grid",
                                        placeItems: "center",
                                        borderRadius: 9,
                                        font: "800 9px Manrope, Inter, sans-serif",
                                        flex: "0 0 auto",
                                    }}>{step.number}</span>
                                </div>
                                <div>
                                    <h3 style={{
                                        margin: 0,
                                        color: colors.pine,
                                        font: `700 ${isMobile ? 19 : 22}px/1.16 Satoshi, Inter, sans-serif`,
                                        letterSpacing: "-0.025em",
                                    }}>{step.title}</h3>
                                    <p style={{
                                        margin: "9px 0 0",
                                        color: "#65786A",
                                        font: `${isMobile ? 11 : 12}px/1.65 Manrope, Inter, sans-serif`,
                                        maxWidth: 430,
                                    }}>{step.body}</p>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                    <span style={{ height: 1, width: active ? 28 : 17, background: active ? accentColor : "#CBD9CA", transition: reducedMotion ? "none" : "width 220ms ease" }} />
                                    <span style={{ color: active ? "#41694B" : "#869387", font: "800 8px Manrope, Inter, sans-serif", letterSpacing: "0.07em" }}>{step.tag}</span>
                                </div>
                            </motion.article>
                        )
                    })}
                </div>
            </div>
            <div style={{
                marginTop: 19,
                color: "#859287",
                font: "600 8px/1.5 Manrope, Inter, sans-serif",
            }}>Interface visuals are illustrative previews of the CoursePulse feedback workflow.</div>
        </section>
    )
}

addPropertyControls(CoursePulseScrollStory, {
    accentColor: {
        type: ControlType.Color,
        title: "Accent",
        defaultValue: "#176B45",
    },
})
