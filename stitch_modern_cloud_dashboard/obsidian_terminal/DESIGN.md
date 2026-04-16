# Design System Strategy: The Command Core

## 1. Overview & Creative North Star
**Creative North Star: "The Ethereal Terminal"**

This design system moves away from the clunky, high-contrast "hacker" tropes of the 90s. Instead, it adopts a high-end, editorial approach to system architecture. We are building a "Digital Command Center"—a space that feels as precise as a Swiss watch and as deep as a high-end IDE. 

The aesthetic breaks the "standard dashboard" template by utilizing **intentional asymmetry** and **tonal depth**. We replace rigid, boxy layouts with layered transparency and typographic hierarchies that prioritize data-density without sacrificing elegance. The experience should feel like looking through layers of polarized glass into a high-performance engine.

---

## 2. Colors & Tonal Architecture
We do not use color simply to decorate; we use it to signify state, hierarchy, and system health.

### The "No-Line" Rule
Standard 1px borders are strictly prohibited for defining sections. Structure is created through **Background Shifts**. 
- A `surface-container-low` side panel sits against a `surface` background. 
- Use the shift from `#131313` to `#1C1B1B` to create a "silent" boundary.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of materials.
1.  **Base Layer:** `surface` (#131313) – The foundation.
2.  **Sectioning:** `surface-container-low` (#1C1B1B) – Used for primary navigation or sidebar zones.
3.  **Interaction Cards:** `surface-container-highest` (#353534) – Used for the most interactive elements that need to "pop" toward the user.

### The Glass & Gradient Rule
To achieve a "VS Code-inspired" premium feel, floating overlays (menus, tooltips) must use **Glassmorphism**:
- **Background:** `surface_variant` at 60% opacity.
- **Blur:** 20px Backdrop Blur.
- **Signature Gradient:** For primary CTAs, use a linear gradient from `primary` (#C3F5FF) to `primary_container` (#00E5FF) at a 135-degree angle. This adds "visual soul" to the cold charcoal environment.

---

## 3. Typography: The Editorial Monospace
The contrast between the architectural `Space Grotesk` and the functional `Inter` creates a professional, curated feel.

*   **Display & Headlines:** Use `Space Grotesk`. Its geometric quirks provide a futuristic, "designed" character. Use `display-lg` for system status overviews to create a bold, editorial impact.
*   **The Data Layer:** All terminal output, IP addresses, and system logs *must* use a monospace font (JetBrains Mono). This separates "System Content" from "Interface UI."
*   **Hierarchy via Scale:** Use extreme scale differences. A `display-lg` metric (e.g., CPU Temp) paired with a `label-sm` unit creates an authoritative, high-density information display found in professional monitoring tools.

---

## 4. Elevation & Depth
In this system, light is the primary architect.

*   **The Layering Principle:** Avoid shadows for static elements. Stack `surface-container-lowest` on top of `surface-container-low` to create "inset" depth, suggesting a carved-out interface.
*   **Ambient Shadows:** For floating modals, use a "Tinted Glow" instead of a black shadow. Use `surface_tint` (#00DAF3) at 4% opacity with a 40px blur. This mimics the light emitted from a high-tech screen.
*   **The Ghost Border:** If a boundary is required for accessibility, use `outline-variant` (#3B494C) at 15% opacity. It should be felt, not seen.

---

## 5. Components

### Buttons
- **Primary:** High-gloss. Gradient from `primary` to `primary_container`. Text in `on_primary`. Roundedness: `md` (0.375rem).
- **Secondary (Ghost):** No background. `outline-variant` Ghost Border. On hover, transition to `surface-bright` with a 200ms ease-in-out.
- **Tertiary:** Purely typographic using `label-md` and `secondary` color for "Safe" actions or `tertiary` for "Warnings."

### Input Fields
- **Terminal Style:** Forgo the "box" look. Use a `surface-container-lowest` background with a 2px bottom-accent of `primary` only when focused. Use Monospace font for the input text.

### Cards & Lists
- **The Divider Ban:** Never use lines to separate list items. Use 12px of vertical white space or a subtle hover state shift to `surface-container-high`.
- **System Chips:** Status indicators (Online/Offline) use `secondary` (Emerald) or `error` (Amber) dots. Do not use full-color backgrounds; use a subtle `secondary_container` background with high-saturation `on_secondary` text.

### The "Terminal Console" Component
A unique component for this system. A `surface-container-lowest` block with a 50% transparent `outline` ghost border. Ensure 16px padding and use `body-sm` Monospace. This should look like an integrated part of the machine, not an afterthought.

---

## 6. Do’s and Don’ts

### Do:
*   **Use Asymmetry:** Place a large metric (`display-md`) on the left and a dense list of data (`label-sm`) on the right to create a "Pro-Tool" layout.
*   **Micro-Transitions:** Every hover should have a subtle shift. A button shouldn't just change color; its "Ghost Border" should glow slightly brighter.
*   **Contextual Color:** Use `tertiary` (Amber) sparingly for "System Pending" states to maintain its visual impact.

### Don’t:
*   **Don't use 100% White:** Never use #FFFFFF. Use `on_surface` (#E5E2E1) to reduce eye strain and maintain the "Slate" atmosphere.
*   **Don't use Rounded Corners for everything:** Keep `xl` and `full` rounding for chips only. Use `sm` and `md` for containers to maintain a sharp, "engineered" aesthetic.
*   **Don't Over-Glow:** Glows are for status and focus, not decoration. If everything glows, nothing is important.