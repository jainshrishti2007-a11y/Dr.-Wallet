/*==========================================
  SIGN IN FORM LOGIC
==========================================*/

function setSigninError(field, message) {
    const errorEl = document.querySelector(`[data-error-for="${field}"]`);
    if (errorEl) errorEl.textContent = message;

    const inputEl = document.querySelector(`#signinForm [name="${field}"]`);
    if (inputEl) inputEl.classList.add("input-error");
}

function clearSigninErrors(form) {
    form.querySelectorAll(".error-text").forEach((el) => (el.textContent = ""));
    form.querySelectorAll("input").forEach((el) => el.classList.remove("input-error"));
}

document.addEventListener("DOMContentLoaded", () => {
    renderCaptcha("captchaText");

    document.getElementById("refreshCaptcha").addEventListener("click", () => {
        renderCaptcha("captchaText");
        document.getElementById("captcha").value = "";
    });

    const form = document.getElementById("signinForm");

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        clearSigninErrors(form);

        const identifier = form.identifier.value.trim();
        const normalizedIdentifier = identifier.toLowerCase();
        const password = form.password.value;
        const captchaInput = form.captcha.value;

        let valid = true;

        if (!identifier) {
            setSigninError("identifier", "Enter your username or email address");
            valid = false;
        }

        if (!password) {
            setSigninError("password", "Enter your password");
            valid = false;
        }

        if (!validateCaptcha("captchaText", captchaInput)) {
            setSigninError("captcha", "Captcha does not match, please try again");
            renderCaptcha("captchaText");
            form.captcha.value = "";
            valid = false;
        }

        if (!valid) {
            showToast("Please fix the highlighted fields", "error");
            return;
        }

        const users = getUsers();
        const user = users.find((u) =>
            (u.email || "").toLowerCase() === normalizedIdentifier ||
            (u.username || "").toLowerCase() === normalizedIdentifier
        );

        const matches = user && user.password === password;

        if (!matches) {
            setSigninError("password", "Username/email or password is incorrect");
            renderCaptcha("captchaText");
            form.captcha.value = "";
            showToast("Login failed. Please check your details.", "error");
            return;
        }

        setSession(user);
        showToast("Successfully logged in!", "success");

        setTimeout(() => {
            window.location.href = "home.html";
        }, 1200);
    });
});
