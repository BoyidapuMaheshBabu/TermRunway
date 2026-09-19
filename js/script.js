// ==========================================================
// TERMRUNWAY VERSION 2
// Student Financial Planning Dashboard
//
// Core model:
//
// Available Money Now
//        +
// Expected Future Income
//        -
// Remaining Planned Expenses
//        =
// Projected Balance
//
// Actual expenses are tracked separately so they can be
// compared with the plan without double-counting them.
//
// ==========================================================


// ==========================================================
// 1. STORAGE
// ==========================================================

const STORAGE_KEY = "termRunwayV2";


// ==========================================================
// 2. DATA DEFINITIONS
// ==========================================================

const incomeFields = [
    {
        id: "income-scholarship",
        label: "Scholarship"
    },
    {
        id: "income-part-time",
        label: "Part-time job"
    },
    {
        id: "income-parents",
        label: "Parents support"
    },
    {
        id: "income-freelance",
        label: "Freelance / gigs"
    },
    {
        id: "income-other",
        label: "Other income"
    }
];


const expenseFields = [
    {
        id: "expense-rent",
        label: "Rent / hostel",
        key: "rent"
    },
    {
        id: "expense-food",
        label: "Food",
        key: "food"
    },
    {
        id: "expense-transport",
        label: "Transport",
        key: "transport"
    },
    {
        id: "expense-utilities",
        label: "Utilities",
        key: "utilities"
    },
    {
        id: "expense-entertainment",
        label: "Entertainment",
        key: "entertainment"
    },
    {
        id: "expense-other",
        label: "Other expenses",
        key: "other"
    }
];


const categoryNames = {
    rent: "Rent / hostel",
    food: "Food",
    transport: "Transport",
    utilities: "Utilities",
    entertainment: "Entertainment",
    other: "Other expenses"
};


// ==========================================================
// 3. APPLICATION STATE
// ==========================================================

let isMonthlyMode = false;

let transactions = [];

let savedGoal = null;

let cashflowChart = null;

let expenseChart = null;

let forecastChart = null;


// ==========================================================
// 4. DOM HELPER
// ==========================================================

function $(id) {
    return document.getElementById(id);
}


// ==========================================================
// 5. NUMBER HELPER
// ==========================================================

function getNumber(id) {

    const element = $(id);

    if (!element) {
        return 0;
    }

    const value = Number.parseFloat(element.value);

    if (!Number.isFinite(value)) {
        return 0;
    }

    return Math.max(0, value);
}


// ==========================================================
// 6. MONEY FORMAT
// ==========================================================

function formatMoney(value) {

    const amount = Number(value) || 0;

    return new Intl.NumberFormat("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
}


// ==========================================================
// 7. COMPACT MONEY FORMAT
// ==========================================================

function formatCompactMoney(value) {

    const amount = Number(value) || 0;

    return new Intl.NumberFormat("en-IN", {
        notation: amount >= 100000 ? "compact" : "standard",
        maximumFractionDigits: amount >= 100000 ? 1 : 0
    }).format(amount);
}


// ==========================================================
// 8. TEXT HELPER
// ==========================================================

function setText(id, value) {

    const element = $(id);

    if (element) {
        element.textContent = value;
    }
}


// ==========================================================
// 9. ESCAPE HTML
// ==========================================================

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ==========================================================
// 10. DATE HELPERS
// ==========================================================

function localToday() {

    const now = new Date();

    return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate()
    );
}


function parseDate(value) {

    if (!value) {
        return null;
    }

    const parts = value.split("-").map(Number);

    if (parts.length !== 3) {
        return null;
    }

    const year = parts[0];
    const month = parts[1];
    const day = parts[2];

    const date = new Date(
        year,
        month - 1,
        day
    );

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}


function dateToInputValue(date) {

    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// ==========================================================
// 11. DAYS BETWEEN TWO DATES
// ==========================================================

function daysBetween(startDate, endDate) {

    const millisecondsPerDay = 86400000;

    return Math.max(
        0,
        Math.ceil(
            (
                endDate.getTime() -
                startDate.getTime()
            ) /
            millisecondsPerDay
        )
    );
}


// ==========================================================
// 12. DAYS REMAINING
// ==========================================================

function getDaysRemaining(
    startDateValue,
    endDateValue
) {

    const today = localToday();

    const planStart =
        parseDate(startDateValue) ||
        today;

    const endDate =
        parseDate(endDateValue);

    if (
        !endDate ||
        endDate <= planStart
    ) {
        return 0;
    }

    const effectiveStart =
        planStart > today
            ? planStart
            : today;

    return daysBetween(
        effectiveStart,
        endDate
    );
}


// ==========================================================
// 13. EXACT CALENDAR-MONTH PROJECTION
//
// This does NOT use:
//
// 365 / 12
//
// Instead, each month is calculated according to its
// actual number of calendar days.
//
// Example:
//
// Monthly expense = ₹3000
//
// 30 days in month
//
// 15 days remaining
//
// Projection = ₹3000 × 15 / 30
// ==========================================================

function projectMonthlyAmount(
    monthlyAmount,
    startDateValue,
    endDateValue
) {

    if (monthlyAmount <= 0) {
        return 0;
    }

    const startDate =
        parseDate(startDateValue) ||
        localToday();

    const endDate = parseDate(
        endDateValue
    );

    if (
        !endDate ||
        endDate <= startDate
    ) {
        return 0;
    }

    let cursor = new Date(
        startDate
    );

    let projectedAmount = 0;

    const millisecondsPerDay = 86400000;

    while (cursor < endDate) {

        const year =
            cursor.getFullYear();

        const month =
            cursor.getMonth();

        const daysInMonth =
            new Date(
                year,
                month + 1,
                0
            ).getDate();

        // First day of next month.
        const nextMonth =
            new Date(
                year,
                month + 1,
                1
            );

        // We calculate [cursor, periodEnd)
        const periodEnd =
            endDate < nextMonth
                ? endDate
                : nextMonth;

        const daysCovered =
            Math.max(
                0,
                Math.ceil(
                    (
                        periodEnd.getTime() -
                        cursor.getTime()
                    ) /
                    millisecondsPerDay
                )
            );

        projectedAmount +=
            monthlyAmount *
            (
                daysCovered /
                daysInMonth
            );

        cursor = nextMonth;
    }

    return projectedAmount;
}


// ==========================================================
// 14. MODE SWITCH
// ==========================================================

function setMode(monthly) {

    isMonthlyMode = monthly;

    $("btn-monthly")
        .classList
        .toggle(
            "active",
            monthly
        );

    $("btn-semester")
        .classList
        .toggle(
            "active",
            !monthly
        );

    if (monthly) {

        $("mode-description").textContent =
            "Use recurring monthly income and expenses for the remaining calendar period.";

        $("income-desc").textContent =
            "Enter your average monthly income.";

        $("expense-desc").textContent =
            "Enter your average monthly expenses.";

    } else {

        $("mode-description").textContent =
            "Enter amounts that cover your whole semester.";

        $("income-desc").textContent =
            "Enter income you expect to receive during the semester.";

        $("expense-desc").textContent =
            "Enter your estimated expenses for the semester.";
    }

    saveData();
}


$("btn-semester").addEventListener(
    "click",
    () => setMode(false)
);


$("btn-monthly").addEventListener(
    "click",
    () => setMode(true)
);


// ==========================================================
// 15. INPUT TOTALS
// ==========================================================

function getIncomeTotal() {

    return incomeFields.reduce(
        (total, field) => {

            return (
                total +
                getNumber(field.id)
            );

        },
        0
    );
}


function getExpenseTotal() {

    return expenseFields.reduce(
        (total, field) => {

            return (
                total +
                getNumber(field.id)
            );

        },
        0
    );
}


// ==========================================================
// 16. PLANNED CATEGORY DATA
// ==========================================================

function getPlannedCategories(
    startDateValue,
    endDateValue
) {

    return expenseFields.map(
        field => {

            const entered =
                getNumber(field.id);

            const planned =
                isMonthlyMode
                    ? projectMonthlyAmount(
                        entered,
                        startDateValue,
                        endDateValue
                    )
                    : entered;

            return {
                key: field.key,
                label: field.label,
                planned
            };
        }
    );
}


// ==========================================================
// 17. ACTUAL CATEGORY DATA
// ==========================================================

function getActualCategories(
    startDateValue,
    endDateValue
) {

    const planStart =
        parseDate(startDateValue) ||
        localToday();

    const planEnd =
        parseDate(endDateValue);

    const today =
        localToday();

    return expenseFields.map(
        field => {

            const actual =
                transactions.reduce(
                    (
                        total,
                        transaction
                    ) => {

                        const transactionDate =
                            parseDate(
                                transaction.date
                            );

                        const isWithinPeriod =
                            transactionDate &&
                            transactionDate >= planStart &&
                            planEnd &&
                            transactionDate <= planEnd &&
                            transactionDate <= today;

                        if (
                            transaction.category ===
                            field.key &&
                            isWithinPeriod &&
                            Number.isFinite(
                                transaction.amount
                            )
                        ) {

                            return (
                                total +
                                Math.max(
                                    0,
                                    transaction.amount
                                )
                            );
                        }

                        return total;
                    },
                    0
                );

            return {
                key: field.key,
                label: field.label,
                actual
            };
        }
    );
}


// ==========================================================
// 18. COMBINE PLANNED + ACTUAL
// ==========================================================

function getCategoryRows(
    startDateValue,
    endDateValue
) {

    const planned =
        getPlannedCategories(
            startDateValue,
            endDateValue
        );

    const actual =
        getActualCategories(
            startDateValue,
            endDateValue
        );


    return planned.map(
        plannedItem => {

            const actualItem =
                actual.find(
                    item =>
                        item.key ===
                        plannedItem.key
                );

            const actualAmount =
                actualItem
                    ? actualItem.actual
                    : 0;

            return {

                key:
                    plannedItem.key,

                label:
                    plannedItem.label,

                planned:
                    plannedItem.planned,

                actual:
                    actualAmount,

                remaining:
                    Math.max(
                        0,
                        plannedItem.planned -
                        actualAmount
                    ),

                variance:
                    plannedItem.planned -
                    actualAmount

            };
        }
    );
}


// ==========================================================
// 19. MAIN FINANCIAL MODEL
// ==========================================================

function calculateModel() {

    const availableNow =
        getNumber(
            "available-money"
        );

    const startDateValue =
        $("planning-start").value;

    const endDateValue =
        $("semester-end").value;

    const startDate =
        parseDate(
            startDateValue
        );

    const endDate =
        parseDate(
            endDateValue
        );

    const daysRemaining =
        getDaysRemaining(
            startDateValue,
            endDateValue
        );


    let expectedIncome = 0;

    let plannedExpenses = 0;


    // ======================================================
    // MONTHLY PLAN
    // ======================================================

    if (isMonthlyMode) {

        const monthlyIncome =
            getIncomeTotal();

        const monthlyExpenses =
            getExpenseTotal();


        expectedIncome =
            projectMonthlyAmount(
                monthlyIncome,
                startDateValue,
                endDateValue
            );


        plannedExpenses =
            projectMonthlyAmount(
                monthlyExpenses,
                startDateValue,
                endDateValue
            );

    }


    // ======================================================
    // SEMESTER PLAN
    // ======================================================

    else {

        expectedIncome =
            getIncomeTotal();


        plannedExpenses =
            getExpenseTotal();

    }


    // ======================================================
    // PROJECTED BALANCE
    //
    // Actual expenses are NOT subtracted again here.
    //
    // Reason:
    //
    // "Available money now" is already the money the
    // student currently has.
    //
    // Therefore previously recorded actual transactions
    // should be used for analysis, not deducted again.
    // ======================================================

    const projectedBalance =
        availableNow +
        expectedIncome -
        plannedExpenses;


    // ======================================================
    // ACTUAL SPENDING
    // ======================================================

    const actualExpenses =
        transactions.reduce(
            (
                total,
                transaction
            ) => {

                return (
                    total +
                    transaction.amount
                );

            },
            0
        );


    // ======================================================
    // DAILY SAFE SPENDING
    // ======================================================

    const dailySafeSpending =
        (
            daysRemaining > 0 &&
            projectedBalance > 0
        )
            ? projectedBalance /
              daysRemaining

            : 0;


    // ======================================================
    // CATEGORY DATA
    // ======================================================

    const categoryRows =
        getCategoryRows(
            startDateValue,
            endDateValue
        );


    // ======================================================
    // FINANCIAL HEALTH
    // ======================================================

    const score =
        calculateHealthScore({
            availableNow,
            expectedIncome,
            plannedExpenses,
            projectedBalance,
            daysRemaining,
            dailySafeSpending,
            categoryRows
        });


    return {

        availableNow,

        expectedIncome,

        plannedExpenses,

        projectedBalance,

        actualExpenses,

        dailySafeSpending,

        daysRemaining,

        startDate,

        startDateValue,

        endDate,

        endDateValue,

        categoryRows,

        score

    };
}


// ==========================================================
// 20. FINANCIAL HEALTH SCORE
// ==========================================================

function calculateHealthScore(model) {

    const {

        availableNow,

        expectedIncome,

        plannedExpenses,

        projectedBalance,

        daysRemaining,

        dailySafeSpending,

        categoryRows

    } = model;


    let score = 0;


    const resources =
        availableNow +
        expectedIncome;


    // ------------------------------------------------------
    // 30 points — positive projected balance
    // ------------------------------------------------------

    if (
        projectedBalance > 0
    ) {

        score += 30;

    } else if (
        projectedBalance === 0
    ) {

        score += 15;

    }


    // ------------------------------------------------------
    // 25 points — financial buffer
    // ------------------------------------------------------

    if (
        resources > 0
    ) {

        const bufferRatio =
            projectedBalance /
            resources;


        if (
            bufferRatio >= 0.20
        ) {

            score += 25;

        } else if (
            bufferRatio >= 0.10
        ) {

            score += 20;

        } else if (
            bufferRatio > 0
        ) {

            score += 12;

        }

    }


    // ------------------------------------------------------
    // 20 points — actual spending discipline
    // ------------------------------------------------------

    const categoriesOverBudget =
        categoryRows.filter(
            row =>
                row.planned > 0 &&
                row.actual >
                row.planned
        ).length;


    if (
        categoriesOverBudget === 0
    ) {

        score += 20;

    } else if (
        categoriesOverBudget <= 2
    ) {

        score += 10;

    }


    // ------------------------------------------------------
    // 10 points — no extreme concentration
    // ------------------------------------------------------

    if (
        plannedExpenses > 0
    ) {

        const largest =
            [...categoryRows]
                .sort(
                    (a, b) =>
                        b.planned -
                        a.planned
                )[0];


        if (largest) {

            const largestShare =
                largest.planned /
                plannedExpenses;


            if (
                largestShare <= 0.40
            ) {

                score += 10;

            } else if (
                largestShare <= 0.55
            ) {

                score += 6;

            }

        }

    }


    // ------------------------------------------------------
    // 15 points — positive runway
    // ------------------------------------------------------

    if (
        daysRemaining > 0 &&
        dailySafeSpending > 0
    ) {

        score += 15;

    }


    return Math.max(
        0,
        Math.min(
            100,
            Math.round(score)
        )
    );
}


// ==========================================================
// 21. HEALTH LABEL
// ==========================================================

function getHealthLabel(score) {

    if (score >= 90) {
        return "Excellent financial position.";
    }

    if (score >= 80) {
        return "Healthy financial plan.";
    }

    if (score >= 60) {
        return "Moderate financial position.";
    }

    if (score >= 40) {
        return "Your plan needs attention.";
    }

    return "Your current plan needs improvement.";
}


// ==========================================================
// 22. UPDATE RUNWAY STATUS
// ==========================================================

function updateRunwayStatus(model) {

    const pill =
        $("status-pill");

    const card =
        $("runway-status-card");


    if (
        !model.endDate ||
        model.daysRemaining <= 0
    ) {

        pill.className =
            "status-pill neutral";

        pill.textContent =
            "Waiting for plan";

        card.className =
            "status-card neutral";


        setText(
            "runway-status-title",
            "Add a valid planning period."
        );


        setText(
            "runway-status-message",
            "Choose a From and To date so TermRunway can calculate your runway."
        );


        return;
    }


    if (
        model.projectedBalance > 0
    ) {

        pill.className =
            "status-pill success";

        pill.textContent =
            "Sustainable";

        card.className =
            "status-card success";


        setText(
            "runway-status-title",
            "Your current plan is sustainable."
        );


        setText(
            "runway-status-message",
            `You are projected to finish with ₹${formatMoney(model.projectedBalance)} after planned income and expenses.`
        );


        return;
    }


    if (
        model.projectedBalance === 0
    ) {

        pill.className =
            "status-pill warning";

        pill.textContent =
            "No Buffer";

        card.className =
            "status-card warning";


        setText(
            "runway-status-title",
            "Your plan reaches ₹0 at the end."
        );


        setText(
            "runway-status-message",
            "Your planned money exactly covers your projected expenses. There is no financial buffer."
        );


        return;
    }


    pill.className =
        "status-pill danger";

    pill.textContent =
        "Shortfall";

    card.className =
        "status-card danger";


    setText(
        "runway-status-title",
        "Your planned spending is higher than your money."
    );


    setText(
        "runway-status-message",
        `You are projected to have a shortfall of ₹${formatMoney(Math.abs(model.projectedBalance))}.`
    );
}


// ==========================================================
// 23. UPDATE DASHBOARD
// ==========================================================

function updateDashboard(model) {

    setText(
        "display-available",
        formatMoney(
            model.availableNow
        )
    );


    setText(
        "display-income",
        formatMoney(
            model.expectedIncome
        )
    );


    setText(
        "display-expenses",
        formatMoney(
            model.plannedExpenses
        )
    );


    setText(
        "display-balance",
        formatMoney(
            model.projectedBalance
        )
    );


    setText(
        "display-balance-secondary",
        formatMoney(
            model.projectedBalance
        )
    );


    setText(
        "display-days",
        model.daysRemaining > 0
            ? model.daysRemaining
            : "—"
    );


    setText(
        "display-daily",
        formatMoney(
            model.dailySafeSpending
        )
    );


    setText(
        "health-score",
        model.score
    );


    $("score-bar").style.width =
        `${model.score}%`;


    setText(
        "health-label",
        getHealthLabel(
            model.score
        )
    );


    updateRunwayStatus(
        model
    );


    renderSpendingAnalysis(
        model.categoryRows,
        model.plannedExpenses,
        model.actualExpenses
    );


    updateCharts(
        model
    );


    renderGoal();
}


// ==========================================================
// 24. SPENDING ANALYSIS
// ==========================================================

function renderSpendingAnalysis(
    categoryRows,
    totalPlanned,
    totalActual
) {

    const container =
        $("spending-analysis");


    setText(
        "analysis-total",
        `Planned ₹${formatMoney(totalPlanned)} | Actual ₹${formatMoney(totalActual)}`
    );


    const rows =
        categoryRows.filter(
            row =>
                row.planned > 0 ||
                row.actual > 0
        );


    if (
        rows.length === 0
    ) {

        container.innerHTML =
            `
            <p class="empty">
                No spending data available yet.
            </p>
            `;

        return;
    }


    container.innerHTML =
        rows.map(
            row => {

                const usagePercentage =
                    row.planned > 0

                        ? (
                            row.actual /
                            row.planned
                        ) * 100

                        : 100;


                let statusText;


                if (
                    row.planned > 0 &&
                    row.actual > row.planned
                ) {

                    statusText =
                        `Over by ₹${formatMoney(
                            row.actual -
                            row.planned
                        )}`;

                } else if (
                    row.planned > 0
                ) {

                    statusText =
                        `₹${formatMoney(
                            row.planned -
                            row.actual
                        )} remaining`;

                } else {

                    statusText =
                        "Unplanned spending";

                }


                return `

                    <div class="analysis-row">

                        <div class="analysis-top">

                            <span class="analysis-label">
                                ${escapeHtml(
                                    row.label
                                )}
                            </span>

                            <span class="analysis-value">
                                Actual ₹${formatMoney(
                                    row.actual
                                )}
                            </span>

                        </div>


                        <div class="progress-track">

                            <div
                                class="progress-bar"
                                style="width:${Math.min(
                                    100,
                                    Math.max(
                                        0,
                                        usagePercentage
                                    )
                                )}%"
                            ></div>

                        </div>


                        <div class="analysis-top">

                            <span class="analysis-value">
                                Planned:
                                ₹${formatMoney(
                                    row.planned
                                )}
                            </span>

                            <span class="analysis-value">
                                ${escapeHtml(
                                    statusText
                                )}
                            </span>

                        </div>

                    </div>

                `;
            }
        ).join("");
}


// ==========================================================
// 25. FORECAST DATA
// ==========================================================

function buildForecast(model) {

    const labels = [];

    const balances = [];

    const startDate =
        localToday();

    const endDate =
        model.endDate;


    if (
        !endDate ||
        endDate <= startDate
    ) {

        return {

            labels: [
                "No plan"
            ],

            balances: [
                model.availableNow
            ]

        };
    }


    const totalDays =
        daysBetween(
            startDate,
            endDate
        );


    const points = 7;


    for (
        let index = 0;
        index < points;
        index++
    ) {

        const progress =
            index /
            (points - 1);


        const daysFromStart =
            Math.round(
                totalDays *
                progress
            );


        const currentDate =
            new Date(
                startDate.getTime() +
                daysFromStart *
                86400000
            );


        labels.push(
            currentDate.toLocaleDateString(
                "en-IN",
                {
                    day: "numeric",
                    month: "short"
                }
            )
        );


        const incomeAtPoint =
            model.expectedIncome *
            progress;


        const expensesAtPoint =
            model.plannedExpenses *
            progress;


        const projectedBalance =
            model.availableNow +
            incomeAtPoint -
            expensesAtPoint;


        balances.push(
            Number(
                projectedBalance.toFixed(2)
            )
        );

    }


    return {
        labels,
        balances
    };
}


// ==========================================================
// 26. UPDATE CHARTS
// ==========================================================

function updateCharts(model) {

    if (
        typeof Chart ===
        "undefined"
    ) {

        console.warn(
            "Chart.js has not loaded."
        );

        return;
    }


    // ------------------------------------------------------
    // Destroy previous chart instances
    // ------------------------------------------------------

    if (cashflowChart) {
        cashflowChart.destroy();
    }


    if (expenseChart) {
        expenseChart.destroy();
    }


    if (forecastChart) {
        forecastChart.destroy();
    }


    // ======================================================
    // CASH FLOW CHART
    // ======================================================

    cashflowChart =
        new Chart(
            $("cashflow-chart"),
            {

                type: "bar",

                data: {

                    labels: [
                        "Available now",
                        "Expected income",
                        "Planned expenses",
                        "Actual spent"
                    ],

                    datasets: [

                        {

                            label:
                                "Amount",

                            data: [

                                model.availableNow,

                                model.expectedIncome,

                                model.plannedExpenses,

                                model.actualExpenses

                            ]

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    plugins: {

                        legend: {
                            display: false
                        }

                    },

                    scales: {

                        y: {

                            beginAtZero: true,

                            ticks: {

                                callback:
                                    value =>
                                        `₹${formatCompactMoney(
                                            value
                                        )}`

                            }

                        }

                    }

                }

            }
        );


    // ======================================================
    // EXPENSE CHART
    //
    // If actual spending exists, use ACTUAL.
    // Otherwise show planned spending.
    // ======================================================

    const expenseRows =
        model.categoryRows.filter(
            row =>
                row.planned > 0 ||
                row.actual > 0
        );


    const labels =
        expenseRows.map(
            row =>
                row.label
        );


    const values =
        expenseRows.map(
            row => {

                if (
                    row.actual > 0
                ) {

                    return row.actual;

                }

                return row.planned;

            }
        );


    expenseChart =
        new Chart(
            $("expense-chart"),
            {

                type:
                    "doughnut",

                data: {

                    labels,

                    datasets: [

                        {

                            label:
                                "Spending",

                            data:
                                values

                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {

                            position:
                                "bottom"

                        }

                    }

                }

            }
        );


    // ======================================================
    // FORECAST CHART
    // ======================================================

    const forecast =
        buildForecast(
            model
        );


    forecastChart =
        new Chart(
            $("forecast-chart"),
            {

                type:
                    "line",

                data: {

                    labels:
                        forecast.labels,

                    datasets: [

                        {

                            label:
                                "Projected balance",

                            data:
                                forecast.balances,

                            tension:
                                0.25,

                            fill:
                                true,

                            pointRadius:
                                3

                        }

                    ]

                },

                options: {

                    responsive:
                        true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {

                            display:
                                false

                        }

                    },

                    scales: {

                        y: {

                            ticks: {

                                callback:
                                    value =>
                                        `₹${formatCompactMoney(
                                            value
                                        )}`

                            }

                        }

                    }

                }

            }
        );

}


// ==========================================================
// 27. AFFORDABILITY CHECK
// ==========================================================

function checkAffordability() {

    const amount =
        getNumber(
            "purchase-amount"
        );


    const purchaseName =
        $("purchase-name")
            .value
            .trim() ||
        "This purchase";


    const result =
        $("affordability-result");


    if (
        amount <= 0
    ) {

        result.className =
            "result-box warning";


        result.innerHTML =
            `
            <strong>
                Enter a purchase amount.
            </strong>

            <span>
                TermRunway needs a price to
                calculate the impact.
            </span>
            `;

        return;
    }


    const model =
        calculateModel();


    const balanceAfter =
        model.projectedBalance -
        amount;


    if (
        balanceAfter >= 0
    ) {

        result.className =
            "result-box success";


        result.innerHTML =
            `
            <strong>
                ${escapeHtml(
                    purchaseName
                )}
                fits within your projected balance.
            </strong>

            <span>
                Projected balance after purchase:
                ₹${formatMoney(
                    balanceAfter
                )}.
            </span>

            <span>
                This purchase uses
                ${(
                    model.projectedBalance > 0
                        ? (
                            amount /
                            model.projectedBalance
                        ) * 100
                        : 100
                ).toFixed(1)}%
                of your projected remaining balance.
            </span>
            `;

    } else {

        result.className =
            "result-box danger";


        result.innerHTML =
            `
            <strong>
                ${escapeHtml(
                    purchaseName
                )}
                would create a projected shortfall.
            </strong>

            <span>
                Balance after purchase:
                -₹${formatMoney(
                    Math.abs(
                        balanceAfter
                    )
                )}.
            </span>

            <span>
                Review the purchase or
                adjust your financial plan.
            </span>
            `;
    }

}


// ==========================================================
// 28. ADD ACTUAL EXPENSE
// ==========================================================

function addTransaction() {

    const amount =
        getNumber(
            "transaction-amount"
        );


    const date =
        $("transaction-date")
            .value ||
        dateToInputValue(
            localToday()
        );


    const category =
        $("transaction-category")
            .value;


    const description =
        $("transaction-description")
            .value
            .trim() ||
        "Expense";


    if (
        amount <= 0
    ) {

        $("validation-message")
            .textContent =
            "Enter an expense amount greater than ₹0.";

        return;
    }


    transactions.push({

        id:
            (
                typeof crypto !==
                "undefined" &&
                typeof crypto.randomUUID ===
                "function"
            )
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`,

        date,

        category,

        description,

        amount

    });


    $("transaction-amount")
        .value = "";


    $("transaction-description")
        .value = "";


    $("validation-message")
        .textContent = "";


    renderTransactions();

    calculateAndRender();

}


// ==========================================================
// 29. DELETE TRANSACTION
// ==========================================================

function deleteTransaction(id) {

    transactions =
        transactions.filter(
            transaction =>
                transaction.id !== id
        );


    renderTransactions();

    calculateAndRender();

}


// ==========================================================
// 30. RENDER TRANSACTIONS
// ==========================================================

function renderTransactions() {

    const container =
        $("transaction-list");


    if (
        transactions.length === 0
    ) {

        container.innerHTML =
            `
            <p class="empty">
                No actual expenses recorded yet.
            </p>
            `;

        return;
    }


    const sorted =
        [...transactions].sort(
            (a, b) =>
                b.date.localeCompare(
                    a.date
                )
        );


    container.innerHTML =
        sorted.map(
            transaction => {

                const category =
                    categoryNames[
                        transaction.category
                    ] ||
                    "Other";


                return `

                    <div class="transaction-row">

                        <span>
                            ${escapeHtml(
                                transaction.date
                            )}
                        </span>


                        <div>

                            <strong>
                                ${escapeHtml(
                                    transaction.description
                                )}
                            </strong>

                            <br>

                            <span>
                                ${escapeHtml(
                                    category
                                )}
                            </span>

                        </div>


                        <strong>
                            ₹${formatMoney(
                                transaction.amount
                            )}
                        </strong>


                        <button
                            class="delete-transaction"
                            type="button"
                            data-delete-id="${escapeHtml(
                                transaction.id
                            )}"
                        >
                            Delete
                        </button>

                    </div>

                `;
            }
        ).join("");
}


// ==========================================================
// 31. SAVE SAVINGS GOAL
// ==========================================================

function saveGoal() {

    const name =
        $("goal-name")
            .value
            .trim() ||
        "Savings goal";


    const target =
        getNumber(
            "goal-target"
        );


    const current =
        getNumber(
            "goal-current"
        );


    if (
        target <= 0
    ) {

        $("validation-message")
            .textContent =
            "Enter a savings target greater than ₹0.";

        return;
    }


    savedGoal = {

        name,

        target,

        current:
            Math.min(
                current,
                target
            )

    };


    $("validation-message")
        .textContent = "";


    renderGoal();

    saveData();

}


// ==========================================================
// 32. RENDER SAVINGS GOAL
// ==========================================================

function renderGoal() {

    if (
        !savedGoal
    ) {

        setText(
            "goal-display-name",
            "No goal yet"
        );


        setText(
            "goal-display-percent",
            "0%"
        );


        setText(
            "goal-remaining",
            "0.00"
        );


        setText(
            "goal-monthly",
            "0.00"
        );


        $("goal-progress-bar")
            .style
            .width =
            "0%";


        return;
    }


    const remaining =
        Math.max(
            0,
            savedGoal.target -
            savedGoal.current
        );


    const percentage =
        Math.min(
            100,
            Math.round(
                (
                    savedGoal.current /
                    savedGoal.target
                ) *
                100
            )
        );


    const endDateValue =
        $("semester-end")
            .value;


    const endDate =
        parseDate(
            endDateValue
        );


    let timeRemainingMonths =
        1;


    if (
        endDate &&
        endDate > localToday()
    ) {

        const days =
            daysBetween(
                localToday(),
                endDate
            );


        timeRemainingMonths =
            Math.max(
                days / 30.4375,
                0.01
            );

    }


    const monthlyRequired =
        remaining /
        timeRemainingMonths;


    setText(
        "goal-display-name",
        savedGoal.name
    );


    setText(
        "goal-display-percent",
        `${percentage}%`
    );


    setText(
        "goal-remaining",
        formatMoney(
            remaining
        )
    );


    setText(
        "goal-monthly",
        formatMoney(
            monthlyRequired
        )
    );


    $("goal-progress-bar")
        .style
        .width =
        `${percentage}%`;

}


// ==========================================================
// 33. SAVE DATA
// ==========================================================

function saveData() {

    const inputData = {};


    document
        .querySelectorAll(
            "input"
        )
        .forEach(
            input => {

                inputData[
                    input.id
                ] =
                    input.value;

            }
        );


    const data = {

        mode:
            isMonthlyMode
                ? "monthly"
                : "semester",

        inputs:
            inputData,

        transactions,

        goal:
            savedGoal

    };


    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data)
    );

}


// ==========================================================
// 34. LOAD DATA
// ==========================================================

function loadData() {

    const saved =
        localStorage.getItem(
            STORAGE_KEY
        );


    if (
        !saved
    ) {

        return;
    }


    try {

        const data =
            JSON.parse(
                saved
            );


        if (
            data.inputs
        ) {

            Object.entries(
                data.inputs
            ).forEach(
                (
                    [
                        id,
                        value
                    ]
                ) => {

                    const input =
                        $(id);


                    if (
                        input
                    ) {

                        input.value =
                            value;

                    }

                }
            );

        }


        transactions =
            Array.isArray(
                data.transactions
            )
                ? data.transactions
                : [];


        savedGoal =
            data.goal ||
            null;


        setMode(
            data.mode ===
            "monthly"
        );


        renderTransactions();

        renderGoal();

        calculateAndRender();

    }

    catch (error) {

        console.error(
            "TermRunway data could not be loaded:",
            error
        );


        localStorage.removeItem(
            STORAGE_KEY
        );

    }

}


// ==========================================================
// 35. RESET
// ==========================================================

function resetAll() {

    document
        .querySelectorAll(
            "input"
        )
        .forEach(
            input => {

                input.value = "";

            }
        );


    transactions = [];

    savedGoal = null;


    localStorage.removeItem(
        STORAGE_KEY
    );


    setMode(false);


    $("validation-message")
        .textContent = "";


    renderTransactions();

    renderGoal();


    const emptyModel = {

        availableNow: 0,

        expectedIncome: 0,

        plannedExpenses: 0,

        projectedBalance: 0,

        actualExpenses: 0,

        dailySafeSpending: 0,

        daysRemaining: 0,

        endDate: null,

        endDateValue: "",

        categoryRows: [],

        score: 0

    };


    updateDashboard(
        emptyModel
    );

}


// ==========================================================
// 36. MAIN RENDER
// ==========================================================

function calculateAndRender() {

    const model =
        calculateModel();


    updateDashboard(
        model
    );


    saveData();


    return model;
}


// ==========================================================
// 37. EVENT LISTENERS
// ==========================================================

$("calculate-btn")
    .addEventListener(
        "click",
        calculateAndRender
    );


$("reset-btn")
    .addEventListener(
        "click",
        resetAll
    );


$("add-transaction-btn")
    .addEventListener(
        "click",
        addTransaction
    );


$("check-afford-btn")
    .addEventListener(
        "click",
        checkAffordability
    );


$("save-goal-btn")
    .addEventListener(
        "click",
        saveGoal
    );


$("download-btn")
    .addEventListener(
        "click",
        () => {

            window.print();

        }
    );


$("transaction-list")
    .addEventListener(
        "click",
        event => {

            const button =
                event.target.closest(
                    "[data-delete-id]"
                );


            if (
                button
            ) {

                deleteTransaction(
                    button.dataset.deleteId
                );

            }

        }
    );


// ==========================================================
// 38. NUMBER INPUT PROTECTION
// ==========================================================

document
    .querySelectorAll(
        'input[type="number"]'
    )
    .forEach(
        input => {

            input.addEventListener(
                "keydown",
                event => {

                    const invalid =
                        [
                            "-",
                            "+",
                            "e",
                            "E"
                        ];


                    if (
                        invalid.includes(
                            event.key
                        )
                    ) {

                        event.preventDefault();

                    }

                }
            );

        }
    );


// ==========================================================
// 39. INITIALIZATION
// ==========================================================

window.addEventListener(
    "DOMContentLoaded",
    () => {

        const today =
            dateToInputValue(
                localToday()
            );

        const planningStart =
            $("planning-start");

        if (
            planningStart &&
            !planningStart.value
        ) {

            planningStart.value =
                today;

        }

        const transactionDate =
            $("transaction-date");


        if (
            transactionDate
        ) {

            transactionDate.value =
                today;

            transactionDate.max =
                today;

        }


        loadData();

    }
);