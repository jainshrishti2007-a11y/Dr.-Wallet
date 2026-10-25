/*==========================================
  DR. WALLET — AUTH & SESSION MANAGER

==========================================*/

const USERS_KEY = "drwallet_users";
const SESSION_KEY = "drwallet_session";

/* ---------- storage helpers ---------- */

function getUsers() {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession() {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
}

function setSession(user) {
    localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
            name: user.name,
            username: user.username || "",
            displayPreference: user.displayPreference || "name",
            email: user.email,
        })
    );
}

function getSessionDisplayName(session = getSession()) {
    if (!session) return "";
    const account = getUsers().find((user) => user.email === session.email) || {};
    const username = session.username || account.username || "";
    const preference = session.displayPreference || account.displayPreference || "name";
    return preference === "username" && username ? username : (session.name || account.name || "");
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

function getInitials(name) {
    return name
        .trim()
        .split(/\s+/)
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

/* ---------- toast notifications ---------- */

function showToast(message, type = "success") {
    let container = document.getElementById("toast-container");

    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }

    const icons = {
        success: "fa-circle-check",
        error: "fa-circle-exclamation",
        info: "fa-circle-info",
        warning: "fa-triangle-exclamation",
    };

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.success}"></i><span>${message}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add("hide");
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

/* ---------- navbar: logged-in vs guest ----------
   . */

function buildGuestHTML() {
    return `
        <a href="signin.html" class="btn btn-ghost">Sign In</a>
        <a href="signup.html" class="btn btn-primary">Sign Up</a>
    `;
}

function buildUserMenuHTML(session) {
    const account = getUsers().find((user) => user.email === session.email) || {};
    const displayName = session.username || account.username || getSessionDisplayName(session);
    return `
        <div class="user-menu">
            <button type="button" class="user-avatar-btn">
                <span class="avatar-circle">${getInitials(displayName)}</span>
                <span class="user-name">${displayName}</span>
                <i class="fa-solid fa-chevron-down"></i>
            </button>
            <div class="user-dropdown">
                <button type="button" class="edit-profile-btn">
                    <i class="fa-solid fa-user-pen"></i> Edit Profile
                </button>
                <hr>
                <button type="button" class="logout-btn">
                    <i class="fa-solid fa-right-from-bracket"></i> Logout
                </button>
            </div>
        </div>
    `;
}

function renderAuthSlot() {
    const slots = document.querySelectorAll("#authSlot, #authSlotMobile");
    if (!slots.length) return;

    const session = getSession();
    const html = session ? buildUserMenuHTML(session) : buildGuestHTML();

    slots.forEach((slot) => {
        slot.innerHTML = html;
    });
}

// Event delegation so this works no matter how many auth slots are on
// the page (desktop navbar + mobile dropdown both render the same markup).
document.addEventListener("click", (e) => {
    const toggleBtn = e.target.closest(".user-avatar-btn");
    if (toggleBtn) {
        const menu = toggleBtn.closest(".user-menu");
        const wasOpen = menu.classList.contains("open");
        document.querySelectorAll(".user-menu.open").forEach((m) => m.classList.remove("open"));
        if (!wasOpen) menu.classList.add("open");
        e.stopPropagation();
        return;
    }

    if (e.target.closest(".logout-btn")) {
        handleLogout();
        return;
    }

    if (e.target.closest(".edit-profile-btn")) {
        openEditProfileModal();
        return;
    }

    // click anywhere else closes any open user menu
    document.querySelectorAll(".user-menu.open").forEach((m) => m.classList.remove("open"));
});

function handleLogout() {
    clearSession();
    showToast("You have been successfully logged out", "info");
    setTimeout(() => {
        window.location.href = "home.html";
    }, 1200);
}

/* ---------- edit profile modal ---------- */

function openEditProfileModal() {
    const session = getSession();
    if (!session) return;

    const users = getUsers();
    const user = users.find((u) => u.email === session.email);
    if (!user) return;

    const existing = document.getElementById("editProfileOverlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "editProfileOverlay";

    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-head">
                <h3>Edit Profile</h3>
                <button type="button" class="modal-close" id="closeEditModal">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <form id="editProfileForm">

                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" name="name" value="${user.name}" required>
                </div>

                <div class="form-group">
                    <label>Username <span class="optional-tag">(optional)</span></label>
                    <input type="text" name="username" value="${user.username || ""}" placeholder="3–30 letters, numbers, or underscores" maxlength="30" autocomplete="username" aria-describedby="editUsernameError">
                    <span class="error-text" id="editUsernameError" data-error-for="edit-username" aria-live="polite"></span>
                </div>

                <div class="form-group">
                    <span class="display-choice-heading">Show on dashboard and profile</span>
                    <label class="display-choice">
                        <input type="radio" name="displayPreference" value="name" ${(user.displayPreference || "name") === "name" ? "checked" : ""}>
                        <span>Display name</span>
                    </label>
                    <label class="display-choice ${user.username ? "" : "disabled"}">
                        <input type="radio" name="displayPreference" value="username" ${user.displayPreference === "username" ? "checked" : ""} ${user.username ? "" : "disabled"}>
                        <span>Username${user.username ? "" : " (not set)"}</span>
                    </label>
                </div>

                <div class="form-group">
                    <label>Phone Number</label>
                    <input type="tel" name="phone" value="${user.phone || ""}" required>
                    <span class="error-text" data-error-for="edit-phone"></span>
                </div>

                <div class="form-group">
                    <label>Pincode</label>
                    <input type="text" name="pincode" value="${user.pincode || ""}" required>
                    <span class="error-text" data-error-for="edit-pincode"></span>
                </div>

                <div class="form-group">
                    <label>College / School <span class="optional-tag">(optional)</span></label>
                    <input type="text" name="college" value="${user.college || ""}">
                </div>

                <div class="form-group">
                    <label>Class <span class="optional-tag">(optional)</span></label>
                    <input type="text" name="studentClass" value="${user.studentClass || ""}">
                </div>

                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" id="cancelEditModal">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>

            </form>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("open"));

    const closeModal = () => {
        overlay.classList.remove("open");
        setTimeout(() => overlay.remove(), 250);
    };

    const usernameInput = overlay.querySelector('[name="username"]');
    const usernameDisplayChoice = overlay.querySelector('input[name="displayPreference"][value="username"]');
    const usernameDisplayLabel = usernameDisplayChoice.closest(".display-choice");
    usernameInput.addEventListener("input", () => {
        const enteredUsername = usernameInput.value.trim();
        const errorEl = overlay.querySelector('[data-error-for="edit-username"]');
        const isTaken = enteredUsername && users.some((u) =>
            u.email !== session.email && (u.username || "").toLowerCase() === enteredUsername.toLowerCase()
        );
        const hasUsername = Boolean(enteredUsername || user.username);

        usernameDisplayChoice.disabled = !hasUsername;
        usernameDisplayLabel.classList.toggle("disabled", !hasUsername);
        if (!hasUsername && usernameDisplayChoice.checked) {
            overlay.querySelector('input[name="displayPreference"][value="name"]').checked = true;
        }
        errorEl.textContent = isTaken ? "That username is already taken" : "";
        usernameInput.classList.toggle("input-error", Boolean(isTaken));
    });

    document.getElementById("closeEditModal").addEventListener("click", closeModal);
    document.getElementById("cancelEditModal").addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
    });

    document.getElementById("editProfileForm").addEventListener("submit", (e) => {
        e.preventDefault();

        const form = e.target;
        form.querySelectorAll(".error-text").forEach((el) => (el.textContent = ""));

        const phone = form.phone.value.trim();
        const pincode = form.pincode.value.trim();
        const enteredUsername = form.username.value.trim();
        const username = enteredUsername || user.username || "";
        let valid = true;

        if (enteredUsername && !/^[a-zA-Z0-9_]{3,30}$/.test(enteredUsername)) {
            form.querySelector('[data-error-for="edit-username"]').textContent = "Use 3–30 letters, numbers, or underscores";
            valid = false;
        } else if (enteredUsername && users.some((u) =>
            u.email !== session.email && (u.username || "").toLowerCase() === enteredUsername.toLowerCase()
        )) {
            form.querySelector('[data-error-for="edit-username"]').textContent = "That username is already taken";
            valid = false;
        }

        if (!/^[6-9]\d{9}$/.test(phone)) {
            form.querySelector('[data-error-for="edit-phone"]').textContent = "Enter a valid 10-digit mobile number";
            valid = false;
        }

        if (!/^[1-9][0-9]{5}$/.test(pincode)) {
            form.querySelector('[data-error-for="edit-pincode"]').textContent = "Enter a valid 6-digit pincode";
            valid = false;
        }

        if (!valid) return;

        const updated = users.map((u) =>
            u.email === session.email
                ? {
                      ...u,
                      name: form.name.value.trim(),
                      username,
                      displayPreference: form.displayPreference.value,
                      phone,
                      pincode,
                      college: form.college.value.trim(),
                      studentClass: form.studentClass.value.trim(),
                  }
                : u
        );

        saveUsers(updated);
        const updatedUser = updated.find((u) => u.email === session.email);
        setSession(updatedUser);

        closeModal();
        renderAuthSlot();
        showToast("Profile updated successfully", "success");
    });
}

/* ---------- signup CTAs (hero/CTA-band buttons that link to signup.html) ---------- */

function updateSignupCTAs() {
    const session = getSession();
    const ctas = document.querySelectorAll(".js-signup-cta");

    ctas.forEach((el) => {
        if (!session) return;

        el.innerHTML = `<i class="fa-solid fa-circle-check"></i> Go to Dashboard`;
        el.classList.add("cta-disabled");
        el.setAttribute("href", "dashboard.html");
    });
}

/* ---------- "Dashboard" nav link, shown only when logged in ---------- */

function updateDashboardNavLink() {
    const link = document.getElementById("navDashboardLink");
    if (!link) return;
    link.style.display = getSession() ? "" : "none";
}

/* ---------- password show/hide (works anywhere .toggle-password is used) ---------- */

document.addEventListener("click", (e) => {
    const btn = e.target.closest(".toggle-password");
    if (!btn) return;

    const input = btn.previousElementSibling;
    const icon = btn.querySelector("i");

    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
    }
});

/* ---------- run on every page ---------- */

document.addEventListener("DOMContentLoaded", () => {
    renderAuthSlot();
    updateSignupCTAs();
    updateDashboardNavLink();
});
