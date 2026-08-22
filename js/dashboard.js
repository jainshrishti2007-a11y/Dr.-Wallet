/*==========================================
  DR. WALLET — DASHBOARD / TRACKER LOGIC
  All data is stored per-account in localStorage
  (this is a frontend-only student project, no backend).
==========================================*/

/* ---------- storage ---------- */

function getDashDataKey() {
    const session = getSession();
    return `drwallet_records_${session ? session.email : "guest"}`;
}

function loadDashData() {
    const raw = localStorage.getItem(getDashDataKey());
    return raw ? JSON.parse(raw) : { budget: null, expenses: [] };
}

function saveDashData(data) {
    localStorage.setItem(getDashDataKey(), JSON.stringify(data));
}

/* ---------- smart category detection ---------- */

const CATEGORY_MAP = [
    { name: "Food & Mess", icon: "fa-utensils", color: "#E6B85C", keywords: ["food", "mess", "meal", "lunch", "dinner", "breakfast", "thali", "dhaba", "canteen", "tiffin"] },

    { name: "Coffee & Tea", icon: "fa-mug-hot", color: "#D89B72", keywords: ["coffee", "chai", "tea", "latte", "cappuccino"] },

    { name: "Snacks", icon: "fa-burger", color: "#F08A5D", keywords: ["snack", "chips", "maggi", "samosa", "momo", "momos", "burger", "pizza", "fries", "sandwich", "icecream"] },

    { name: "Drinks", icon: "fa-bottle-water", color: "#63B7A4", keywords: ["juice", "cold drink", "coke", "pepsi", "soda", "drink", "shake"] },

    { name: "Transport", icon: "fa-bus", color: "#f0ed6b", keywords: ["bus", "auto", "cab", "uber", "ola", "metro", "train", "fuel", "petrol", "rickshaw", "rapido"] },

    { name: "Books & Stationery", icon: "fa-book", color: "#B79AD6", keywords: ["book", "notebook", "pen", "pencil", "stationery", "xerox", "print", "photocopy", "assignment"] },

    { name: "Hostel & Rent", icon: "fa-house", color: "#75C49A", keywords: ["rent", "hostel", "room", "pg", "maintenance"] },

    { name: "Entertainment", icon: "fa-film", color: "#D9829A", keywords: ["movie", "netflix", "spotify", "game", "party", "fest", "concert", "outing"] },

    { name: "Shopping", icon: "fa-bag-shopping", color: "#E27C73", keywords: ["shopping", "clothes", "shoes", "dress", "amazon", "flipkart", "tshirt"] },

    { name: "Health", icon: "fa-heart-pulse", color: "#E57373", keywords: ["medicine", "doctor", "hospital", "gym", "health", "pharmacy"] },

    { name: "Recharge & Bills", icon: "fa-mobile-screen", color: "#67B58A", keywords: ["recharge", "mobile", "wifi", "subscription", "sim", "bill"] },
];

const DEFAULT_CATEGORY = { name: "Other", icon: "fa-tag", color: "#8A8078" };

/* Look up a category's icon + colour by name — used when rendering
   older saved records that don't carry their own icon/colour. */
const CATEGORY_STYLE = Object.fromEntries(
    [...CATEGORY_MAP, DEFAULT_CATEGORY].map((c) => [c.name, { icon: c.icon, color: c.color }])
);

function styleForCategory(name) {
    return CATEGORY_STYLE[name] || DEFAULT_CATEGORY;
}

function detectCategory(text) {
    const lower = text.toLowerCase().trim();
    if (lower.length < 2) return DEFAULT_CATEGORY;

    for (const cat of CATEGORY_MAP) {
        for (const kw of cat.keywords) {
            if (lower.length >= 3 && (lower.includes(kw) || kw.includes(lower))) {
                return cat;
            }
        }
    }
    return DEFAULT_CATEGORY;
}

/* Groups near-identical item names together (e.g. "coff" and "coffee")
   so repeat purchases get recognised as the same "hot topic" item. */
function getCanonicalKey(text, existingKeys) {
    const lower = text.toLowerCase().trim();
    if (lower.length < 2) return lower;

    const match = existingKeys.find(
        (k) => k.length >= 3 && lower.length >= 3 && (k.includes(lower) || lower.includes(k))
    );

    return match || lower;
}

/* ---------- date helpers ---------- */

function isoDateOnly(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isSameMonth(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function getMonthExpenses(expenses) {
    return expenses.filter((e) => isSameMonth(e.date));
}

function getLastNDays(n) {
    const days = [];
    const today = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        days.push(d);
    }
    return days;
}

/* ---------- expense CRUD ---------- */

function addExpense(itemRaw, amount) {
    const data = loadDashData();
    const cat = detectCategory(itemRaw);
    const existingKeys = [...new Set(data.expenses.map((e) => e.canonicalKey))];
    const canonicalKey = getCanonicalKey(itemRaw, existingKeys);

    const expense = {
        id: `e${Date.now()}${Math.random().toString(16).slice(2, 6)}`,
        item: itemRaw.trim(),
        amount: Number(amount),
        category: cat.name,
        icon: cat.icon,
        color: cat.color,
        date: new Date().toISOString(),
        canonicalKey,
    };

    data.expenses.unshift(expense);
    saveDashData(data);
    renderAll();

    showToast(`Added "${expense.item}" — ₹${expense.amount}`, "success");
}

function deleteExpense(id) {
    const data = loadDashData();
    data.expenses = data.expenses.filter((e) => e.id !== id);
    saveDashData(data);
    renderAll();
    showToast("Expense removed", "info");
}

/* ---------- computed stats ---------- */

function computeStats(data) {
    const monthExpenses = getMonthExpenses(data.expenses);
    const totalSpent = monthExpenses.reduce((s, e) => s + e.amount, 0);
    const budget = data.budget ? data.budget.amount : 0;
    const remaining = budget - totalSpent;

    const todayKey = isoDateOnly(new Date());
    const todaySpent = monthExpenses
        .filter((e) => e.date.slice(0, 10) === todayKey)
        .reduce((s, e) => s + e.amount, 0);

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - now.getDate() + 1;
    const avgPerDayRemaining = daysLeft > 0 ? Math.max(remaining, 0) / daysLeft : 0;

    return { totalSpent, budget, remaining, todaySpent, daysLeft, avgPerDayRemaining };
}

function computeWeeklySeries(expenses) {
    return getLastNDays(7).map((d) => {
        const key = isoDateOnly(d);
        const total = expenses
            .filter((e) => e.date.slice(0, 10) === key)
            .reduce((s, e) => s + e.amount, 0);
        const isToday = key === isoDateOnly(new Date());
        return { label: isToday ? "Today" : d.toLocaleDateString("en-US", { weekday: "short" }), total };
    });
}

function computeCategoryBreakdown(expenses) {
    const monthExpenses = getMonthExpenses(expenses);
    const map = {};
    monthExpenses.forEach((e) => {
        map[e.category] = (map[e.category] || 0) + e.amount;
    });

    let arr = Object.entries(map).map(([name, total]) => ({ name, total }));
    arr.sort((a, b) => b.total - a.total);

    if (arr.length > 6) {
        const top = arr.slice(0, 5);
        const otherTotal = arr.slice(5).reduce((s, c) => s + c.total, 0);
        top.push({ name: "Other", total: otherTotal });
        arr = top;
    }

    const totalAll = arr.reduce((s, c) => s + c.total, 0);

    return arr.map((c) => ({
        ...c,
        pct: totalAll ? (c.total / totalAll) * 100 : 0,
        color: styleForCategory(c.name).color,
    }));
}

function getHotItems(expenses) {
    const groups = {};

    expenses.forEach((e) => {
        if (!groups[e.canonicalKey]) groups[e.canonicalKey] = [];
        groups[e.canonicalKey].push(e);
    });

    return Object.values(groups)
        .filter((g) => g.length >= 3)
        .map((g) => {
            const latest = g[0]; // expenses are stored newest-first
            const style = styleForCategory(latest.category);
            return {
                canonicalKey: latest.canonicalKey,
                item: latest.item,
                icon: latest.icon || style.icon,
                color: latest.color || style.color,
                category: latest.category,
                lastAmount: latest.amount,
                count: g.length,
            };
        })
        .sort((a, b) => b.count - a.count);
}

/* ---------- rendering: greeting ---------- */

function renderGreeting() {
    const session = getSession();
    const firstName = session ? session.name.split(" ")[0] : "there";
    document.getElementById("dashGreeting").textContent = `Hey, ${firstName}`;
    document.getElementById("dashDate").textContent =
        `Here's where your money went — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`;
}

/* ---------- rendering: budget ---------- */

function renderBudget() {
    const data = loadDashData();
    const container = document.getElementById("budgetContainer");

    if (!data.budget) {
        container.innerHTML = `
            <div class="budget-empty">
                <div>
                    <h3>Set your budget to get started</h3>
                    <p>Tell us how much you've got for this month and we'll help you stay on track.</p>
                </div>
                <button type="button" class="btn" id="setBudgetBtn">
                    <i class="fa-solid fa-piggy-bank"></i> Set Budget
                </button>
            </div>
        `;
        document.getElementById("setBudgetBtn").addEventListener("click", () => openBudgetModal());
        return;
    }

    const stats = computeStats(data);
    const pct = stats.budget > 0 ? Math.min(100, (stats.totalSpent / stats.budget) * 100) : 0;
    const fillClass = pct >= 100 ? "over" : pct >= 80 ? "warn" : "";

    container.innerHTML = `
        <div class="budget-card">
            <div class="budget-top">
                <div>
                    <h3>Monthly Budget</h3>
                    <span>${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
                </div>
                <button type="button" class="budget-edit-btn" id="editBudgetBtn">
                    <i class="fa-solid fa-pen"></i> Edit Budget
                </button>
            </div>

            <div class="budget-progress-track">
                <div class="budget-progress-fill ${fillClass}" style="width:${pct}%"></div>
            </div>

            <div class="stat-grid">
                <div class="stat-box">
                    <span>Budget</span>
                    <b>₹${stats.budget.toLocaleString("en-IN")}</b>
                </div>
                <div class="stat-box danger">
                    <span>Spent</span>
                    <b>₹${stats.totalSpent.toLocaleString("en-IN")}</b>
                </div>
                <div class="stat-box accent">
                    <span>Remaining</span>
                    <b>₹${Math.max(stats.remaining, 0).toLocaleString("en-IN")}</b>
                </div>
                <div class="stat-box">
                    <span>Per Day Left</span>
                    <b>₹${Math.round(stats.avgPerDayRemaining).toLocaleString("en-IN")}</b>
                </div>
            </div>
        </div>
    `;

    document.getElementById("editBudgetBtn").addEventListener("click", () => openBudgetModal(stats.budget));
}

function openBudgetModal(prefillAmount) {
    const existing = document.getElementById("budgetModalOverlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "budgetModalOverlay";

    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-head">
                <h3>${prefillAmount ? "Edit" : "Set"} Your Budget</h3>
                <button type="button" class="modal-close" id="closeBudgetModal">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <form id="budgetForm">
                <div class="form-group">
                    <label>Budget for ${new Date().toLocaleDateString("en-US", { month: "long" })} (₹)</label>
                    <input type="number" name="budgetAmount" min="1" step="1" placeholder="e.g. 12000" value="${prefillAmount || ""}">
                    <span class="error-text" data-error-for="budgetAmount"></span>
                </div>

                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" id="cancelBudgetModal">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save</button>
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

    document.getElementById("closeBudgetModal").addEventListener("click", closeModal);
    document.getElementById("cancelBudgetModal").addEventListener("click", closeModal);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
    });

    document.getElementById("budgetForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const errorEl = e.target.querySelector('[data-error-for="budgetAmount"]');
        const val = Number(e.target.budgetAmount.value);

        if (!val || val <= 0) {
            errorEl.textContent = "Enter a valid amount";
            return;
        }

        const data = loadDashData();
        data.budget = { amount: val, setAt: new Date().toISOString() };
        saveDashData(data);

        closeModal();
        renderAll();
        showToast("Budget saved!", "success");
    });
}

/* ---------- rendering: weekly SVG graph ---------- */

function renderWeeklyChart() {
    const data = loadDashData();
    const wrap = document.getElementById("weeklyChartWrap");
    const series = computeWeeklySeries(data.expenses);
    const hasAny = series.some((d) => d.total > 0);

    if (!hasAny) {
        wrap.innerHTML = `
            <div class="chart-empty-note">
                <i class="fa-solid fa-chart-line"></i>
                No spending logged this week yet.<br>Add an expense below to see your trend.
            </div>
        `;
        return;
    }

    const max = Math.max(...series.map((d) => d.total), 1);
    const w = 500, h = 200, padX = 30, baseY = 170, chartH = 140;
    const stepX = (w - 2 * padX) / (series.length - 1);

    const points = series.map((d, i) => ({
        x: padX + i * stepX,
        y: baseY - (d.total / max) * chartH,
        ...d,
    }));

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y.toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${points[points.length - 1].x},${baseY} L${points[0].x},${baseY} Z`;

    const circles = points
        .map((p) => `<circle cx="${p.x}" cy="${p.y.toFixed(1)}" r="5" fill="var(--color-primary)" stroke="var(--color-surface)" stroke-width="2.5"><title>${p.label}: ₹${p.total}</title></circle>`)
        .join("");

    wrap.innerHTML = `
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--color-primary)" stop-opacity="0.28"/>
                    <stop offset="100%" stop-color="var(--color-primary)" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <path d="${areaPath}" fill="url(#areaGrad)"/>
            <path d="${linePath}" fill="none" stroke="var(--color-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            ${circles}
        </svg>
        <div class="chart-day-labels">
            ${series.map((d) => `<span>${d.label}</span>`).join("")}
        </div>
    `;
}

/* ---------- rendering: category donut ---------- */

function renderDonut() {
    const data = loadDashData();
    const wrap = document.getElementById("donutWrap");
    const breakdown = computeCategoryBreakdown(data.expenses);

    if (breakdown.length === 0) {
        wrap.innerHTML = `
            <div class="chart-empty-note">
                <i class="fa-solid fa-chart-pie"></i>
                No expenses this month yet.<br>Your category breakdown will show up here.
            </div>
        `;
        return;
    }

    let cumulative = 0;
    const gradientParts = breakdown
        .map((c) => {
            const start = cumulative;
            cumulative += c.pct;
            return `${c.color} ${start}% ${cumulative}%`;
        })
        .join(", ");

    const totalAll = breakdown.reduce((s, c) => s + c.total, 0);

    wrap.innerHTML = `
        <div class="donut-wrap" style="background:conic-gradient(${gradientParts});">
            <div class="donut-center">
                <b>₹${totalAll.toLocaleString("en-IN")}</b>
                <span>this month</span>
            </div>
        </div>
        <ul class="donut-legend">
            ${breakdown
                .map((c) => `<li><i style="background:${c.color}"></i>${c.name} — ${Math.round(c.pct)}%</li>`)
                .join("")}
        </ul>
    `;
}

/* ---------- rendering: hot topics ---------- */

function renderHotTopics() {
    const data = loadDashData();
    const wrap = document.getElementById("hotTopicsWrap");
    const hotItems = getHotItems(data.expenses);

    if (hotItems.length === 0) {
        wrap.innerHTML = "";
        return;
    }

    wrap.innerHTML = `
        <div class="hot-topics-head">
            <i class="fa-solid fa-fire"></i> Hot Topics — tap to log again in one go
        </div>
        <div class="hot-chips">
            ${hotItems
                .map(
                    (h) => `
                <div class="hot-chip" data-canonical="${h.canonicalKey}">
                    <span class="hot-icon" style="color:${h.color};background:${h.color}22">
                        <i class="fa-solid ${h.icon}"></i>
                    </span>
                    <div class="hot-info">
                        <span class="hot-name">${h.item}</span>
                        <span class="hot-price">₹${h.lastAmount} · ${h.count}×</span>
                    </div>
                    <button type="button" class="hot-chip-add" aria-label="Add ${h.item} again">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
            `
                )
                .join("")}
        </div>
    `;

    wrap.querySelectorAll(".hot-chip").forEach((chip) => {
        const hot = hotItems.find((h) => h.canonicalKey === chip.dataset.canonical);
        chip.addEventListener("click", () => addExpense(hot.item, hot.lastAmount));
    });
}

/* ---------- rendering: ledger ---------- */

function formatLedgerDate(iso) {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    if (sameDay) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

function renderLedger() {
    const data = loadDashData();
    const monthExpenses = getMonthExpenses(data.expenses);
    const list = document.getElementById("ledgerList");
    const countEl = document.getElementById("ledgerCount");

    countEl.textContent = monthExpenses.length ? `${monthExpenses.length} entries` : "";

    if (monthExpenses.length === 0) {
        list.innerHTML = `
            <div class="ledger-empty">
                <i class="fa-solid fa-receipt"></i>
                No expenses yet — add your first one above.
            </div>
        `;
        return;
    }

    list.innerHTML = monthExpenses
        .map((e) => {
            const st = styleForCategory(e.category);
            const icon = e.icon || st.icon;
            const color = e.color || st.color;
            return `
        <div class="ledger-item-row">
            <div class="ledger-item-icon" style="color:${color};background:${color}1E">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div class="ledger-item-info">
                <b>${e.item}</b>
                <div class="ledger-item-meta">
                    <span class="cat-pill">${e.category}</span>
                    <span>${formatLedgerDate(e.date)}</span>
                </div>
            </div>
            <div class="ledger-item-amount">− ₹${e.amount}</div>
            <button type="button" class="ledger-delete-btn" data-id="${e.id}" aria-label="Delete expense">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
        })
        .join("");

    list.querySelectorAll(".ledger-delete-btn").forEach((btn) => {
        btn.addEventListener("click", () => deleteExpense(btn.dataset.id));
    });
}

/* ---------- 3D flip card ---------- */

function initFlipCard() {
    const card = document.getElementById("chartCard");
    if (!card) return;

    let angle = 0;
    let startX = 0;
    let startAngle = 0;
    let dragging = false;
    let moved = false;

    function apply() {
        card.style.transform = `rotateY(${angle}deg)`;
    }

    function flipToNearest(forceNext) {
        const target = forceNext ? startAngle + 180 : Math.round(angle / 180) * 180;
        angle = target;
        apply();
    }

    card.addEventListener("pointerdown", (e) => {
        dragging = true;
        moved = false;
        startX = e.clientX;
        startAngle = angle;
        card.classList.add("dragging");
        card.setPointerCapture(e.pointerId);
    });

    card.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const deltaX = e.clientX - startX;
        if (Math.abs(deltaX) > 4) moved = true;
        angle = startAngle + deltaX * 0.6;
        apply();
    });

    function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        card.classList.remove("dragging");
        flipToNearest(!moved);
    }

    card.addEventListener("pointerup", endDrag);
    card.addEventListener("pointercancel", endDrag);

    card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            startAngle = angle;
            flipToNearest(true);
        }
    });

    const flipFront = document.getElementById("flipBtnFront");
    const flipBack = document.getElementById("flipBtnBack");

    [flipFront, flipBack].forEach((btn) => {
        if (!btn) return;
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            startAngle = angle;
            flipToNearest(true);
        });
    });
}

/* ---------- quick add form ---------- */

function initQuickAddForm() {
    const form = document.getElementById("quickAddForm");
    const itemInput = document.getElementById("itemInput");
    const preview = document.getElementById("itemPreview");
    const categoryTag = document.getElementById("itemCategoryTag");

    itemInput.addEventListener("input", () => {
        const val = itemInput.value.trim();
        if (val.length < 2) {
            preview.classList.remove("show");
            categoryTag.classList.remove("show");
            return;
        }
        const cat = detectCategory(val);
        preview.innerHTML = `<i class="fa-solid ${cat.icon}"></i>`;
        preview.style.color = cat.color;
        categoryTag.textContent = cat.name;
        preview.classList.add("show");
        categoryTag.classList.add("show");
    });

    form.addEventListener("submit", (e) => {
        e.preventDefault();

        const item = itemInput.value.trim();
        const priceInput = document.getElementById("priceInput");
        const price = Number(priceInput.value);

        if (item.length < 2) {
            showToast("Tell us what you bought first", "error");
            itemInput.focus();
            return;
        }

        if (!price || price <= 0) {
            showToast("Enter a valid amount", "error");
            priceInput.focus();
            return;
        }

        addExpense(item, price);

        form.reset();
        preview.classList.remove("show");
        categoryTag.classList.remove("show");
        itemInput.focus();
    });
}

/* ---------- init ---------- */

function renderAll() {
    renderGreeting();
    renderBudget();
    renderWeeklyChart();
    renderDonut();
    renderHotTopics();
    renderLedger();
}

document.addEventListener("DOMContentLoaded", () => {
    renderAll();
    initFlipCard();
    initQuickAddForm();
});