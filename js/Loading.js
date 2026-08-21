/*==========================================
  DR. WALLET — LOADING SCREEN
  Counts 0 -> 100% over ~3 seconds, keeps the progress bar
  in sync, reveals a welcome message once past 85%, then
  fades out and hands off to home.html.
==========================================*/

(function () {
    const DURATION = 3000; // total loading time in ms
    const WELCOME_AT = 85; // show "Welcome" once percent crosses this
    const HOLD_AT_100 = 450; // brief pause at 100% before fading out
    const FADE_MS = 550; // must match the CSS transition duration below

    const percentEl = document.getElementById("loadPercent");
    const barFillEl = document.getElementById("loadBarFill");
    const statusEl = document.getElementById("loadStatus");
    const welcomeEl = document.getElementById("loadWelcome");
    const containerEl = document.getElementById("loaderContainer");

    let welcomeShown = false;
    const start = performance.now();

    function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / DURATION, 1);
        const pct = Math.floor(progress * 100);

        percentEl.textContent = pct + "%";
        barFillEl.style.width = progress * 100 + "%";

        if (pct >= WELCOME_AT && !welcomeShown) {
            welcomeShown = true;
            statusEl.classList.add("hide");
            welcomeEl.classList.add("show");
        }

        if (progress < 1) {
            requestAnimationFrame(tick);
            return;
        }

        // Reached 100% — hold briefly, then fade out and hand off.
        percentEl.textContent = "100%";
        barFillEl.style.width = "100%";

        setTimeout(() => {
            containerEl.classList.add("fade-out");
            setTimeout(() => {
                window.location.href = "home.html";
            }, FADE_MS);
        }, HOLD_AT_100);
    }

    requestAnimationFrame(tick);
})();