/*==========================================
  DR. WALLET — TRACKER CORE
  Shared by dashboard.html and about.html.

  This holds everything that isn't specific to one page's
  layout: reading/writing expense data, smart category
  detection, the computed stats, and the two chart
  renderers (weekly graph + category donut) plus the 3D
  flip-card mechanics. Both renderWeeklyChart() and
  renderDonut() take a container id, and initFlipCard()
  takes its element ids, so the exact same widget can be
  dropped into more than one page.

  Whenever expense data changes, a "drwallet:data-changed"
  event is dispatched on document — pages listen for that
  to know when to re-render.
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
    { name: "Food & Mess", icon: "fa-utensils", keywords: ["food", "mess", "meal", "lunch", "dinner", "breakfast", "thali", "dhaba", "canteen", "tiffin"] },
    { name: "Coffee & Tea", icon: "fa-mug-hot", keywords: ["coffee", "chai", "tea", "latte", "cappuccino"] },
    { name: "Snacks", icon: "fa-cookie-bite", keywords: ["snack", "chips", "maggi", "samosa", "momo", "momos", "burger", "pizza", "fries", "sandwich", "icecream"] },
    { name: "Drinks", icon: "fa-glass-water", keywords: ["juice", "cold drink", "coke", "pepsi", "soda", "drink", "shake"] },
    { name: "Transport", icon: "fa-bus", keywords: ["bus", "auto", "cab", "uber", "ola", "metro", "train", "fuel", "petrol", "rickshaw", "rapido"] },
    { name: "Books & Stationery", icon: "fa-book", keywords: ["book", "notebook", "pen", "pencil", "stationery", "xerox", "print", "photocopy", "assignment"] },
    { name: "Hostel & Rent", icon: "fa-house", keywords: ["rent", "hostel", "room", "pg", "maintenance"] },
    { name: "Entertainment", icon: "fa-film", keywords: ["movie", "netflix", "spotify", "game", "party", "fest", "concert", "outing"] },
    { name: "Shopping", icon: "fa-bag-shopping", keywords: ["shopping", "clothes", "shoes", "dress", "amazon", "flipkart", "tshirt"] },
    { name: "Health", icon: "fa-pills", keywords: ["medicine", "doctor", "hospital", "gym", "health", "pharmacy"] },
    { name: "Recharge & Bills", icon: "fa-mobile-screen", keywords: ["recharge", "mobile", "wifi", "subscription", "sim", "bill"] },
];

const DEFAULT_CATEGORY = { name: "Other", icon: "fa-wallet" };

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
        date: new Date().toISOString(),
        canonicalKey,
    };

    data.expenses.unshift(expense);
    saveDashData(data);

    showToast(`Added "${expense.item}" — ₹${expense.amount}`, "success");
    document.dispatchEvent(new CustomEvent("drwallet:data-changed"));
}

function deleteExpense(id) {
    const data = loadDashData();
    data.expenses = data.expenses.filter((e) => e.id !== id);
    saveDashData(data);

    showToast("Expense removed", "info");
    document.dispatchEvent(new CustomEvent("drwallet:data-changed"));
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

const CATEGORY_COLORS = ["#6D5EF5", "#0D9488", "#D97706", "#E11D48", "#8B7CF6", "#14B8A6", "#EC4899", "#6B6280"];

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

    return arr.map((c, i) => ({
        ...c,
        pct: totalAll ? (c.total / totalAll) * 100 : 0,
        color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
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
            return {
                canonicalKey: latest.canonicalKey,
                item: latest.item,
                icon: latest.icon,
                category: latest.category,
                lastAmount: latest.amount,
                count: g.length,
            };
        })
        .sort((a, b) => b.count - a.count);
}

/* ---------- rendering: weekly SVG graph ----------
   containerId defaults to "weeklyChartWrap" (the dashboard's id)
   so existing calls don't need to change. */

function renderWeeklyChart(containerId = "weeklyChartWrap") {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;

    const data = loadDashData();
    const series = computeWeeklySeries(data.expenses);
    const hasAny = series.some((d) => d.total > 0);

    if (!hasAny) {
        wrap.innerHTML = `
            <div class="chart-empty-note">
                <i class="fa-solid fa-chart-line"></i>
                No spending logged this week yet.<br>Add an expense on your dashboard to see your trend.
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

    // Each rendered instance needs its own gradient id (an about-page
    // copy and a dashboard copy on the same tab would otherwise collide).
    const gradId = `areaGrad_${containerId}`;

    const circles = points
        .map((p) => `<circle cx="${p.x}" cy="${p.y.toFixed(1)}" r="5" fill="#6D5EF5" stroke="#fff" stroke-width="2"><title>${p.label}: ₹${p.total}</title></circle>`)
        .join("");

    wrap.innerHTML = `
        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#6D5EF5" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="#6D5EF5" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <path d="${areaPath}" fill="url(#${gradId})"/>
            <path d="${linePath}" fill="none" stroke="#6D5EF5" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            ${circles}
        </svg>
        <div class="chart-day-labels">
            ${series.map((d) => `<span>${d.label}</span>`).join("")}
        </div>
    `;
}

/* ---------- rendering: category donut ---------- */

function renderDonut(containerId = "donutWrap") {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;

    const data = loadDashData();
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

/* ---------- 3D flip card ----------
   Ids default to the dashboard's original ids, so existing calls
   don't need to change; pass different ids to run a second, independent
   copy of the widget elsewhere on the same page (e.g. about.html). */

function initFlipCard(cardId = "chartCard", frontBtnId = "flipBtnFront", backBtnId = "flipBtnBack") {
    const card = document.getElementById(cardId);
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

    function endDrag() {
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

    const flipFront = document.getElementById(frontBtnId);
    const flipBack = document.getElementById(backBtnId);

    [flipFront, flipBack].forEach((btn) => {
        if (!btn) return;
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            startAngle = angle;
            flipToNearest(true);
        });
    });
}