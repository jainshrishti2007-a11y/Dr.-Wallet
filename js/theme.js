/*==========================================
  DR. WALLET — THEME TOGGLE
  
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
