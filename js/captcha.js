/*==========================================
  CAPTCHA WIDGET

==========================================*/

function generateCaptchaText(length = 6) {
    
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let text = "";
    for (let i = 0; i < length; i++) {
        text += chars[Math.floor(Math.random() * chars.length)];
    }
    return text;
}

function renderCaptcha(containerId) {
    const box = document.getElementById(containerId);
    if (!box) return;

    const text = generateCaptchaText();
    box.dataset.captcha = text;
    box.innerHTML = "";

    const colors = ["#2563EB", "#1D4ED8", "#0F172A", "#10B981", "#3B82F6"];

    [...text].forEach((char) => {
        const span = document.createElement("span");
        span.textContent = char;

        const rotate = (Math.random() * 30 - 15).toFixed(1);
        const shiftY = (Math.random() * 10 - 5).toFixed(1);
        const color = colors[Math.floor(Math.random() * colors.length)];

        span.style.transform = `rotate(${rotate}deg) translateY(${shiftY}px)`;
        span.style.color = color;

        box.appendChild(span);
    });
}

function validateCaptcha(containerId, inputValue) {
    const box = document.getElementById(containerId);
    if (!box) return false;

    const expected = (box.dataset.captcha || "").toLowerCase();
    const given = (inputValue || "").trim().toLowerCase();

    return expected.length > 0 && expected === given;
}
