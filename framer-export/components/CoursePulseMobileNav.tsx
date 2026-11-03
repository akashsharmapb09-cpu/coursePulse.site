import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

type NavItem = { label: string; href: string; id: string }

const items: NavItem[] = [
    { label: "Product", href: "/#product", id: "product" },
    { label: "Features", href: "/#features", id: "features" },
    { label: "Analytics", href: "/#analytics", id: "analytics" },
    { label: "How it works", href: "/#how-it-works", id: "workflow" },
    { label: "Security", href: "/#security", id: "security" },
]

export default function CoursePulseMobileNav() {
    const [open, setOpen] = useState(false)
    const [active, setActive] = useState("product")
    const reducedMotion = useReducedMotion()

    useEffect(() => {
        if (!open) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false)
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [open])

    const transition = reducedMotion
        ? { duration: 0 }
        : { type: "spring" as const, stiffness: 390, damping: 32, mass: 0.78 }

    return (
        <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "flex-end", zIndex: 30 }}>
            <motion.button
                type="button"
                aria-label={open ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={open}
                aria-controls="coursepulse-mobile-menu"
                onClick={() => setOpen(value => !value)}
                whileTap={reducedMotion ? undefined : { scale: 0.93 }}
                transition={transition}
                style={{
                    width: 42,
                    height: 42,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid #D7E5D8",
                    borderRadius: 14,
                    background: open ? "#E3EEDF" : "#FFFFFF",
                    color: "#1D704A",
                    cursor: "pointer",
                    fontSize: 22,
                    lineHeight: 1,
                    fontWeight: 500,
                }}
            >
                <motion.span
                    initial={false}
                    animate={open ? { rotate: 90, scale: 0.92 } : { rotate: 0, scale: 1 }}
                    transition={transition}
                    aria-hidden="true"
                    style={{ display: "block", width: 20, textAlign: "center" }}
                >
                    {open ? "×" : "☰"}
                </motion.span>
            </motion.button>

            <AnimatePresence>
                {open && (
                    <>
                        <motion.button
                            type="button"
                            aria-label="Close navigation menu"
                            onClick={() => setOpen(false)}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: reducedMotion ? 0 : 0.18 }}
                            style={{
                                position: "fixed",
                                inset: "76px 0 0",
                                width: "100%",
                                height: "calc(100dvh - 76px)",
                                border: 0,
                                background: "rgba(18, 59, 43, 0.19)",
                                zIndex: 10,
                                cursor: "default",
                            }}
                        />
                        <motion.nav
                            id="coursepulse-mobile-menu"
                            aria-label="Mobile navigation"
                            initial={reducedMotion ? false : { opacity: 0, y: -10, scale: 0.985, transformOrigin: "top right" }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.985 }}
                            transition={transition}
                            style={{
                                position: "absolute",
                                top: "calc(100% + 12px)",
                                right: 0,
                                width: 320,
                                maxWidth: "calc(100vw - 36px)",
                                padding: 12,
                                border: "1px solid #D7E5D8",
                                borderRadius: 22,
                                background: "rgba(255,255,255,0.97)",
                                boxShadow: "0 24px 70px rgba(18,59,43,0.22)",
                                backdropFilter: "blur(18px)",
                                zIndex: 40,
                                overflow: "hidden",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px 14px" }}>
                                <div>
                                    <div style={{ fontFamily: "Satoshi, sans-serif", fontWeight: 800, fontSize: 14, color: "#123B2B" }}>Explore CoursePulse</div>
                                    <div style={{ fontFamily: "Manrope, sans-serif", fontWeight: 600, fontSize: 10, color: "#65776A", marginTop: 3 }}>A clearer feedback cycle</div>
                                </div>
                                <span style={{ width: 8, height: 8, borderRadius: 99, background: "#4C8957", boxShadow: "0 0 0 5px #E6F0E2" }} />
                            </div>
                            <div style={{ display: "grid", gap: 4 }}>
                                {items.map((item, index) => (
                                    <motion.a
                                        key={item.id}
                                        href={item.href}
                                        onClick={() => { setActive(item.id); setOpen(false) }}
                                        initial={reducedMotion ? false : { opacity: 0, x: 8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ ...transition, delay: reducedMotion ? 0 : index * 0.035 }}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            gap: 12,
                                            minHeight: 44,
                                            padding: "0 12px",
                                            borderRadius: 12,
                                            textDecoration: "none",
                                            color: active === item.id ? "#1D704A" : "#52695A",
                                            background: active === item.id ? "#E3EEDF" : "transparent",
                                            fontFamily: "Manrope, sans-serif",
                                            fontSize: 12,
                                            fontWeight: 800,
                                        }}
                                    >
                                        <span>{item.label}</span>
                                        <span aria-hidden="true" style={{ fontSize: 16, opacity: 0.65 }}>↗</span>
                                    </motion.a>
                                ))}
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "0.85fr 1.15fr", gap: 8, borderTop: "1px solid #D7E5D8", marginTop: 10, paddingTop: 12 }}>
                                <a
                                    href="https://coursepulse-site.vercel.app/login"
                                    onClick={() => setOpen(false)}
                                    style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 42, padding: "0 12px", border: "1px solid #D7E5D8", borderRadius: 100, color: "#1D704A", textDecoration: "none", fontFamily: "Manrope, sans-serif", fontSize: 11, fontWeight: 800 }}
                                >Sign in</a>
                                <a
                                    href="https://coursepulse-site.vercel.app/signup"
                                    onClick={() => setOpen(false)}
                                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 42, padding: "0 12px", borderRadius: 100, background: "#1D704A", color: "#FFFFFF", textDecoration: "none", fontFamily: "Manrope, sans-serif", fontSize: 11, fontWeight: 800 }}
                                >Get started <span aria-hidden="true">↗</span></a>
                            </div>
                        </motion.nav>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
