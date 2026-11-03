# CoursePulse Framer component source snapshot

This folder contains custom React/TypeScript code components copied from the Framer project **CoursePulse | Premium Landing Page**.

- Framer editor: https://framer.com/projects/JRiLySC0W07eTJbLMSAd
- Published Framer site: https://plum-badger-573658.framer.app
- Snapshot branch base: `release/premium-product-experience`

## Included components

| File | Purpose |
|---|---|
| `CoursePulseScrollStory.tsx` | Sticky product preview with a four-step, scroll-driven story |
| `CoursePulseAnalyticsChart.tsx` | Trend line, category-comparison bars and compact sparklines |
| `CoursePulseMobileNav.tsx` | Animated responsive navigation drawer |
| `MotionInteractions.tsx` | Cursor tilt, magnetic button and scroll-reactive navigation overrides |
| `CoursePulseShader.tsx` | Custom green GLSL/WebGL hero background |
| `CoursePulseScrollProgress.tsx` | Spring-smoothed page scroll progress indicator |

## Important scope

This is a **code-component source snapshot, not a complete Framer-site export**.

The visual canvas itself—page/frame layout, responsive variants, style tokens, asset placement, Framer CMS/settings and published hosting configuration—remains in Framer. Framer's official help confirms it does not provide a full HTML export for self-hosting: https://www.framer.com/help/articles/can-i-export-my-website-to-html-and-self-host-it/.

These files are kept as versioned source for the Framer project. They import Framer-specific APIs such as `framer` property controls and use `framer-motion`; they are therefore **not wired into the Next.js application** in this repository. The current Next.js `package.json` does not declare the Framer runtime. Do not import this folder into app routes or production bundles without deliberately porting the components and replacing Framer-specific APIs.

## Preview data

Charts and interface previews use illustrative sample visuals. They are not live student feedback, institution metrics or production analytics data.
