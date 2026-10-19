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

function getCurrentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getSelectedMonthKey() {
    return document.getElementById("reportMonth")?.value || getCurrentMonthKey();
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

function getMonthExpenses(expenses, monthKey = getCurrentMonthKey()) {
    return expenses.filter((expense) => formatDateInput(expense.date).slice(0, 7) === monthKey);
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
    const beforeTotal = getMonthExpenses(data.expenses).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const cat = detectCategory(itemRaw);
    const existingKeys = [...new Set(data.expenses.map((e) => e.canonicalKey).filter(Boolean))];
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
    notifyBudgetThresholdCrossing(beforeTotal, beforeTotal + expense.amount, data.budget?.amount || 0);
    const reportMonth = document.getElementById("reportMonth");
    if (reportMonth) reportMonth.value = getCurrentMonthKey();
    renderAll();

    showToast(`Added "${expense.item}" — ₹${expense.amount}`, "success");
}

function deleteExpense(id) {
    const data = loadDashData();
    const index = data.expenses.findIndex((expense) => expense.id === id);
    if (index < 0) return;
    const [deletedExpense] = data.expenses.splice(index, 1);
    saveDashData(data);
    renderAll();
    showUndoToast(deletedExpense, index, getDashDataKey());
}

function showUndoToast(expense, index, storageKey) {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "toast info undo-toast";
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-circle-info";
    const message = document.createElement("span");
    message.textContent = `Removed ${expense.item}`;
    const undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.className = "toast-undo-btn";
    undoButton.textContent = "Undo";
    toast.append(icon, message, undoButton);
    container.appendChild(toast);

    let dismissed = false;
    const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        clearTimeout(timer);
        toast.classList.add("hide");
        setTimeout(() => toast.remove(), 300);
    };

    undoButton.addEventListener("click", () => {
        if (dismissed) return;
        const current = JSON.parse(localStorage.getItem(storageKey) || '{"budget":null,"expenses":[]}');
        if (!current.expenses.some((record) => record.id === expense.id)) {
            current.expenses.splice(Math.min(index, current.expenses.length), 0, expense);
            localStorage.setItem(storageKey, JSON.stringify(current));
            renderAll();
            showToast("Expense restored", "success");
        }
        dismiss();
    });

    const timer = setTimeout(dismiss, 6000);
}

function notifyBudgetThresholdCrossing(beforeTotal, afterTotal, budget) {
    if (!budget || budget <= 0) return;

    if (beforeTotal < budget && afterTotal >= budget) {
        if (afterTotal > budget) {
            showToast(`You've exceeded your monthly budget by ₹${Math.round(afterTotal - budget).toLocaleString("en-IN")}`, "warning");
        } else {
            showToast("You've reached your monthly budget", "warning");
        }
    } else if (beforeTotal < budget * 0.8 && afterTotal >= budget * 0.8) {
        showToast("You've used 80% of your monthly budget", "warning");
    }
}

/* ---------- computed stats ---------- */

function computeStats(data, monthKey = getCurrentMonthKey()) {
    const monthExpenses = getMonthExpenses(data.expenses, monthKey);
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
    const monthExpenses = getMonthExpenses(expenses, getSelectedMonthKey());
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
    const displayName = session ? getSessionDisplayName(session) : "there";
    const greetingName = session && (session.displayPreference || "name") === "name"
        ? displayName.split(" ")[0]
        : displayName;
    document.getElementById("dashGreeting").textContent = `Hey, ${greetingName}`;
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
        const spentThisMonth = getMonthExpenses(data.expenses).reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
        data.budget = { amount: val, setAt: new Date().toISOString() };
        saveDashData(data);

        closeModal();
        renderAll();
        showToast("Budget saved!", "success");
        if (spentThisMonth > val) {
            showToast(`You've already exceeded this budget by ₹${Math.round(spentThisMonth - val).toLocaleString("en-IN")}`, "warning");
        } else if (spentThisMonth >= val * 0.8) {
            showToast("You've already used 80% of this budget", "warning");
        }
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
    const monthLabel = formatMonthLabel(getSelectedMonthKey());
    const monthLabelEl = document.querySelector(".chart-back .chart-face-head span");
    if (monthLabelEl) monthLabelEl.textContent = monthLabel;

    if (breakdown.length === 0) {
        wrap.innerHTML = `
            <div class="chart-empty-note">
                <i class="fa-solid fa-chart-pie"></i>
                No expenses for ${monthLabel} yet.<br>Your category breakdown will show up here.
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
                <span>${monthLabel}</span>
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

function formatMonthLabel(monthKey) {
    const [year, month] = monthKey.split("-").map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function renderMonthlyReport() {
    const data = loadDashData();
    const monthKey = getSelectedMonthKey();
    const expenses = getMonthExpenses(data.expenses, monthKey);
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const average = expenses.length ? Math.round(total / expenses.length) : 0;
    const report = document.getElementById("monthlyReport");
    const currentBudget = monthKey === getCurrentMonthKey() && data.budget ? data.budget.amount : null;

    report.innerHTML = `
        <div class="monthly-report-stat">
            <span>Total spent · ${formatMonthLabel(monthKey)}</span>
            <strong>₹${total.toLocaleString("en-IN")}</strong>
        </div>
        <div class="monthly-report-stat">
            <span>Transactions</span>
            <strong>${expenses.length}</strong>
        </div>
        <div class="monthly-report-stat">
            <span>Average per transaction</span>
            <strong>₹${average.toLocaleString("en-IN")}</strong>
        </div>
        ${currentBudget ? `<div class="monthly-report-stat"><span>Monthly budget</span><strong>₹${Number(currentBudget).toLocaleString("en-IN")}</strong></div>` : ""}
    `;
    renderSpendingInsights(data.expenses, monthKey, total);
}

function renderSpendingInsights(allExpenses, monthKey, currentTotal) {
    const insight = document.getElementById("monthlyInsight");
    if (!insight) return;

    const [year, month] = monthKey.split("-").map(Number);
    const previousDate = new Date(year, month - 2, 1);
    const previousMonthKey = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
    const previousExpenses = getMonthExpenses(allExpenses, previousMonthKey);
    const previousTotal = previousExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
    const currentExpenses = getMonthExpenses(allExpenses, monthKey);

    let headline;
    let detail = "";
    let trend = "steady";
    if (currentTotal === 0 && previousTotal === 0) {
        headline = "Your spending insights will appear here";
        detail = "Log expenses for this month to start building a spending comparison.";
    } else if (previousTotal === 0) {
        headline = `You’ve spent ₹${currentTotal.toLocaleString("en-IN")} this month`;
        detail = `There’s no spending history for ${formatMonthLabel(previousMonthKey)} to compare yet.`;
        trend = "up";
    } else if (currentTotal === 0) {
        headline = `No spending recorded for ${formatMonthLabel(monthKey)} yet`;
        detail = `You spent ₹${previousTotal.toLocaleString("en-IN")} in ${formatMonthLabel(previousMonthKey)}.`;
        trend = "down";
    } else {
        const difference = currentTotal - previousTotal;
        const percent = Math.round(Math.abs(difference / previousTotal) * 100);
        if (difference > 0) {
            headline = `Spending is up ${percent}% from last month`;
            detail = `That’s ₹${difference.toLocaleString("en-IN")} more than ${formatMonthLabel(previousMonthKey)}.`;
            trend = "up";
        } else if (difference < 0) {
            headline = `Spending is down ${percent}% from last month`;
            detail = `You’ve spent ₹${Math.abs(difference).toLocaleString("en-IN")} less than ${formatMonthLabel(previousMonthKey)}.`;
            trend = "down";
        } else {
            headline = "Your spending matches last month";
            detail = `You’ve spent ₹${currentTotal.toLocaleString("en-IN")} in both months.`;
        }

        const categoryTotals = (expenses) => expenses.reduce((totals, expense) => {
            totals[expense.category] = (totals[expense.category] || 0) + Number(expense.amount || 0);
            return totals;
        }, {});
        const thisCategories = categoryTotals(currentExpenses);
        const lastCategories = categoryTotals(previousExpenses);
        const biggestIncrease = Object.entries(thisCategories)
            .map(([category, amount]) => ({ category, difference: amount - (lastCategories[category] || 0) }))
            .filter((entry) => entry.difference > 0)
            .sort((a, b) => b.difference - a.difference)[0];
        if (biggestIncrease) {
            detail += ` ${biggestIncrease.category} is your biggest increase (+₹${biggestIncrease.difference.toLocaleString("en-IN")}).`;
        }
    }

    insight.className = `monthly-insight trend-${trend}`;
    insight.innerHTML = `<i class="fa-solid ${trend === "up" ? "fa-arrow-trend-up" : trend === "down" ? "fa-arrow-trend-down" : "fa-lightbulb"}" aria-hidden="true"></i><div><strong>${escapeHtml(headline)}</strong><span>${escapeHtml(detail)}</span></div>`;
}

function getFilteredLedgerExpenses(expenses) {
    const query = document.getElementById("ledgerSearch").value.trim().toLowerCase();
    const category = document.getElementById("ledgerCategory").value;
    const fromDate = document.getElementById("ledgerDateFrom").value;
    const toDate = document.getElementById("ledgerDateTo").value;
    const minValue = document.getElementById("ledgerMinAmount").value;
    const maxValue = document.getElementById("ledgerMaxAmount").value;
    const minAmount = minValue === "" ? null : Number(minValue);
    const maxAmount = maxValue === "" ? null : Number(maxValue);

    const filtered = expenses.filter((expense) => {
        const matchesQuery = !query || `${expense.item} ${expense.category}`.toLowerCase().includes(query);
        const matchesCategory = category === "all" || expense.category === category;
        const expenseDate = formatDateInput(expense.date);
        const matchesDate = (!fromDate || expenseDate >= fromDate) && (!toDate || expenseDate <= toDate);
        const amount = Number(expense.amount || 0);
        const matchesAmount = (minAmount === null || amount >= minAmount) && (maxAmount === null || amount <= maxAmount);
        return matchesQuery && matchesCategory && matchesDate && matchesAmount;
    });
    const sortBy = document.getElementById("ledgerSort")?.value || "newest";
    const sorters = {
        newest: (a, b) => new Date(b.date) - new Date(a.date),
        oldest: (a, b) => new Date(a.date) - new Date(b.date),
        highest: (a, b) => Number(b.amount) - Number(a.amount),
        lowest: (a, b) => Number(a.amount) - Number(b.amount),
    };
    return filtered.sort(sorters[sortBy] || sorters.newest);
}

function ledgerFiltersAreActive() {
    return Boolean(
        document.getElementById("ledgerSearch").value.trim() ||
        document.getElementById("ledgerCategory").value !== "all" ||
        document.getElementById("ledgerDateFrom").value ||
        document.getElementById("ledgerDateTo").value ||
        document.getElementById("ledgerMinAmount").value ||
        document.getElementById("ledgerMaxAmount").value
    );
}

function renderLedger() {
    const data = loadDashData();
    const monthKey = getSelectedMonthKey();
    const monthExpenses = getMonthExpenses(data.expenses, monthKey);
    const visibleExpenses = getFilteredLedgerExpenses(monthExpenses);
    const list = document.getElementById("ledgerList");
    const countEl = document.getElementById("ledgerCount");
    const filtersActive = ledgerFiltersAreActive();

    document.getElementById("ledgerTitle").textContent = `${formatMonthLabel(monthKey)} Transactions`;
    countEl.textContent = filtersActive
        ? `${visibleExpenses.length} of ${monthExpenses.length} entries`
        : `${monthExpenses.length} ${monthExpenses.length === 1 ? "entry" : "entries"}`;

    if (monthExpenses.length === 0) {
        list.innerHTML = `
            <div class="ledger-empty">
                <i class="fa-solid fa-receipt"></i>
                No expenses recorded for ${formatMonthLabel(monthKey)}.
            </div>
        `;
        return;
    }

    if (visibleExpenses.length === 0) {
        list.innerHTML = `
            <div class="ledger-empty">
                <i class="fa-solid fa-filter-circle-xmark"></i>
                No transactions match these filters.
            </div>
        `;
        return;
    }

    list.innerHTML = visibleExpenses
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
                <b>${escapeHtml(e.item)}</b>
                <div class="ledger-item-meta">
                    <span class="cat-pill">${e.category}</span>
                    <span>${formatLedgerDate(e.date)}</span>
                </div>
            </div>
            <div class="ledger-item-amount">− ₹${Number(e.amount).toLocaleString("en-IN")}</div>
            <div class="ledger-row-actions">
                <button type="button" class="ledger-edit-btn" data-id="${e.id}" aria-label="Edit ${escapeHtml(e.item)}">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button type="button" class="ledger-delete-btn" data-id="${e.id}" aria-label="Delete ${escapeHtml(e.item)}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>
    `;
        })
        .join("");

    list.querySelectorAll(".ledger-edit-btn").forEach((btn) => {
        btn.addEventListener("click", () => openExpenseEditModal(btn.dataset.id));
    });
    list.querySelectorAll(".ledger-delete-btn").forEach((btn) => {
        btn.addEventListener("click", () => deleteExpense(btn.dataset.id));
    });
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]);
}

function formatDateInput(isoDate) {
    const date = new Date(isoDate);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function openExpenseEditModal(expenseId) {
    const data = loadDashData();
    const expense = data.expenses.find((record) => record.id === expenseId);
    if (!expense) return;

    const oldOverlay = document.getElementById("expenseEditOverlay");
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.id = "expenseEditOverlay";
    overlay.innerHTML = `
        <div class="modal-box">
            <div class="modal-head">
                <h3>Edit Expense</h3>
                <button type="button" class="modal-close" id="closeExpenseEdit" aria-label="Close">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <form id="expenseEditForm" novalidate>
                <div class="form-group">
                    <label for="editExpenseItem">Item</label>
                    <input type="text" id="editExpenseItem" name="item" value="${escapeHtml(expense.item)}" maxlength="100" required>
                    <span class="error-text" data-error-for="item"></span>
                </div>
                <div class="form-group">
                    <label for="editExpenseAmount">Amount (₹)</label>
                    <input type="number" id="editExpenseAmount" name="amount" min="1" step="1" value="${Number(expense.amount)}" required>
                    <span class="error-text" data-error-for="amount"></span>
                </div>
                <div class="form-group">
                    <label for="editExpenseDate">Date</label>
                    <input type="date" id="editExpenseDate" name="date" value="${formatDateInput(expense.date)}" required>
                    <span class="error-text" data-error-for="date"></span>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn btn-ghost" id="cancelExpenseEdit">Cancel</button>
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
    overlay.querySelector("#closeExpenseEdit").addEventListener("click", closeModal);
    overlay.querySelector("#cancelExpenseEdit").addEventListener("click", closeModal);
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeModal();
    });

    overlay.querySelector("#expenseEditForm").addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        form.querySelectorAll(".error-text").forEach((error) => (error.textContent = ""));

        const item = form.elements.namedItem("item").value.trim();
        const amount = Number(form.elements.namedItem("amount").value);
        const dateValue = form.elements.namedItem("date").value;
        let valid = true;

        if (item.length < 2) {
            form.querySelector('[data-error-for="item"]').textContent = "Enter an item name";
            valid = false;
        }
        if (!Number.isFinite(amount) || amount <= 0) {
            form.querySelector('[data-error-for="amount"]').textContent = "Enter an amount greater than zero";
            valid = false;
        }
        if (!dateValue || Number.isNaN(new Date(`${dateValue}T12:00:00`).getTime())) {
            form.querySelector('[data-error-for="date"]').textContent = "Choose a valid date";
            valid = false;
        }
        if (!valid) return;

        const latestData = loadDashData();
        const current = latestData.expenses.find((record) => record.id === expenseId);
        if (!current) return closeModal();

        const beforeTotal = getMonthExpenses(latestData.expenses).reduce((sum, record) => sum + Number(record.amount || 0), 0);
        const category = detectCategory(item);
        const existingKeys = [...new Set(latestData.expenses.filter((record) => record.id !== expenseId).map((record) => record.canonicalKey).filter(Boolean))];
        latestData.expenses = latestData.expenses.map((record) => record.id === expenseId
            ? {
                ...record,
                item,
                amount,
                date: new Date(`${dateValue}T12:00:00`).toISOString(),
                category: category.name,
                icon: category.icon,
                color: category.color,
                canonicalKey: getCanonicalKey(item, existingKeys),
            }
            : record
        );
        const afterTotal = getMonthExpenses(latestData.expenses).reduce((sum, record) => sum + Number(record.amount || 0), 0);
        saveDashData(latestData);
        notifyBudgetThresholdCrossing(beforeTotal, afterTotal, latestData.budget?.amount || 0);
        closeModal();
        renderAll();
        showToast("Expense updated", "success");
    });
}

function csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function exportLedgerCsv() {
    const monthKey = getSelectedMonthKey();
    const expenses = getFilteredLedgerExpenses(getMonthExpenses(loadDashData().expenses, monthKey));
    if (expenses.length === 0) {
        showToast("There are no matching transactions to export", "info");
        return;
    }

    const rows = [
        ["Date", "Item", "Category", "Amount (INR)"],
        ...expenses.map((expense) => [
            formatDateInput(expense.date),
            expense.item,
            expense.category,
            Number(expense.amount || 0),
        ]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const download = document.createElement("a");
    download.href = url;
    download.download = `dr-wallet-transactions-${monthKey}.csv`;
    document.body.appendChild(download);
    download.click();
    download.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(`Exported ${expenses.length} transaction${expenses.length === 1 ? "" : "s"}`, "success");
}

function initLedgerControls() {
    const reportMonth = document.getElementById("reportMonth");
    reportMonth.value = getCurrentMonthKey();

    const categoryFilter = document.getElementById("ledgerCategory");
    CATEGORY_MAP.map((category) => category.name).concat(DEFAULT_CATEGORY.name).forEach((category) => {
        categoryFilter.add(new Option(category, category));
    });

    ["ledgerSearch", "ledgerCategory", "ledgerSort", "ledgerDateFrom", "ledgerDateTo", "ledgerMinAmount", "ledgerMaxAmount"]
        .forEach((id) => {
            const control = document.getElementById(id);
            control.addEventListener(id === "ledgerSearch" || id.includes("Amount") ? "input" : "change", renderLedger);
        });

    reportMonth.addEventListener("change", () => {
        renderMonthlyReport();
        renderDonut();
        renderLedger();
    });
    document.getElementById("clearLedgerFilters").addEventListener("click", () => {
        ["ledgerSearch", "ledgerDateFrom", "ledgerDateTo", "ledgerMinAmount", "ledgerMaxAmount"].forEach((id) => {
            document.getElementById(id).value = "";
        });
        categoryFilter.value = "all";
        renderLedger();
    });
    document.getElementById("exportCsvBtn").addEventListener("click", exportLedgerCsv);
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
    renderMonthlyReport();
    renderWeeklyChart();
    renderDonut();
    renderHotTopics();
    renderLedger();
}

document.addEventListener("DOMContentLoaded", () => {
    initLedgerControls();
    renderAll();
    initFlipCard();
    initQuickAddForm();
});
