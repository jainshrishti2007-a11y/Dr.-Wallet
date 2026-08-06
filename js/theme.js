/*==========================================
  DR. WALLET — THEME TOGGLE
  The initial theme is applied by a tiny inline script
  in <head> (before CSS paints) to avoid a flash of the
  wrong theme. This file just wires up the button click
  and remembers the choice for next time.
==========================================*/

const THEME_KEY = "drwallet_theme";

function getCurrentTheme() {
    return document.documentElement.getAttribute("data-theme") || "light";
}

function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
}

function initThemeToggle() {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;

    btn.addEventListener("click", () => {
        const next = getCurrentTheme() === "dark" ? "light" : "dark";
        setTheme(next);
    });
}

document.addEventListener("DOMContentLoaded", initThemeToggle);
