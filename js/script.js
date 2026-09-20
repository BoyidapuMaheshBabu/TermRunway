/**
 * TermRunway — Core Engine
 * Architecture: Vanilla JavaScript, Chart.js, LocalStorage
 * Model: Timeline-based Forward Financial Runway
 */

(function () {
  'use strict';

  // --- Category Definitions ---
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

  const STORAGE_KEY = 'termrunway_state_v2';

  // --- Default State ---
  const defaultState = {
    mode: 'semester', // 'semester' | 'monthly'
    fromDate: '2026-06-01',
    toDate: '2026-12-31',
    availableNow: 10000,
    expectedIncome: 0,
    plannedExpenses: {
      tuition: 0,
      rent: 0,
      food: 3000,
      utilities: 0,
      transport: 0,
      books: 0,
      entertainment: 0,
      misc: 0
    },
    transactions: [
      {
        id: 'txn_init_demo',
        date: '2026-07-15',
        category: 'food',
        desc: 'Mid-term food supplies & meal card reload',
        amount: 6000
      }
    ],
    savingsGoal: {
      name: 'Semester Buffer',
      target: 10000,
      saved: 2000
    }
  };

  let state = loadState();

  // --- Chart Instances ---
  let forecastChartInstance = null;
  let cashFlowChartInstance = null;
  let distributionChartInstance = null;

  // --- Date Math Helpers ---
  function parseDate(dStr) {
    if (!dStr) return null;
    const parts = dStr.split('-');
    if (parts.length !== 3) return null;
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function formatDateIso(d) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function formatDateDisplay(d) {
    if (!d || isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getDiffDays(d1, d2) {
    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    const utc1 = Date.UTC(d1.getFullYear(), d1.getMonth(), d1.getDate());
    const utc2 = Date.UTC(d2.getFullYear(), d2.getMonth(), d2.getDate());
    return Math.round((utc2 - utc1) / MS_PER_DAY);
  }

  function formatCurrency(num) {
    const val = Number(num) || 0;
    return val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  // --- State Persistence ---
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(defaultState));
      const parsed = JSON.parse(raw);
      return {
        ...defaultState,
        ...parsed,
        plannedExpenses: { ...defaultState.plannedExpenses, ...(parsed.plannedExpenses || {}) },
        savingsGoal: { ...defaultState.savingsGoal, ...(parsed.savingsGoal || {}) }
      };
    } catch (e) {
      console.warn('Failed to load local storage state:', e);
      return JSON.parse(JSON.stringify(defaultState));
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Could not save to localStorage:', e);
    }
  }

  // =========================================================================
  // CORE FINANCIAL MODEL
  // =========================================================================
  function calculateModel() {
    const fromDate = parseDate(state.fromDate);
    const toDate = parseDate(state.toDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!fromDate || !toDate || toDate <= fromDate) {
      return {
        isValid: false,
        error: 'Invalid planning period. "To Date" must be strictly after "From Date".'
      };
    }

    const totalDays = Math.max(1, getDiffDays(fromDate, toDate));
    
    // Effective forecast start:
    // If fromDate is in the past, forecast starts today.
    // If fromDate is in the future, forecast starts on fromDate.
    const isFromPast = fromDate <= today;
    const forecastStartDate = isFromPast ? (today > toDate ? toDate : today) : fromDate;
    const pastDays = isFromPast ? Math.max(0, getDiffDays(fromDate, forecastStartDate)) : 0;
    const remainingDays = Math.max(0, getDiffDays(forecastStartDate, toDate));

    // Filter actual recorded transactions:
    // 1. Transaction date >= fromDate
    // 2. Transaction date <= toDate
    // 3. Transaction date <= today (no future transactions counted as actual spend)
    const validTransactions = state.transactions.filter(t => {
      const tDate = parseDate(t.date);
      if (!tDate) return false;
      return tDate >= fromDate && tDate <= toDate && tDate <= today;
    });

    const actualByCategory = {};
    CATEGORIES.forEach(c => (actualByCategory[c.id] = 0));
    let totalActualSpent = 0;

    validTransactions.forEach(t => {
      const amt = Number(t.amount) || 0;
      if (actualByCategory[t.category] !== undefined) {
        actualByCategory[t.category] += amt;
      }
      totalActualSpent += amt;
    });

    // Whole Period Planned & Remaining Future Planned
    const wholePlannedByCategory = {};
    const remainingPlannedByCategory = {};
    let totalWholePlanned = 0;
    let totalRemainingPlanned = 0;

    if (state.mode === 'semester') {
      // Semester Mode:
      // Entered value is for the entire From -> To period.
      // Remaining for future = max(0, Entered Plan - Actual Spent).
      CATEGORIES.forEach(c => {
        const entered = Number(state.plannedExpenses[c.id]) || 0;
        wholePlannedByCategory[c.id] = entered;
        totalWholePlanned += entered;

        const spent = actualByCategory[c.id] || 0;
        const rem = Math.max(0, entered - spent);
        remainingPlannedByCategory[c.id] = rem;
        totalRemainingPlanned += rem;
      });
    } else {
      // Monthly Mode:
      // Entered value is recurring monthly amount.
      // Convert to daily rate: (monthlyAmount * 12) / 365
      CATEGORIES.forEach(c => {
        const monthly = Number(state.plannedExpenses[c.id]) || 0;
        const dailyRate = (monthly * 12) / 365;

        const wholeAmt = dailyRate * totalDays;
        wholePlannedByCategory[c.id] = wholeAmt;
        totalWholePlanned += wholeAmt;

        // Future planned is based purely on the remaining calendar days
        const remAmt = dailyRate * remainingDays;
        remainingPlannedByCategory[c.id] = remAmt;
        totalRemainingPlanned += remAmt;
      });
    }

    // Expected Future Income
    let expectedFutureIncome = 0;
    if (state.mode === 'semester') {
      expectedFutureIncome = Number(state.expectedIncome) || 0;
    } else {
      const monthlyIncome = Number(state.expectedIncome) || 0;
      const dailyIncomeRate = (monthlyIncome * 12) / 365;
      expectedFutureIncome = dailyIncomeRate * remainingDays;
    }

    const availableNow = Number(state.availableNow) || 0;

    // PROJECTED BALANCE:
    // Available Now + Expected Future Income - Remaining Future Planned
    // (Actual historical spend is NOT subtracted again from Available Now!)
    const projectedBalance = availableNow + expectedFutureIncome - totalRemainingPlanned;

    // Daily safe spending:
    // If projected balance > 0, how much discretionary surplus can be spent per remaining day?
    const dailySafeSpend = remainingDays > 0 ? (projectedBalance > 0 ? projectedBalance / remainingDays : 0) : 0;

    // TermRunway Planning Health Indicator (0 - 100)
    let healthScore = 50;
    if (totalRemainingPlanned > 0 || totalWholePlanned > 0) {
      const bufferRatio = totalRemainingPlanned > 0 ? (projectedBalance / totalRemainingPlanned) : (projectedBalance > 0 ? 1 : -1);
      if (projectedBalance < 0) {
        healthScore = Math.max(10, Math.round(40 + bufferRatio * 30));
      } else {
        healthScore = Math.min(100, Math.round(65 + Math.min(bufferRatio, 1) * 35));
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

  // =========================================================================
  // DOM UPDATES & RENDERING
  // =========================================================================
  function renderAll() {
    const model = calculateModel();

    // Timeline visual tags
    document.getElementById('timelineTodayLabel').textContent = formatDateDisplay(new Date());
    document.getElementById('timelineFromLabel').textContent = formatDateDisplay(parseDate(state.fromDate));
    document.getElementById('timelineToLabel').textContent = formatDateDisplay(parseDate(state.toDate));

    // Mode UI
    document.getElementById('modeSemesterBtn').classList.toggle('active', state.mode === 'semester');
    document.getElementById('modeMonthlyBtn').classList.toggle('active', state.mode === 'monthly');
    document.getElementById('expenseModeBadge').textContent = state.mode === 'semester' ? 'Full Term Figures' : 'Monthly Recurring Figures';
    document.getElementById('expenseModeDesc').textContent = state.mode === 'semester'
      ? 'Enter your total budget per category for the whole planning window.'
      : 'Enter your monthly budget per category. The engine prorates it over the remaining days.';
    document.getElementById('incomeInputLabel').textContent = state.mode === 'semester'
      ? 'Expected Future Income (₹)'
      : 'Monthly Expected Income (₹)';
    document.getElementById('incomeInputHint').textContent = state.mode === 'semester'
      ? 'Lump-sum scholarships, stipends, or allowances expected before term ends'
      : 'Monthly recurring stipend or allowance (prorated over remaining days)';

    if (!model.isValid) {
      document.getElementById('projectedBalanceMessage').textContent = model.error;
      document.getElementById('dashProjectedBalance').textContent = '—';
      return;
    }

    // Days preview in planner
    document.getElementById('previewTotalDays').textContent = `${model.totalDays} days`;
    document.getElementById('previewRemainingDays').textContent = `${model.remainingDays} days`;
    document.getElementById('sumTotalPlannedDisplay').textContent = `₹${formatCurrency(model.totalWholePlanned)}`;

    // Core Dashboard Metrics
    document.getElementById('dashProjectedBalance').textContent = formatCurrency(model.projectedBalance);
    document.getElementById('dashAvailableNow').textContent = `₹${formatCurrency(model.availableNow)}`;
    document.getElementById('dashExpectedIncome').textContent = `₹${formatCurrency(model.expectedFutureIncome)}`;
    document.getElementById('dashTotalPlanned').textContent = `₹${formatCurrency(model.totalWholePlanned)}`;
    document.getElementById('dashActualSpent').textContent = `₹${formatCurrency(model.totalActualSpent)}`;
    document.getElementById('dashRemainingPlanned').textContent = `₹${formatCurrency(model.totalRemainingPlanned)}`;
    document.getElementById('dashDaysRemaining').textContent = String(model.remainingDays);
    document.getElementById('dashDailySafe').textContent = `₹${formatCurrency(model.dailySafeSpend)} / day`;

    // Flow Strip
    document.getElementById('flowAvailable').textContent = `₹${formatCurrency(model.availableNow)}`;
    document.getElementById('flowIncome').textContent = `₹${formatCurrency(model.expectedFutureIncome)}`;
    document.getElementById('flowRemainingPlan').textContent = `₹${formatCurrency(model.totalRemainingPlanned)}`;
    document.getElementById('dashTimelineSubtitle').textContent = `Forecast: ${formatDateDisplay(model.forecastStartDate)} → ${formatDateDisplay(model.toDate)}`;

    // Status Pill & Messaging
    const statusPill = document.getElementById('runwayStatusBadge');
    const msgEl = document.getElementById('projectedBalanceMessage');
    const projCard = document.getElementById('projectedBalanceCard');

    if (model.projectedBalance >= 0) {
      statusPill.className = 'status-pill status-healthy';
      statusPill.textContent = 'Runway Healthy';
      msgEl.textContent = `Your finances are fully solvent through ${formatDateDisplay(model.toDate)} with a projected reserve of ₹${formatCurrency(model.projectedBalance)}.`;
      projCard.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    } else {
      statusPill.className = 'status-pill status-deficit';
      statusPill.textContent = 'Projected Deficit';
      msgEl.textContent = `Warning: Anticipated commitments exceed available funds by ₹${formatCurrency(Math.abs(model.projectedBalance))} before term end.`;
      projCard.style.borderColor = 'rgba(239, 68, 68, 0.5)';
    }

    // Health Score
    document.getElementById('dashHealthScore').textContent = String(model.healthScore);
    const catEl = document.getElementById('dashHealthCategory');
    if (model.healthScore >= 75) {
      catEl.textContent = 'Strong Runway Buffer';
      catEl.className = 'metric-caption text-success';
    } else if (model.healthScore >= 50) {
      catEl.textContent = 'Balanced / Moderate Buffer';
      catEl.className = 'metric-caption text-accent';
    } else {
      catEl.textContent = 'Deficit Risk / Action Needed';
      catEl.className = 'metric-caption text-danger';
    }

    // Render Sub-tables and Charts
    renderTransactionsTable(model.validTransactions);
    renderAnalysisTable(model);
    renderSavingsGoal(model);
    renderCharts(model);
  }

  // --- Transactions Ledger ---
  function renderTransactionsTable(validTxns) {
    const tbody = document.getElementById('transactionsTableBody');
    const countBadge = document.getElementById('txnCountBadge');
    countBadge.textContent = `${validTxns.length} active entries`;

    if (validTxns.length === 0) {
      tbody.innerHTML = `
        <tr class="empty-row">
          <td colspan="5">No transactions recorded inside the active period yet.</td>
        </tr>
      `;
      return;
    }

    // Sort descending by date
    const sorted = [...validTxns].sort((a, b) => new Date(b.date) - new Date(a.date));

    tbody.innerHTML = sorted.map(t => {
      const catObj = CATEGORIES.find(c => c.id === t.category) || { label: t.category };
      return `
        <tr>
          <td>${t.date}</td>
          <td><span class="cat-tag">${catObj.label}</span></td>
          <td>${escapeHtml(t.desc || '—')}</td>
          <td class="text-right font-numeric">₹${formatCurrency(t.amount)}</td>
          <td class="text-center">
            <button class="btn-delete-icon" data-id="${t.id}" title="Delete entry">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Bind delete actions
    tbody.querySelectorAll('.btn-delete-icon').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        deleteExpense(id);
      });
    });
  }

  function deleteExpense(id) {
    state.transactions = state.transactions.filter(t => t.id !== id);
    saveState();
    renderAll();
  }

  // --- Spending Analysis Table ---
  function renderAnalysisTable(model) {
    const tbody = document.getElementById('analysisTableBody');

    tbody.innerHTML = CATEGORIES.map(cat => {
      const whole = model.wholePlannedByCategory[cat.id] || 0;
      const actual = model.actualByCategory[cat.id] || 0;
      const rem = model.remainingPlannedByCategory[cat.id] || 0;

      let pct = whole > 0 ? Math.min(100, Math.round((actual / whole) * 100)) : (actual > 0 ? 100 : 0);
      let statusBadge = '<span class="badge">On Track</span>';

      if (whole > 0 && actual > whole) {
        statusBadge = '<span class="badge text-danger" style="border-color: rgba(239,68,68,0.4)">Over Budget</span>';
      } else if (whole > 0 && pct >= 85) {
        statusBadge = '<span class="badge text-warning" style="border-color: rgba(245,158,11,0.4)">Near Limit</span>';
      }

      return `
        <tr>
          <td><strong>${cat.label}</strong></td>
          <td class="text-right font-numeric">₹${formatCurrency(whole)}</td>
          <td class="text-right font-numeric text-accent">₹${formatCurrency(actual)}</td>
          <td class="text-right font-numeric">₹${formatCurrency(rem)}</td>
          <td>
            <div class="table-progress-track">
              <div class="table-progress-fill" style="width: ${pct}%; background: ${pct > 100 ? 'var(--accent-danger)' : 'var(--accent-primary)'};"></div>
            </div>
          </td>
          <td class="text-center">${statusBadge}</td>
        </tr>
      `;
    }).join('');
  }

  // --- Savings Goal Render ---
  function renderSavingsGoal(model) {
    const goal = state.savingsGoal;
    const target = Number(goal.target) || 0;
    const saved = Number(goal.saved) || 0;
    const remaining = Math.max(0, target - saved);
    const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;

    document.getElementById('goalPctText').textContent = `${pct}%`;
    document.getElementById('goalRemainingText').textContent = `₹${formatCurrency(remaining)}`;
    document.getElementById('goalProgressBar').style.width = `${pct}%`;

    const remainingMonths = Math.max(0.2, model.remainingDays / 30.4);
    const monthlyNeeded = remaining / remainingMonths;
    document.getElementById('goalMonthlyPace').textContent = `₹${formatCurrency(monthlyNeeded)} / month`;
  }

  // --- Decision Center Simulation ---
  function evaluateAffordability() {
    const cost = Number(document.getElementById('affordCost').value) || 0;
    const itemName = document.getElementById('affordItem').value.trim() || 'This purchase';

    const box = document.getElementById('affordResultBox');
    if (cost <= 0) {
      box.style.display = 'none';
      return;
    }

    const model = calculateModel();
    if (!model.isValid) return;

    const newProjected = model.projectedBalance - cost;
    const newDaily = model.remainingDays > 0 ? (newProjected > 0 ? newProjected / model.remainingDays : 0) : 0;

    const badge = document.getElementById('affordBadge');
    const title = document.getElementById('affordTitle');
    const detail = document.getElementById('affordDetail');

    box.style.display = 'block';
    document.getElementById('affordNewBalance').textContent = `₹${formatCurrency(newProjected)}`;
    document.getElementById('affordNewDaily').textContent = `₹${formatCurrency(newDaily)}/day`;

    if (newProjected >= model.totalRemainingPlanned * 0.15 && newProjected > 0) {
      badge.className = 'decision-badge badge-success';
      badge.textContent = 'Comfortably Affordable';
      title.textContent = `${itemName} fits safely within your runway`;
      detail.textContent = `Purchasing this leaves a healthy projected buffer of ₹${formatCurrency(newProjected)} at term end.`;
    } else if (newProjected >= 0) {
      badge.className = 'decision-badge badge-warning';
      badge.textContent = 'Tight / Feasible';
      title.textContent = `${itemName} significantly narrows your margin`;
      detail.textContent = `You will avoid a deficit, but your ending reserve drops to ₹${formatCurrency(newProjected)}.`;
    } else {
      badge.className = 'decision-badge badge-danger';
      badge.textContent = 'Not Recommended';
      title.textContent = `${itemName} triggers a projected term deficit`;
      detail.textContent = `Making this purchase causes an anticipated shortfall of -₹${formatCurrency(Math.abs(newProjected))} before the term concludes.`;
    }
  }

  // =========================================================================
  // CHARTS (Chart.js)
  // =========================================================================
  function renderCharts(model) {
    renderForecastChart(model);
    renderCashFlowChart(model);
    renderDistributionChart(model);
  }

  function renderForecastChart(model) {
    const ctx = document.getElementById('forecastChart');
    if (!ctx) return;

    // Generate 7-8 evenly spaced simulation points from forecastStartDate to toDate
    const pointsCount = 7;
    const labels = [];
    const balances = [];

    const startMs = model.forecastStartDate.getTime();
    const endMs = model.toDate.getTime();
    const stepMs = (endMs - startMs) / (pointsCount - 1);

    const totalDaysRemaining = Math.max(1, model.remainingDays);

    for (let i = 0; i < pointsCount; i++) {
      const currentPointDate = new Date(startMs + stepMs * i);
      labels.push(formatDateDisplay(currentPointDate));

      const daysPassedFromStart = Math.max(0, getDiffDays(model.forecastStartDate, currentPointDate));
      const fraction = Math.min(1, daysPassedFromStart / totalDaysRemaining);

      const proratedIncome = model.expectedFutureIncome * fraction;
      const proratedExpenses = model.totalRemainingPlanned * fraction;

      // Balance progression forward from Available Now
      const currentBalance = model.availableNow + proratedIncome - proratedExpenses;
      balances.push(Math.round(currentBalance));
    }

    if (forecastChartInstance) {
      forecastChartInstance.destroy();
    }

    forecastChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Projected Runway Balance (₹)',
          data: balances,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointBackgroundColor: '#3b82f6',
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` Projected: ₹${formatCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 11 },
              callback: (v) => `₹${v}`
            }
          }
        }
      }
    });
  }

  function renderCashFlowChart(model) {
    const ctx = document.getElementById('cashFlowChart');
    if (!ctx) return;

    if (cashFlowChartInstance) {
      cashFlowChartInstance.destroy();
    }

    cashFlowChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Available Now', 'Future Income', 'Remaining Plan', 'Projected End'],
        datasets: [{
          data: [
            model.availableNow,
            model.expectedFutureIncome,
            model.totalRemainingPlanned,
            Math.max(0, model.projectedBalance)
          ],
          backgroundColor: [
            '#3b82f6',
            '#10b981',
            '#f59e0b',
            model.projectedBalance >= 0 ? '#6366f1' : '#ef4444'
          ],
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ₹${formatCurrency(ctx.parsed.y)}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#94a3b8',
              font: { size: 11 },
              callback: (v) => `₹${v}`
            }
          }
        }
      }
    });
  }

  function renderDistributionChart(model) {
    const ctx = document.getElementById('distributionChart');
    if (!ctx) return;

    const labels = [];
    const values = [];
    const colors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ec4899',
      '#8b5cf6', '#06b6d4', '#14b8a6', '#64748b'
    ];

    CATEGORIES.forEach(c => {
      const amt = model.wholePlannedByCategory[c.id] || 0;
      if (amt > 0) {
        labels.push(c.label);
        values.push(amt);
      }
    });

    if (distributionChartInstance) {
      distributionChartInstance.destroy();
    }

    distributionChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels.length > 0 ? labels : ['No expenses budgeted'],
        datasets: [{
          data: values.length > 0 ? values : [1],
          backgroundColor: values.length > 0 ? colors.slice(0, values.length) : ['#334155'],
          borderWidth: 1,
          borderColor: '#0f172a'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#94a3b8', font: { size: 11 }, boxWidth: 12 }
          }
        },
        cutout: '70%'
      }
    });
  }

  // --- Escape Helper ---
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // =========================================================================
  // EVENT LISTENERS & INITIALIZATION
  // =========================================================================
  function initInputsFromState() {
    document.getElementById('inputFromDate').value = state.fromDate;
    document.getElementById('inputToDate').value = state.toDate;
    document.getElementById('inputAvailableNow').value = state.availableNow || '';
    document.getElementById('inputExpectedIncome').value = state.expectedIncome || '';

    // Category Inputs
    CATEGORIES.forEach(c => {
      const el = document.getElementById(`plan_${c.id}`);
      if (el) el.value = state.plannedExpenses[c.id] || '';
    });

    // Savings Goal
    document.getElementById('goalName').value = state.savingsGoal.name || '';
    document.getElementById('goalTarget').value = state.savingsGoal.target || '';
    document.getElementById('goalSaved').value = state.savingsGoal.saved || '';

    // Transaction form date defaults to today's date formatted
    document.getElementById('txnDate').value = formatDateIso(new Date());
  }

  function bindEvents() {
    // Mode toggles
    document.getElementById('modeSemesterBtn').addEventListener('click', () => {
      state.mode = 'semester';
      saveState();
      renderAll();
    });

    document.getElementById('modeMonthlyBtn').addEventListener('click', () => {
      state.mode = 'monthly';
      saveState();
      renderAll();
    });

    // Date changes
    document.getElementById('inputFromDate').addEventListener('change', (e) => {
      state.fromDate = e.target.value;
      saveState();
      renderAll();
    });

    document.getElementById('inputToDate').addEventListener('change', (e) => {
      state.toDate = e.target.value;
      saveState();
      renderAll();
    });

    // Starting money & income
    document.getElementById('inputAvailableNow').addEventListener('input', (e) => {
      state.availableNow = Number(e.target.value) || 0;
      saveState();
      renderAll();
    });

    document.getElementById('inputExpectedIncome').addEventListener('input', (e) => {
      state.expectedIncome = Number(e.target.value) || 0;
      saveState();
      renderAll();
    });

    // Category planned inputs
    CATEGORIES.forEach(c => {
      const el = document.getElementById(`plan_${c.id}`);
      if (el) {
        el.addEventListener('input', (e) => {
          state.plannedExpenses[c.id] = Number(e.target.value) || 0;
          saveState();
          renderAll();
        });
      }
    });

    // Add Expense Transaction
    document.getElementById('addExpenseForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const dateVal = document.getElementById('txnDate').value;
      const catVal = document.getElementById('txnCategory').value;
      const descVal = document.getElementById('txnDesc').value.trim();
      const amtVal = Number(document.getElementById('txnAmount').value) || 0;

      if (!dateVal || amtVal <= 0) {
        alert('Please provide a valid date and amount.');
        return;
      }

      const newTxn = {
        id: 'txn_' + Date.now(),
        date: dateVal,
        category: catVal,
        desc: descVal,
        amount: amtVal
      };

      state.transactions.push(newTxn);
      saveState();
      renderAll();

      // Reset form fields
      document.getElementById('txnAmount').value = '';
      document.getElementById('txnDesc').value = '';
    });

    // Savings Goal inputs
    document.getElementById('goalName').addEventListener('input', (e) => {
      state.savingsGoal.name = e.target.value;
      saveState();
    });

    document.getElementById('goalTarget').addEventListener('input', (e) => {
      state.savingsGoal.target = Number(e.target.value) || 0;
      saveState();
      renderSavingsGoal(calculateModel());
    });

    document.getElementById('goalSaved').addEventListener('input', (e) => {
      state.savingsGoal.saved = Number(e.target.value) || 0;
      saveState();
      renderSavingsGoal(calculateModel());
    });

    // Decision Center
    document.getElementById('evalAffordBtn').addEventListener('click', evaluateAffordability);

    // Print summary
    document.getElementById('printSummaryBtn').addEventListener('click', () => {
      window.print();
    });

    // Reset data
    document.getElementById('resetAllDataBtn').addEventListener('click', () => {
      if (confirm('Reset all TermRunway planning data and transactions to defaults?')) {
        localStorage.removeItem(STORAGE_KEY);
        state = JSON.parse(JSON.stringify(defaultState));
        initInputsFromState();
        renderAll();
      }
    });
  }

  // --- Initialize App ---
  initInputsFromState();
  bindEvents();
  renderAll();

})();