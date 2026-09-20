/**
 * TermRunway — Core Financial & UI Engine
 *
 * The page is organized in numbered sections so another developer can
 * quickly understand what each group of functions does.
 *
 * 01. Configuration & category definitions
 * 02. State & localStorage
 * 03. DOM contract / element lookup
 * 04. General formatting & date helpers
 * 05. Financial model
 * 06. Planner state & input handling
 * 07. Runway summary rendering
 * 08. Detailed dashboard rendering
 * 09. Planned vs actual tracking
 * 10. Decision Center
 * 11. Savings Goal
 * 12. Charts
 * 13. Visibility & progressive disclosure
 * 14. Event binding
 * 15. Initialization
 */

(function () {
    'use strict';

    // ==================================================
    // 01. CONFIGURATION & CATEGORY DEFINITIONS
    // ==================================================

    const STORAGE_KEY = 'termrunway_state_v4';
    const LEGACY_STORAGE_KEYS = [
        'termrunway_state_v3',
        'termrunway_state_v2'
    ];

    const CATEGORIES = [
        { id: 'tuition', label: 'Tuition & Fees' },
        { id: 'rent', label: 'Rent & Housing' },
        { id: 'food', label: 'Food & Groceries' },
        { id: 'utilities', label: 'Utilities & Internet' },
        { id: 'transport', label: 'Transport & Travel' },
        { id: 'books', label: 'Books & Academic Supplies' },
        { id: 'entertainment', label: 'Personal & Lifestyle' },
        { id: 'misc', label: 'Miscellaneous / Contingency' }
    ];

    const INCOME_SOURCES = [
        { id: 'scholarship', inputId: 'income-scholarship' },
        { id: 'partTime', inputId: 'income-part-time' },
        { id: 'parents', inputId: 'income-parents' },
        { id: 'freelance', inputId: 'income-freelance' },
        { id: 'other', inputId: 'income-other' }
    ];

    const DEFAULT_PLANNED_EXPENSES = {
        tuition: 0,
        rent: 0,
        food: 0,
        utilities: 0,
        transport: 0,
        books: 0,
        entertainment: 0,
        misc: 0
    };

    const DEFAULT_INCOME_SOURCES = {
        scholarship: 0,
        partTime: 0,
        parents: 0,
        freelance: 0,
        other: 0
    };


    // ==================================================
    // 02. STATE & LOCALSTORAGE
    // ==================================================

    // 02.1 createDefaultState()
    // Use: Creates a clean first-run state without demo financial data.
    function createDefaultState() {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setMonth(endDate.getMonth() + 6);

        return {
            mode: 'semester',
            fromDate: formatDateIso(today),
            toDate: formatDateIso(endDate),
            availableNow: 0,
            incomeSources: { ...DEFAULT_INCOME_SOURCES },
            expectedIncome: 0,
            plannedExpenses: { ...DEFAULT_PLANNED_EXPENSES },
            transactions: [],
            savingsGoal: {
                name: '',
                target: 0,
                saved: 0
            },
            hasSubmittedPlan: false
        };
    }


    // 02.2 cloneState()
    // Use: Creates a safe deep copy for reset and state initialization.
    function cloneState(value) {
        return JSON.parse(JSON.stringify(value));
    }


    // 02.3 normalizeState()
    // Use: Converts stored data into the current v3 structure and migrates v2 data.
    function normalizeState(parsed) {
        const normalized = createDefaultState();

        if (!parsed || typeof parsed !== 'object') {
            return normalized;
        }

        normalized.mode =
            parsed.mode === 'monthly' ? 'monthly' : 'semester';

        normalized.fromDate =
            parsed.fromDate || normalized.fromDate;

        normalized.toDate =
            parsed.toDate || normalized.toDate;

        normalized.availableNow =
            Number(parsed.availableNow) || 0;

        normalized.plannedExpenses = {
            ...normalized.plannedExpenses,
            ...(parsed.plannedExpenses || {})
        };

        if (parsed.incomeSources && typeof parsed.incomeSources === 'object') {
            normalized.incomeSources = {
                ...normalized.incomeSources,
                ...parsed.incomeSources
            };
        } else {
            normalized.incomeSources.other =
                Number(parsed.expectedIncome) || 0;
        }

        normalized.expectedIncome =
            getTotalExpectedIncome(normalized.incomeSources);

        normalized.transactions = Array.isArray(parsed.transactions)
            ? parsed.transactions.map(transaction => ({
                ...transaction,
                category:
                    transaction.category === 'other'
                        ? 'misc'
                        : transaction.category
            }))
            : [];

        normalized.savingsGoal = {
            ...normalized.savingsGoal,
            ...(parsed.savingsGoal || {})
        };

        normalized.savingsGoal.target =
            Number(normalized.savingsGoal.target) || 0;

        normalized.savingsGoal.saved =
            Number(normalized.savingsGoal.saved) || 0;

        normalized.hasSubmittedPlan =
            parsed.hasSubmittedPlan === true;

        return normalized;
    }


    // 02.4 loadState()
    // Use: Loads the current state or safely migrates the previous v2 state.
    function loadState() {
        try {
            const storageKeys = [
                STORAGE_KEY,
                ...LEGACY_STORAGE_KEYS
            ];

            for (const storageKey of storageKeys) {
                const raw = localStorage.getItem(storageKey);

                if (!raw) {
                    continue;
                }

                const loadedState =
                    normalizeState(
                        JSON.parse(raw)
                    );

                if (storageKey !== STORAGE_KEY) {
                    localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify(
                            loadedState
                        )
                    );
                }

                return loadedState;
            }
        } catch (error) {
            console.warn(
                'TermRunway state could not be loaded:',
                error
            );
        }

        return createDefaultState();
    }


    // 02.5 saveState()
    // Use: Persists the current planning data in the browser.
    function saveState() {
        try {
            state.expectedIncome =
                getTotalExpectedIncome(state.incomeSources);

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(state)
            );
        } catch (error) {
            console.error(
                'TermRunway state could not be saved:',
                error
            );
        }
    }


    let state = loadState();


    // ==================================================
    // 03. DOM CONTRACT / ELEMENT LOOKUP
    // ==================================================

    const REQUIRED_IDS = [
        'planning-semester',
        'planning-monthly',
        'planning-method-description',
        'available-money',
        'income-description',
        'expense-description',
        'planning-from-date',
        'planning-to-date',
        'update-runway-btn',
        'reset-runway-btn',
        'planner-validation',
        'planner',
        'runway-summary',
        'edit-plan-btn',
        'plan-summary-method',
        'plan-summary-period',
        'runway-status-pill',
        'display-available',
        'display-income',
        'display-expenses',
        'display-balance',
        'display-days',
        'display-daily',
        'runway-status-card',
        'runway-status-title',
        'runway-status-message',
        'display-balance-secondary',
        'health-score',
        'score-bar',
        'health-label',
        'dashboard-details',
        'cashflow-chart',
        'expense-chart',
        'forecast-chart',
        'tracking',
        'transaction-date',
        'transaction-category',
        'transaction-description',
        'transaction-amount',
        'add-transaction-btn',
        'transaction-list',
        'transaction-count',
        'analysis-total',
        'spending-analysis',
        'decisions',
        'purchase-name',
        'purchase-amount',
        'check-afford-btn',
        'affordability-result',
        'goal',
        'goal-name',
        'goal-target',
        'goal-current',
        'save-goal-btn',
        'goal-display-name',
        'goal-display-percent',
        'goal-progress-bar',
        'goal-remaining',
        'goal-monthly',
        'download-btn'
    ];


    // 03.1 getElement()
    // Use: Returns one DOM element and throws a clear error if the ID is missing.
    function getElement(id) {
        const element = document.getElementById(id);

        if (!element) {
            throw new Error(
                'TermRunway DOM contract error: Missing element #' + id
            );
        }

        return element;
    }


    // 03.2 validateDomContract()
    // Use: Verifies that HTML and JavaScript still agree before event binding.
    function validateDomContract() {
        REQUIRED_IDS.forEach(id => getElement(id));
        INCOME_SOURCES.forEach(source => getElement(source.inputId));
        CATEGORIES.forEach(category => {
            getElement('expense-' + category.id);
        });
    }


    // ==================================================
    // 04. GENERAL FORMATTING & DATE HELPERS
    // ==================================================

    // 04.1 parseDate()
    // Use: Converts an ISO date string into a local Date object.
    function parseDate(dateString) {
        if (!dateString) {
            return null;
        }

        const parts = dateString.split('-');

        if (parts.length !== 3) {
            return null;
        }

        return new Date(
            Number(parts[0]),
            Number(parts[1]) - 1,
            Number(parts[2])
        );
    }


    // 04.2 formatDateIso()
    // Use: Converts a Date object into YYYY-MM-DD for date inputs and state.
    function formatDateIso(date) {
        const year = date.getFullYear();
        const month = String(
            date.getMonth() + 1
        ).padStart(2, '0');

        const day = String(
            date.getDate()
        ).padStart(2, '0');

        return year + '-' + month + '-' + day;
    }


    // 04.3 formatDateDisplay()
    // Use: Creates a readable date label for dashboard messages.
    function formatDateDisplay(date) {
        if (!date || Number.isNaN(date.getTime())) {
            return '—';
        }

        return date.toLocaleDateString(
            'en-US',
            {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }
        );
    }


    // 04.4 getDiffDays()
    // Use: Calculates whole calendar days between two local dates.
    function getDiffDays(firstDate, secondDate) {
        const msPerDay = 1000 * 60 * 60 * 24;

        const firstUtc = Date.UTC(
            firstDate.getFullYear(),
            firstDate.getMonth(),
            firstDate.getDate()
        );

        const secondUtc = Date.UTC(
            secondDate.getFullYear(),
            secondDate.getMonth(),
            secondDate.getDate()
        );

        return Math.round(
            (secondUtc - firstUtc) / msPerDay
        );
    }


    // 04.5 formatCurrency()
    // Use: Formats money using Indian number grouping with two decimals.
    function formatCurrency(value) {
        const amount = Number(value) || 0;

        return amount.toLocaleString(
            'en-IN',
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );
    }


    // 04.6 getTotalExpectedIncome()
    // Use: Adds all income sources into the model's total expected income.
    function getTotalExpectedIncome(incomeSources) {
        return INCOME_SOURCES.reduce(
            (total, source) => {
                return total + (
                    Number(incomeSources[source.id]) || 0
                );
            },
            0
        );
    }


    // 04.7 escapeHtml()
    // Use: Prevents user-entered descriptions and goal names from becoming HTML.
    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }


    // ==================================================
    // 05. FINANCIAL MODEL
    // ==================================================

    // 05.1 calculateModel()
    // Use: Calculates the forward financial runway without changing the DOM.
    function calculateModel() {
        const fromDate = parseDate(state.fromDate);
        const toDate = parseDate(state.toDate);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!fromDate || !toDate || toDate <= fromDate) {
            return {
                isValid: false,
                error:
                    'Invalid planning period. "To Date" must be after "From Date".'
            };
        }

        const totalDays = Math.max(
            1,
            getDiffDays(fromDate, toDate)
        );

        const isFromPast = fromDate <= today;

        const forecastStartDate = isFromPast
            ? (today > toDate ? toDate : today)
            : fromDate;

        const pastDays = isFromPast
            ? Math.max(
                0,
                getDiffDays(
                    fromDate,
                    forecastStartDate
                )
            )
            : 0;

        const remainingDays = Math.max(
            0,
            getDiffDays(
                forecastStartDate,
                toDate
            )
        );

        const validTransactions = state.transactions.filter(
            transaction => {
                const transactionDate =
                    parseDate(transaction.date);

                if (!transactionDate) {
                    return false;
                }

                return (
                    transactionDate >= fromDate &&
                    transactionDate <= toDate &&
                    transactionDate <= today
                );
            }
        );

        const actualByCategory = {};

        CATEGORIES.forEach(category => {
            actualByCategory[category.id] = 0;
        });

        let totalActualSpent = 0;

        validTransactions.forEach(transaction => {
            const amount =
                Number(transaction.amount) || 0;

            if (
                actualByCategory[
                    transaction.category
                ] !== undefined
            ) {
                actualByCategory[
                    transaction.category
                ] += amount;
            }

            totalActualSpent += amount;
        });

        const wholePlannedByCategory = {};
        const remainingPlannedByCategory = {};

        let totalWholePlanned = 0;
        let totalRemainingPlanned = 0;

        if (state.mode === 'semester') {
            CATEGORIES.forEach(category => {
                const entered =
                    Number(
                        state.plannedExpenses[
                            category.id
                        ]
                    ) || 0;

                wholePlannedByCategory[
                    category.id
                ] = entered;

                totalWholePlanned += entered;

                const actual =
                    actualByCategory[
                        category.id
                    ] || 0;

                const remaining = Math.max(
                    0,
                    entered - actual
                );

                remainingPlannedByCategory[
                    category.id
                ] = remaining;

                totalRemainingPlanned += remaining;
            });
        } else {
            CATEGORIES.forEach(category => {
                const monthly =
                    Number(
                        state.plannedExpenses[
                            category.id
                        ]
                    ) || 0;

                const dailyRate =
                    (monthly * 12) / 365;

                const wholeAmount =
                    dailyRate * totalDays;

                wholePlannedByCategory[
                    category.id
                ] = wholeAmount;

                totalWholePlanned += wholeAmount;

                const remainingAmount =
                    dailyRate * remainingDays;

                remainingPlannedByCategory[
                    category.id
                ] = remainingAmount;

                totalRemainingPlanned += remainingAmount;
            });
        }

        const totalExpectedIncome =
            getTotalExpectedIncome(
                state.incomeSources
            );

        let expectedFutureIncome = 0;

        if (state.mode === 'semester') {
            expectedFutureIncome = totalExpectedIncome;
        } else {
            const monthlyIncome =
                totalExpectedIncome;

            const dailyIncomeRate =
                (monthlyIncome * 12) / 365;

            expectedFutureIncome =
                dailyIncomeRate * remainingDays;
        }

        const availableNow =
            Number(state.availableNow) || 0;

        const projectedBalance =
            availableNow +
            expectedFutureIncome -
            totalRemainingPlanned;

        const dailySafeSpend =
            remainingDays > 0 &&
            projectedBalance > 0
                ? projectedBalance / remainingDays
                : 0;

        let healthScore = 50;

        if (
            totalRemainingPlanned > 0 ||
            totalWholePlanned > 0
        ) {
            const bufferRatio =
                totalRemainingPlanned > 0
                    ? projectedBalance /
                        totalRemainingPlanned
                    : (
                        projectedBalance > 0
                            ? 1
                            : -1
                    );

            if (projectedBalance < 0) {
                healthScore = Math.max(
                    10,
                    Math.round(
                        40 + bufferRatio * 30
                    )
                );
            } else {
                healthScore = Math.min(
                    100,
                    Math.round(
                        65 +
                        Math.min(
                            bufferRatio,
                            1
                        ) * 35
                    )
                );
            }
        } else if (projectedBalance >= 0) {
            healthScore = 85;
        }

        return {
            isValid: true,
            fromDate,
            toDate,
            today,
            forecastStartDate,
            totalDays,
            pastDays,
            remainingDays,
            availableNow,
            expectedFutureIncome,
            totalWholePlanned,
            totalActualSpent,
            totalRemainingPlanned,
            projectedBalance,
            dailySafeSpend,
            healthScore,
            wholePlannedByCategory,
            actualByCategory,
            remainingPlannedByCategory,
            validTransactions
        };
    }


    // 05.2 hasEnoughPlanningData()
    // Use: Prevents a user from opening the dashboard before entering financial data.
    function hasEnoughPlanningData() {
        const income =
            getTotalExpectedIncome(
                state.incomeSources
            );

        const planned =
            Object.values(
                state.plannedExpenses
            ).reduce(
                (total, value) => {
                    return total + (
                        Number(value) || 0
                    );
                },
                0
            );

        return (
            Number(state.availableNow) > 0 ||
            income > 0 ||
            planned > 0
        );
    }


    // ==================================================
    // 06. PLANNER STATE & INPUT HANDLING
    // ==================================================

    // 06.1 updatePlanningCopy()
    // Use: Keeps planner descriptions aligned with Semester/Monthly mode.
    function updatePlanningCopy() {
        const semesterSelected =
            state.mode === 'semester';

        getElement(
            'planning-semester'
        ).classList.toggle(
            'active',
            semesterSelected
        );

        getElement(
            'planning-monthly'
        ).classList.toggle(
            'active',
            !semesterSelected
        );

        getElement(
            'planning-method-description'
        ).textContent =
            semesterSelected
                ? 'Enter amounts that cover your whole planning period.'
                : 'Enter recurring monthly amounts that TermRunway will prorate.';

        getElement(
            'income-description'
        ).textContent =
            semesterSelected
                ? 'Add income you expect to receive during the planning period.'
                : 'Add recurring monthly income expected during the planning period.';

        getElement(
            'expense-description'
        ).textContent =
            semesterSelected
                ? 'Enter your total budget for the planning period.'
                : 'Enter your monthly budget for each category.';
    }


    // 06.2 initPlannerInputs()
    // Use: Loads saved state into the planner form without revealing output sections.
    function initPlannerInputs() {
        getElement(
            'available-money'
        ).value =
            state.availableNow || '';

        INCOME_SOURCES.forEach(source => {
            getElement(
                source.inputId
            ).value =
                state.incomeSources[source.id] || '';
        });

        CATEGORIES.forEach(category => {
            getElement(
                'expense-' + category.id
            ).value =
                state.plannedExpenses[
                    category.id
                ] || '';
        });

        getElement(
            'planning-from-date'
        ).value = state.fromDate;

        getElement(
            'planning-to-date'
        ).value = state.toDate;

        getElement(
            'transaction-date'
        ).value =
            formatDateIso(new Date());

        updatePlanningCopy();
    }


    // 06.3 readPlannerInputs()
    // Use: Reads all planner fields into application state before calculation.
    function readPlannerInputs() {
        state.availableNow =
            Number(
                getElement(
                    'available-money'
                ).value
            ) || 0;

        INCOME_SOURCES.forEach(source => {
            state.incomeSources[
                source.id
            ] =
                Number(
                    getElement(
                        source.inputId
                    ).value
                ) || 0;
        });

        CATEGORIES.forEach(category => {
            state.plannedExpenses[
                category.id
            ] =
                Number(
                    getElement(
                        'expense-' + category.id
                    ).value
                ) || 0;
        });

        state.fromDate =
            getElement(
                'planning-from-date'
            ).value;

        state.toDate =
            getElement(
                'planning-to-date'
            ).value;

        state.expectedIncome =
            getTotalExpectedIncome(
                state.incomeSources
            );
    }


    // 06.4 handleRunwayUpdate()
    // Use: Validates the plan, saves it, reveals the dashboard, and renders results.
    function handleRunwayUpdate() {
        const validation =
            getElement(
                'planner-validation'
            );

        validation.textContent = '';

        readPlannerInputs();

        const model = calculateModel();

        if (!model.isValid) {
            validation.textContent =
                model.error;
            return;
        }

        if (!hasEnoughPlanningData()) {
            validation.textContent =
                'Enter at least one financial amount before updating your runway.';
            return;
        }

        state.hasSubmittedPlan =
            true;

        saveState();
        revealRunwayExperience();
        renderPlanSummary(model);
        renderRunwaySummary(model);
        renderDetailedDashboard(model);

        getElement(
            'runway-summary'
        ).scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }


    // ==================================================
    // 07. RUNWAY SUMMARY RENDERING
    // ==================================================

    // 07.1 renderPlanSummary()
    // Use: Shows the saved planning method and date window above the results.
    function renderPlanSummary(model) {
        const methodLabel =
            state.mode === 'semester'
                ? 'Semester'
                : 'Monthly';

        getElement(
            'plan-summary-method'
        ).textContent =
            methodLabel;

        getElement(
            'plan-summary-period'
        ).textContent =
            formatDateDisplay(
                model.fromDate
            ) +
            ' → ' +
            formatDateDisplay(
                model.toDate
            );
    }


    // 07.2 renderRunwaySummary()
    // Use: Updates the results-focused runway dashboard after a plan is submitted.
    function renderRunwaySummary(model) {
        getElement(
            'display-available'
        ).textContent =
            formatCurrency(
                model.availableNow
            );

        getElement(
            'display-income'
        ).textContent =
            formatCurrency(
                model.expectedFutureIncome
            );

        getElement(
            'display-expenses'
        ).textContent =
            formatCurrency(
                model.totalWholePlanned
            );

        getElement(
            'display-balance'
        ).textContent =
            formatCurrency(
                model.projectedBalance
            );

        getElement(
            'display-days'
        ).textContent =
            String(
                model.remainingDays
            );

        getElement(
            'display-daily'
        ).textContent =
            formatCurrency(
                model.dailySafeSpend
            );

        getElement(
            'display-balance-secondary'
        ).textContent =
            formatCurrency(
                model.projectedBalance
            );

        const statusPill =
            getElement(
                'runway-status-pill'
            );

        const statusCard =
            getElement(
                'runway-status-card'
            );

        const title =
            getElement(
                'runway-status-title'
            );

        const message =
            getElement(
                'runway-status-message'
            );

        if (model.projectedBalance >= 0) {
            statusPill.className =
                'status-pill success';

            statusPill.textContent =
                'Runway Healthy';

            statusCard.className =
                'status-card success';

            title.textContent =
                'Your current plan stays solvent.';

            message.textContent =
                'Based on the money available, expected income, and remaining planned costs, TermRunway projects a positive balance through ' +
                formatDateDisplay(
                    model.toDate
                ) +
                '.';
        } else {
            statusPill.className =
                'status-pill danger';

            statusPill.textContent =
                'Projected Deficit';

            statusCard.className =
                'status-card danger';

            title.textContent =
                'Your current plan projects a shortfall.';

            message.textContent =
                'Expected funds are not enough to cover the remaining planned costs before ' +
                formatDateDisplay(
                    model.toDate
                ) +
                '.';
        }

        getElement(
            'health-score'
        ).textContent =
            String(
                model.healthScore
            );

        getElement(
            'score-bar'
        ).style.width =
            model.healthScore + '%';

        if (model.healthScore >= 75) {
            getElement(
                'health-label'
            ).textContent =
                'Strong runway buffer';
        } else if (model.healthScore >= 50) {
            getElement(
                'health-label'
            ).textContent =
                'Balanced / moderate buffer';
        } else {
            getElement(
                'health-label'
            ).textContent =
                'Deficit risk / action needed';
        }
    }


    // ==================================================
    // 08. DETAILED DASHBOARD RENDERING
    // ==================================================

    // 08.1 renderDetailedDashboard()
    // Use: Refreshes charts, spending analysis, actual transactions, and goal data.
    function renderDetailedDashboard(model) {
        renderCharts(model);
        renderTransactions(model.validTransactions);
        renderSpendingAnalysis(model);
        renderSavingsGoal(model);
    }


    // ==================================================
    // 09. PLANNED VS ACTUAL TRACKING
    // ==================================================

    // 09.1 renderTransactions()
    // Use: Displays actual expenses recorded inside the active planning period.
    function renderTransactions(validTransactions) {
        const list =
            getElement(
                'transaction-list'
            );

        getElement(
            'transaction-count'
        ).textContent =
            validTransactions.length +
            (
                validTransactions.length === 1
                    ? ' active entry'
                    : ' active entries'
            );

        if (validTransactions.length === 0) {
            list.innerHTML =
                '<p class="empty">No actual expenses recorded inside the active planning period yet.</p>';
            return;
        }

        const sorted =
            [...validTransactions]
                .sort(
                    (first, second) =>
                        new Date(second.date) -
                        new Date(first.date)
                );

        list.innerHTML =
            sorted.map(transaction => {
                const category =
                    CATEGORIES.find(
                        item =>
                            item.id ===
                            transaction.category
                    );

                return [
                    '<div class="transaction-row">',
                    '<span>',
                    escapeHtml(
                        transaction.date
                    ),
                    '</span>',
                    '<div>',
                    '<strong>',
                    escapeHtml(
                        category
                            ? category.label
                            : transaction.category
                    ),
                    '</strong>',
                    '<div>',
                    escapeHtml(
                        transaction.desc || '—'
                    ),
                    '</div>',
                    '</div>',
                    '<strong>₹',
                    formatCurrency(
                        transaction.amount
                    ),
                    '</strong>',
                    '<button',
                    ' class="delete-transaction"',
                    ' type="button"',
                    ' data-transaction-id="',
                    escapeHtml(
                        transaction.id
                    ),
                    '">',
                    'Delete',
                    '</button>',
                    '</div>'
                ].join('');
            })
            .join('');

        list.querySelectorAll(
            '[data-transaction-id]'
        ).forEach(button => {
            button.addEventListener(
                'click',
                () => {
                    deleteTransaction(
                        button.getAttribute(
                            'data-transaction-id'
                        )
                    );
                }
            );
        });
    }


    // 09.2 addTransaction()
    // Use: Validates and stores one actual expense.
    function addTransaction() {
        const date =
            getElement(
                'transaction-date'
            ).value;

        const category =
            getElement(
                'transaction-category'
            ).value;

        const description =
            getElement(
                'transaction-description'
            ).value.trim();

        const amount =
            Number(
                getElement(
                    'transaction-amount'
                ).value
            ) || 0;

        const fromDate =
            parseDate(
                state.fromDate
            );

        const toDate =
            parseDate(
                state.toDate
            );

        const transactionDate =
            parseDate(date);

        if (
            !date ||
            !transactionDate ||
            amount <= 0
        ) {
            alert(
                'Please provide a valid date and amount.'
            );
            return;
        }

        if (
            !fromDate ||
            !toDate ||
            transactionDate < fromDate ||
            transactionDate > toDate
        ) {
            alert(
                'Use a transaction date inside your active planning period.'
            );
            return;
        }

        state.transactions.push({
            id: 'txn_' + Date.now(),
            date,
            category,
            desc: description,
            amount
        });

        saveState();

        const model =
            calculateModel();

        renderRunwaySummary(model);
        renderDetailedDashboard(model);

        getElement(
            'transaction-amount'
        ).value = '';

        getElement(
            'transaction-description'
        ).value = '';
    }


    // 09.3 deleteTransaction()
    // Use: Removes one actual expense and recalculates the dashboard.
    function deleteTransaction(transactionId) {
        state.transactions =
            state.transactions.filter(
                transaction =>
                    transaction.id !==
                    transactionId
            );

        saveState();

        const model =
            calculateModel();

        renderRunwaySummary(model);
        renderDetailedDashboard(model);
    }


    // 09.4 renderSpendingAnalysis()
    // Use: Compares planned, actual, remaining, and progress for each category.
    function renderSpendingAnalysis(model) {
        const list =
            getElement(
                'spending-analysis'
            );

        getElement(
            'analysis-total'
        ).textContent =
            '₹' +
            formatCurrency(
                model.totalActualSpent
            );

        list.innerHTML =
            CATEGORIES.map(
                category => {
                    const planned =
                        model.wholePlannedByCategory[
                            category.id
                        ] || 0;

                    const actual =
                        model.actualByCategory[
                            category.id
                        ] || 0;

                    const percentage =
                        planned > 0
                            ? Math.min(
                                100,
                                Math.round(
                                    (
                                        actual /
                                        planned
                                    ) * 100
                                )
                            )
                            : 0;

                    let status = 'On Track';

                    if (
                        planned > 0 &&
                        actual > planned
                    ) {
                        status = 'Over Budget';
                    } else if (
                        planned > 0 &&
                        percentage >= 85
                    ) {
                        status = 'Near Limit';
                    }

                    return [
                        '<div class="analysis-row">',
                        '<div class="analysis-top">',
                        '<span class="analysis-label">',
                        escapeHtml(
                            category.label
                        ),
                        '</span>',
                        '<span class="analysis-value">',
                        'Planned ₹',
                        formatCurrency(
                            planned
                        ),
                        ' · Actual ₹',
                        formatCurrency(
                            actual
                        ),
                        ' · ',
                        status,
                        '</span>',
                        '</div>',
                        '<div class="progress-track">',
                        '<div class="progress-bar"',
                        ' style="width:',
                        percentage,
                        '%">',
                        '</div>',
                        '</div>',
                        '</div>'
                    ].join('');
                }
            ).join('');
    }


    // ==================================================
    // 10. DECISION CENTER
    // ==================================================

    // 10.1 evaluateAffordability()
    // Use: Tests a purchase against the current projected balance.
    function evaluateAffordability() {
        const cost =
            Number(
                getElement(
                    'purchase-amount'
                ).value
            ) || 0;

        const name =
            getElement(
                'purchase-name'
            ).value.trim() ||
            'This purchase';

        const resultBox =
            getElement(
                'affordability-result'
            );

        if (cost <= 0) {
            resultBox.className =
                'result-box neutral';

            resultBox.innerHTML =
                '<strong>Enter a purchase amount to test it.</strong>' +
                '<span>TermRunway will compare the purchase with your projected balance.</span>';

            return;
        }

        const model =
            calculateModel();

        const newProjectedBalance =
            model.projectedBalance -
            cost;

        const newDailySafeSpend =
            model.remainingDays > 0 &&
            newProjectedBalance > 0
                ? newProjectedBalance /
                    model.remainingDays
                : 0;

        if (newProjectedBalance >= 0) {
            resultBox.className =
                'result-box success';

            resultBox.innerHTML =
                '<strong>' +
                escapeHtml(name) +
                ' fits within the current projected balance.</strong>' +
                '<span>Projected balance after purchase: ₹' +
                formatCurrency(
                    newProjectedBalance
                ) +
                ' · Daily safe spending becomes ₹' +
                formatCurrency(
                    newDailySafeSpend
                ) +
                ' / day.</span>';
        } else {
            resultBox.className =
                'result-box danger';

            resultBox.innerHTML =
                '<strong>' +
                escapeHtml(name) +
                ' would create a projected deficit.</strong>' +
                '<span>Projected shortfall after purchase: ₹' +
                formatCurrency(
                    Math.abs(
                        newProjectedBalance
                    )
                ) +
                '.</span>';
        }
    }


    // ==================================================
    // 11. SAVINGS GOAL
    // ==================================================

    // 11.1 renderSavingsGoal()
    // Use: Displays goal progress, remaining amount, and required monthly pace.
    function renderSavingsGoal(model) {
        const goal =
            state.savingsGoal;

        const target =
            Number(goal.target) || 0;

        const saved =
            Number(goal.saved) || 0;

        const remaining =
            Math.max(
                0,
                target - saved
            );

        const percentage =
            target > 0
                ? Math.min(
                    100,
                    Math.round(
                        (
                            saved /
                            target
                        ) * 100
                    )
                )
                : 0;

        const remainingMonths =
            Math.max(
                0.2,
                model.remainingDays / 30.4
            );

        const monthlyNeeded =
            remaining /
            remainingMonths;

        getElement(
            'goal-display-name'
        ).textContent =
            goal.name ||
            'No goal yet';

        getElement(
            'goal-display-percent'
        ).textContent =
            percentage + '%';

        getElement(
            'goal-progress-bar'
        ).style.width =
            percentage + '%';

        getElement(
            'goal-remaining'
        ).textContent =
            formatCurrency(
                remaining
            );

        getElement(
            'goal-monthly'
        ).textContent =
            formatCurrency(
                monthlyNeeded
            );
    }


    // 11.2 saveSavingsGoal()
    // Use: Stores the savings goal inputs and refreshes the goal display.
    function saveSavingsGoal() {
        state.savingsGoal.name =
            getElement(
                'goal-name'
            ).value.trim();

        state.savingsGoal.target =
            Number(
                getElement(
                    'goal-target'
                ).value
            ) || 0;

        state.savingsGoal.saved =
            Number(
                getElement(
                    'goal-current'
                ).value
            ) || 0;

        saveState();

        renderSavingsGoal(
            calculateModel()
        );
    }


    // 11.3 initSavingsGoalInputs()
    // Use: Loads saved goal values into the visible form.
    function initSavingsGoalInputs() {
        getElement(
            'goal-name'
        ).value =
            state.savingsGoal.name || '';

        getElement(
            'goal-target'
        ).value =
            state.savingsGoal.target || '';

        getElement(
            'goal-current'
        ).value =
            state.savingsGoal.saved || '';
    }


    // ==================================================
    // 12. CHARTS
    // ==================================================

    let forecastChartInstance = null;
    let cashFlowChartInstance = null;
    let distributionChartInstance = null;


    // 12.1 destroyChart()
    // Use: Safely destroys an existing Chart.js instance before re-rendering.
    function destroyChart(instance) {
        if (instance) {
            instance.destroy();
        }
    }


    // 12.2 renderForecastChart()
    // Use: Shows projected balance movement across the remaining planning period.
    function renderForecastChart(model) {
        const canvas =
            getElement(
                'forecast-chart'
            );

        destroyChart(
            forecastChartInstance
        );

        const pointsCount = 7;
        const labels = [];
        const balances = [];

        const startMs =
            model.forecastStartDate.getTime();

        const endMs =
            model.toDate.getTime();

        const stepMs =
            pointsCount > 1
                ? (
                    endMs - startMs
                ) /
                    (pointsCount - 1)
                : 0;

        const totalRemainingDays =
            Math.max(
                1,
                model.remainingDays
            );

        for (
            let index = 0;
            index < pointsCount;
            index += 1
        ) {
            const pointDate =
                new Date(
                    startMs +
                    stepMs * index
                );

            labels.push(
                formatDateDisplay(
                    pointDate
                )
            );

            const daysPassed =
                Math.max(
                    0,
                    getDiffDays(
                        model.forecastStartDate,
                        pointDate
                    )
                );

            const fraction =
                Math.min(
                    1,
                    daysPassed /
                        totalRemainingDays
                );

            const income =
                model.expectedFutureIncome *
                fraction;

            const expenses =
                model.totalRemainingPlanned *
                fraction;

            balances.push(
                Math.round(
                    model.availableNow +
                    income -
                    expenses
                )
            );
        }

        forecastChartInstance =
            new Chart(
                canvas,
                {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [
                            {
                                label:
                                    'Projected Balance (₹)',
                                data: balances,
                                borderColor:
                                    '#3b82f6',
                                backgroundColor:
                                    'rgba(59, 130, 246, 0.08)',
                                fill: true,
                                tension: 0.3,
                                borderWidth: 2.5,
                                pointBackgroundColor:
                                    '#3b82f6',
                                pointRadius: 4,
                                pointHoverRadius: 6
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    label:
                                        context =>
                                            ' Projected: ₹' +
                                            formatCurrency(
                                                context.parsed.y
                                            )
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: {
                                    display: false
                                }
                            },
                            y: {
                                ticks: {
                                    callback:
                                        value =>
                                            '₹' + value
                                }
                            }
                        }
                    }
                }
            );
    }


    // 12.3 renderCashFlowChart()
    // Use: Compares available money, future income, remaining plan, and end balance.
    function renderCashFlowChart(model) {
        const canvas =
            getElement(
                'cashflow-chart'
            );

        destroyChart(
            cashFlowChartInstance
        );

        cashFlowChartInstance =
            new Chart(
                canvas,
                {
                    type: 'bar',
                    data: {
                        labels: [
                            'Available Now',
                            'Future Income',
                            'Remaining Plan',
                            'Projected End'
                        ],
                        datasets: [
                            {
                                data: [
                                    model.availableNow,
                                    model.expectedFutureIncome,
                                    model.totalRemainingPlanned,
                                    Math.max(
                                        0,
                                        model.projectedBalance
                                    )
                                ],
                                backgroundColor: [
                                    '#3b82f6',
                                    '#10b981',
                                    '#f59e0b',
                                    model.projectedBalance >= 0
                                        ? '#6366f1'
                                        : '#ef4444'
                                ],
                                borderRadius: 4
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false
                            },
                            tooltip: {
                                callbacks: {
                                    label:
                                        context =>
                                            ' ₹' +
                                            formatCurrency(
                                                context.parsed.y
                                            )
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: {
                                    display: false
                                }
                            },
                            y: {
                                ticks: {
                                    callback:
                                        value =>
                                            '₹' + value
                                }
                            }
                        }
                    }
                }
            );
    }


    // 12.4 renderDistributionChart()
    // Use: Shows where the planned spending is distributed across categories.
    function renderDistributionChart(model) {
        const canvas =
            getElement(
                'expense-chart'
            );

        destroyChart(
            distributionChartInstance
        );

        const labels = [];
        const values = [];

        const chartColors = [
            '#3b82f6',
            '#10b981',
            '#f59e0b',
            '#ec4899',
            '#8b5cf6',
            '#06b6d4',
            '#14b8a6',
            '#64748b'
        ];

        CATEGORIES.forEach(
            (category, index) => {
                const amount =
                    model.wholePlannedByCategory[
                        category.id
                    ] || 0;

                if (amount > 0) {
                    labels.push(
                        category.label
                    );

                    values.push(
                        amount
                    );
                }
            }
        );

        distributionChartInstance =
            new Chart(
                canvas,
                {
                    type: 'doughnut',
                    data: {
                        labels:
                            labels.length > 0
                                ? labels
                                : [
                                    'No expenses budgeted'
                                ],
                        datasets: [
                            {
                                data:
                                    values.length > 0
                                        ? values
                                        : [1],
                                backgroundColor:
                                    values.length > 0
                                        ? chartColors.slice(
                                            0,
                                            values.length
                                        )
                                        : ['#cbd5e1'],
                                borderWidth: 1,
                                borderColor:
                                    '#ffffff'
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'right'
                            }
                        },
                        cutout: '70%'
                    }
                }
            );
    }


    // 12.5 renderCharts()
    // Use: Renders all detailed dashboard charts after the runway is revealed.
    function renderCharts(model) {
        if (typeof Chart !== 'function') {
            console.warn(
                'Chart.js is not available; charts were skipped.'
            );
            return;
        }

        renderCashFlowChart(model);
        renderDistributionChart(model);
        renderForecastChart(model);
    }


    // ==================================================
    // 13. VISIBILITY & PROGRESSIVE DISCLOSURE
    // ==================================================

    // 13.1 setSectionVisibility()
    // Use: Shows or hides a major result section while keeping accessibility state in sync.
    function setSectionVisibility(
        id,
        visible
    ) {
        const section =
            getElement(id);

        section.classList.toggle(
            'is-hidden',
            !visible
        );

        section.setAttribute(
            'aria-hidden',
            String(!visible)
        );
    }


    // 13.2 setPlanningView()
    // Use: Shows the full-width input experience and hides result sections.
    function setPlanningView() {
        const plannerShell =
            getElement('planner');

        plannerShell.classList.remove(
            'results-mode'
        );

        plannerShell.dataset.viewMode =
            'planning';

        setSectionVisibility(
            'runway-summary',
            false
        );

        setSectionVisibility(
            'dashboard-details',
            false
        );
    }


    // 13.3 setResultsView()
    // Use: Hides the long input form and presents the full-width result experience.
    function setResultsView() {
        const plannerShell =
            getElement('planner');

        plannerShell.classList.add(
            'results-mode'
        );

        plannerShell.dataset.viewMode =
            'results';

        setSectionVisibility(
            'runway-summary',
            true
        );

        setSectionVisibility(
            'dashboard-details',
            true
        );
    }


    // 13.4 revealRunwayExperience()
    // Use: Switches the application from planning mode to results mode.
    function revealRunwayExperience() {
        setResultsView();
    }


    // 13.5 hideRunwayExperience()
    // Use: Returns the interface to the full-width planning view.
    function hideRunwayExperience() {
        setPlanningView();
    }


    // 13.6 handleEditPlan()
    // Use: Restores the saved planner inputs so the user can correct or update them.
    function handleEditPlan() {
        state.hasSubmittedPlan =
            false;

        saveState();

        setPlanningView();

        getElement(
            'planner-validation'
        ).textContent = '';

        getElement(
            'planner'
        ).scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }


    // ==================================================
    // 14. EVENT BINDING
    // ==================================================

    // 14.1 bindPlannerEvents()
    // Use: Connects all planner controls to the current state and update workflow.
    function bindPlannerEvents() {
        getElement(
            'planning-semester'
        ).addEventListener(
            'click',
            () => {
                state.mode = 'semester';
                updatePlanningCopy();
                saveState();
            }
        );

        getElement(
            'planning-monthly'
        ).addEventListener(
            'click',
            () => {
                state.mode = 'monthly';
                updatePlanningCopy();
                saveState();
            }
        );

        getElement(
            'update-runway-btn'
        ).addEventListener(
            'click',
            handleRunwayUpdate
        );

        getElement(
            'edit-plan-btn'
        ).addEventListener(
            'click',
            handleEditPlan
        );

        getElement(
            'reset-runway-btn'
        ).addEventListener(
            'click',
            resetApplication
        );
    }


    // 14.2 bindTrackingEvents()
    // Use: Connects actual-expense controls to the tracking system.
    function bindTrackingEvents() {
        getElement(
            'add-transaction-btn'
        ).addEventListener(
            'click',
            addTransaction
        );
    }


    // 14.3 bindDecisionEvents()
    // Use: Connects the affordability checker.
    function bindDecisionEvents() {
        getElement(
            'check-afford-btn'
        ).addEventListener(
            'click',
            evaluateAffordability
        );
    }


    // 14.4 bindGoalEvents()
    // Use: Connects savings goal input and save action.
    function bindGoalEvents() {
        getElement(
            'save-goal-btn'
        ).addEventListener(
            'click',
            saveSavingsGoal
        );
    }


    // 14.5 bindPrintEvent()
    // Use: Opens the browser print dialog for the existing summary feature.
    function bindPrintEvent() {
        getElement(
            'download-btn'
        ).addEventListener(
            'click',
            () => {
                window.print();
            }
        );
    }


    // 14.6 bindLiveInputPersistence()
    // Use: Saves entered values without rendering the dashboard before Update My Runway.
    function bindLiveInputPersistence() {
        getElement(
            'available-money'
        ).addEventListener(
            'input',
            event => {
                state.availableNow =
                    Number(
                        event.target.value
                    ) || 0;

                saveState();
            }
        );

        INCOME_SOURCES.forEach(
            source => {
                getElement(
                    source.inputId
                ).addEventListener(
                    'input',
                    event => {
                        state.incomeSources[
                            source.id
                        ] =
                            Number(
                                event.target.value
                            ) || 0;

                        saveState();
                    }
                );
            }
        );

        CATEGORIES.forEach(
            category => {
                getElement(
                    'expense-' + category.id
                ).addEventListener(
                    'input',
                    event => {
                        state.plannedExpenses[
                            category.id
                        ] =
                            Number(
                                event.target.value
                            ) || 0;

                        saveState();
                    }
                );
            }
        );

        getElement(
            'planning-from-date'
        ).addEventListener(
            'change',
            event => {
                state.fromDate =
                    event.target.value;

                saveState();
            }
        );

        getElement(
            'planning-to-date'
        ).addEventListener(
            'change',
            event => {
                state.toDate =
                    event.target.value;

                saveState();
            }
        );
    }


    // 14.7 resetApplication()
    // Use: Clears saved data and returns the app to the first-run planner state.
    function resetApplication() {
        const shouldReset =
            window.confirm(
                'Reset all TermRunway planning data and transactions?'
            );

        if (!shouldReset) {
            return;
        }

        localStorage.removeItem(
            STORAGE_KEY
        );

        LEGACY_STORAGE_KEYS.forEach(
            storageKey => {
                localStorage.removeItem(
                    storageKey
                );
            }
        );

        state =
            createDefaultState();

        initPlannerInputs();
        initSavingsGoalInputs();

        hideRunwayExperience();

        getElement(
            'planner-validation'
        ).textContent = '';

        if (forecastChartInstance) {
            forecastChartInstance.destroy();
            forecastChartInstance = null;
        }

        if (cashFlowChartInstance) {
            cashFlowChartInstance.destroy();
            cashFlowChartInstance = null;
        }

        if (distributionChartInstance) {
            distributionChartInstance.destroy();
            distributionChartInstance = null;
        }
    }


    // ==================================================
    // 15. INITIALIZATION
    // ==================================================

    // 15.1 initializeApplication()
    // Use: Validates the DOM, hydrates inputs, binds events, and intentionally
    // leaves the dashboard hidden until the user updates a valid plan.
    function initializeApplication() {
        validateDomContract();
        initPlannerInputs();
        initSavingsGoalInputs();

        bindPlannerEvents();
        bindTrackingEvents();
        bindDecisionEvents();
        bindGoalEvents();
        bindPrintEvent();
        bindLiveInputPersistence();

        const savedModel =
            calculateModel();

        if (
            state.hasSubmittedPlan &&
            savedModel.isValid &&
            hasEnoughPlanningData()
        ) {
            setResultsView();
            renderPlanSummary(
                savedModel
            );
            renderRunwaySummary(
                savedModel
            );
            renderDetailedDashboard(
                savedModel
            );
        } else {
            setPlanningView();
        }
    }


    initializeApplication();

})();
