/*==========================================
  CONTACT FORM LOGIC

==========================================*/

function setContactError(field, message) {
    const errorEl = document.querySelector(`[data-error-for="${field}"]`);
    if (errorEl) errorEl.textContent = message;

    const inputEl = document.querySelector(`#contactForm [name="${field}"]`);
    if (inputEl) inputEl.classList.add("input-error");
}

function clearContactErrors(form) {
    form.querySelectorAll(".error-text").forEach((el) => (el.textContent = ""));
    form.querySelectorAll("input, textarea").forEach((el) => el.classList.remove("input-error"));
}

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("contactForm");
    if (!form) return;

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        clearContactErrors(form);

        const name = form.name.value.trim();
        const email = form.email.value.trim();
        const subject = form.subject.value.trim();
        const message = form.message.value.trim();

        let valid = true;

        if (name.length < 2) {
            setContactError("name", "Enter your name");
            valid = false;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setContactError("email", "Enter a valid email address");
            valid = false;
        }

        if (subject.length < 3) {
            setContactError("subject", "Give your message a short subject");
            valid = false;
        }

        if (message.length < 10) {
            setContactError("message", "Message should be at least 10 characters");
            valid = false;
        }

        if (!valid) {
            showToast("Please fix the highlighted fields", "error");
            return;
        }

      
        form.reset();
        showToast(`Thanks ${name.split(" ")[0]}, your message is ready to send!`, "success");
    });
});

/*==========================================
  SCROLL REVEAL
 
==========================================*/

document.addEventListener("DOMContentLoaded", () => {
    const revealTargets = document.querySelectorAll(
        ".info-card, .contact-left, .contact-right, .faq-container details"
    );

    if (!revealTargets.length) return;

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("show");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.15 }
    );

    revealTargets.forEach((el) => observer.observe(el));
});
