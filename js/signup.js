/*==========================================
  SIGN UP FORM LOGIC
==========================================*/

function setFieldError(field, message) {
    const errorEl = document.querySelector(`[data-error-for="${field}"]`);
    if (errorEl) errorEl.textContent = message;

    const inputEl = document.querySelector(`#signupForm [name="${field}"]`);
    if (inputEl) inputEl.classList.add("input-error");
}

function clearFieldErrors(form) {
    form.querySelectorAll(".error-text").forEach((el) => (el.textContent = ""));
    form.querySelectorAll("input, select").forEach((el) => el.classList.remove("input-error"));
}

document.addEventListener("DOMContentLoaded", () => {
    renderCaptcha("captchaText");

    document.getElementById("refreshCaptcha").addEventListener("click", () => {
        renderCaptcha("captchaText");
        document.getElementById("captcha").value = "";
    });

    const form = document.getElementById("signupForm");

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        clearFieldErrors(form);

        const name = form.name.value.trim();
        const email = form.email.value.trim().toLowerCase();
        const phone = form.phone.value.trim();
        const pincode = form.pincode.value.trim();
        const password = form.password.value;
        const confirmPassword = form.confirmPassword.value;
        const captchaInput = form.captcha.value;
        const college = form.college.value.trim();
        const studentClass = form.studentClass.value.trim();

        let valid = true;

        if (name.length < 3 || !/^[a-zA-Z\s.'-]+$/.test(name)) {
            setFieldError("name", "Please enter your full name");
            valid = false;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setFieldError("email", "Enter a valid email address");
            valid = false;
        }

        if (!/^[6-9]\d{9}$/.test(phone)) {
            setFieldError("phone", "Enter a valid 10-digit mobile number");
            valid = false;
        }

        if (!/^[1-9][0-9]{5}$/.test(pincode)) {
            setFieldError("pincode", "Enter a valid 6-digit pincode");
            valid = false;
        }

        if (password.length < 8) {
            setFieldError("password", "Password must be at least 8 characters");
            valid = false;
        }

        if (confirmPassword !== password || confirmPassword === "") {
            setFieldError("confirmPassword", "Passwords do not match");
            valid = false;
        }

        if (!validateCaptcha("captchaText", captchaInput)) {
            setFieldError("captcha", "Captcha does not match, please try again");
            renderCaptcha("captchaText");
            form.captcha.value = "";
            valid = false;
        }

        const users = getUsers();

        if (users.some((u) => u.email === email)) {
            setFieldError("email", "An account with this email already exists");
            valid = false;
        }

        if (!valid) {
            showToast("Please fix the highlighted fields", "error");
            return;
        }

        const newUser = {
            name,
            email,
            phone,
            pincode,
            password,
            college,
            studentClass,
        };

        users.push(newUser);
        saveUsers(users);

        setSession(newUser);

        showToast(`Welcome, ${name.split(" ")[0]}! Taking you to your dashboard…`, "success");

        setTimeout(() => {
            window.location.href = "home.html";
        }, 1200);
    });
});
