import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.apiKey,
    authDomain: process.env.authDomain,
    databaseURL: process.env.databaseURL,
    projectId: process.env.projectId,
    storageBucket: process.env.storageBucket,
    messagingSenderId: process.env.messagingSenderId,
    appId: process.env.appId,
    measurementId: process.env.measurementId
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const TAX_RATE = 0.0816;
const GAS_BONUS_GROSS = 100;
const GAS_BONUS_NET = Number((GAS_BONUS_GROSS * (1 - TAX_RATE)).toFixed(2));

let allEntries = [];

document.addEventListener('DOMContentLoaded', initHistory);

async function initHistory() {
    const mainDiv = document.querySelector('.main');
    if (!mainDiv) return;

    mainDiv.innerHTML = '';
    mainDiv.classList.add('history-shell');

    const controls = document.createElement('div');
    controls.className = 'history-controls';
    controls.innerHTML = `
        <div>
            <h1>History</h1>
            <p class="subtext">Browse prior months (current month hidden), search by job or note.</p>
        </div>
        <div class="history-filters">
            <input type="search" id="historySearch" placeholder="Search by job, description, or date">
        </div>
    `;
    mainDiv.appendChild(controls);

    const list = document.createElement('div');
    list.id = 'historyList';
    list.className = 'history-list';
    mainDiv.appendChild(list);

    allEntries = await loadEntries();
    const subscriptions = await loadSubscriptions();
    renderHistory(allEntries, '', subscriptions);

    const searchInput = document.getElementById('historySearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderHistory(allEntries, e.target.value, subscriptions);
        });
    }
}

async function loadEntries() {
    const [incomeSnap, spentSnap] = await Promise.all([
        getDocs(collection(db, 'incomeData')),
        getDocs(collection(db, 'spentHistory'))
    ]);

    const incomeData = incomeSnap.docs.map(doc => ({
        id: doc.id,
        type: 'Income',
        ...doc.data()
    }));

    const spentData = spentSnap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            type: 'Spent',
            ...data,
            category: detectGasCategory(data.description, data.category)
        };
    });

    return [...incomeData, ...spentData].map(item => ({
        ...item,
        dateObj: parseDate(item.date),
        displayJob: displayJobLabel(item),
        category: item.type === 'Income' && item.job === 'GasBonus' ? 'Gas' : item.category
    }));
}

async function loadSubscriptions() {
    const subsSnap = await getDocs(collection(db, 'Subscriptions'));
    return subsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function parseDate(dateStr) {
    const [m, d, y] = dateStr.split('/').map(Number);
    return new Date(y, m - 1, d);
}

function parseSubscriptionDueDate(rawDate) {
    if (!rawDate) return null;

    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
        return rawDate;
    }

    const value = String(rawDate).trim();
    if (!value) return null;

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(value)) {
        const [month, day, year] = value.split('/').map(Number);
        return new Date(year, month - 1, day);
    }

    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
}

function isMonthlySubscriptionActiveForMonth(subscription, monthDate) {
    if (!subscription || (subscription.cadence || '').toLowerCase() !== 'monthly') {
        return false;
    }

    const dueDate = parseSubscriptionDueDate(subscription.dueDate);
    if (!dueDate) {
        return true;
    }

    const monthEnd = new Date(
        monthDate.getFullYear(),
        monthDate.getMonth() + 1,
        0,
        23, 59, 59, 999
    );

    return dueDate.getTime() <= monthEnd.getTime();
}

function detectGasCategory(description = '', existingCategory = '') {
    const desc = String(description).toLowerCase();
    if (existingCategory && String(existingCategory).toLowerCase() === 'gas') return 'Gas';
    if (desc.includes('gas')) return 'Gas';
    return '';
}

function displayJobLabel(entry) {
    if (!entry || !entry.job) return '';
    if (entry.job === 'GasBonus') return 'Gas Bonus';
    return entry.job;
}

function formatMonth(dateObj) {
    return dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
}


function formatCurrency(value) {
    if (isNaN(value) || !isFinite(value)) return '$0.00';
    const sign = value < 0 ? '-' : '';
    return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function roundToCents(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
}

function computeAllocations(total, gasBonusNet) {
    if (total <= 0) {
        return {
            gasBonus: 0,
            mom: 0,
            checkings: 0,
            hysa: 0,
            roth: 0,
            percents: {
                gasBonus: 0,
                mom: 0,
                checkings: 0,
                hysa: 0,
                roth: 0
            }
        };
    }

    const MOM_TARGET = 0.11;

    const fixedGas = gasBonusNet || GAS_BONUS_NET;
    const gasBonusAmount = Math.min(fixedGas, total);
    const gasBonusPercent = total > 0 ? gasBonusAmount / total : 0;

    let basePool = Math.max(total - gasBonusAmount, 0);

    let momAmount = basePool * MOM_TARGET;
    if (total >= 200) {
        momAmount = Math.max(momAmount, 100);
    }
    momAmount = Math.min(momAmount, basePool);
    const momPercent = total > 0 ? momAmount / total : 0;

    let remaining = Math.max(basePool - momAmount, 0);

    const wCheck = 1.4;
    const wHysa = 2;
    const wRoth = 1;
    const wSum = wCheck + wHysa + wRoth || 1;

    let checkingsAmount = remaining * (wCheck / wSum);
    let hysaAmount = remaining * (wHysa / wSum);
    let rothAmountBase = remaining * (wRoth / wSum);
    let rothAmount = rothAmountBase;

    const maxCheckings = total * 0.20;
    if (checkingsAmount > maxCheckings) {
        const excess = checkingsAmount - maxCheckings;
        checkingsAmount = maxCheckings;
        const toHysa = excess * 0.6;
        const toRoth = excess * 0.4;
        hysaAmount += toHysa;
        rothAmount += toRoth;
    }

    if (hysaAmount <= rothAmount && (hysaAmount + rothAmount) > 0) {
        const diff = (rothAmount - hysaAmount) / 2;
        const shift = Math.min(diff + 0.01, rothAmount);
        rothAmount -= shift;
        const newHysa = hysaAmount + shift;
        hysaAmount = newHysa;
        if (rothAmount < 0) {
            hysaAmount += rothAmount;
            rothAmount = 0;
        }
    }

    const checkingsPercent = total > 0 ? checkingsAmount / total : 0;
    const hysaPercent = total > 0 ? hysaAmount / total : 0;
    const rothPercent = total > 0 ? rothAmount / total : 0;
    const percentSum = gasBonusPercent + momPercent + checkingsPercent + hysaPercent + rothPercent;
    const residual = 1 - percentSum;
    if (residual > 1e-9) {
        const rothAdjusted = rothAmount + residual * total;
        return {
            gasBonus: gasBonusAmount,
            mom: momAmount,
            checkings: checkingsAmount,
            hysa: hysaAmount,
            roth: rothAdjusted,
            percents: {
                gasBonus: gasBonusPercent,
                mom: momPercent,
                checkings: checkingsPercent,
                hysa: hysaPercent,
                roth: rothAdjusted / total
            }
        };
    }

    return {
        gasBonus: gasBonusAmount,
        mom: momAmount,
        checkings: checkingsAmount,
        hysa: hysaAmount,
        roth: rothAmount,
        percents: {
            gasBonus: gasBonusPercent,
            mom: momPercent,
            checkings: checkingsPercent,
            hysa: hysaPercent,
            roth: rothPercent
        }
    };
}

function renderHistory(entries, searchTerm, subscriptions = []) {
    const list = document.getElementById('historyList');
    if (!list) return;
    list.innerHTML = '';

    const current = new Date();
    const currentMonth = current.getMonth();
    const currentYear = current.getFullYear();

    const filtered = entries.filter(e => {
        const term = searchTerm.trim().toLowerCase();
        const matchesTerm = !term || `${e.displayJob || e.job} ${e.category || ''} ${e.description || ''} ${e.date}`.toLowerCase().includes(term);
        const isCurrentMonth = e.dateObj.getMonth() === currentMonth && e.dateObj.getFullYear() === currentYear;
        return matchesTerm && !isCurrentMonth && e.job !== 'GasBonus';
    });

    const grouped = filtered.reduce((acc, entry) => {
        const key = `${entry.dateObj.getFullYear()}-${entry.dateObj.getMonth() + 1}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(entry);
        return acc;
    }, {});

    const monthKeys = Object.keys(grouped).sort((a, b) => new Date(b.split('-').join('-')) - new Date(a.split('-').join('-')));

    if (!monthKeys.length) {
        list.innerHTML = '<p class="helper-text">No past-month entries found.</p>';
        return;
    }

    monthKeys.forEach(key => {
        const monthEntries = grouped[key].sort((a, b) => b.dateObj - a.dateObj);
        const monthLabel = formatMonth(monthEntries[0].dateObj);
        const incomeTotal = monthEntries
            .filter(e => e.type === 'Income' && e.job !== 'GasBonus')
            .reduce((sum, e) => sum + (e.amount || 0), 0);
        const spentTotal = monthEntries
            .filter(e => e.type === 'Spent' && e.category !== 'Gas')
            .reduce((sum, e) => sum + (e.amount || 0), 0);
        const net = incomeTotal - spentTotal;

        const details = document.createElement('details');
        details.className = 'month-panel';

        const summary = document.createElement('summary');
        summary.innerHTML = `
            <div class="month-header">
                <div>
                    <h3>${monthLabel}</h3>
                    <div class="pill-row">
                        <span class="pill income-pill">Income: $${incomeTotal.toFixed(2)}</span>
                        <span class="pill spent-pill">Spent: -$${spentTotal.toFixed(2)}</span>
                        <span class="pill net-pill">Net: $${net.toFixed(2)}</span>
                    </div>
                </div>
                <span class="chevron">▼</span>
            </div>
        `;
        details.appendChild(summary);

        const entryList = document.createElement('div');
        entryList.className = 'month-entries';

        const layout = document.createElement('div');
        layout.className = 'month-layout';

        const entriesGrid = document.createElement('div');
        entriesGrid.className = 'month-entries__grid';

        const budgetCol = document.createElement('div');
        budgetCol.className = 'month-budget';
        const budgetBlock = buildMonthlyBudgetBlock(monthEntries, incomeTotal, subscriptions);
        if (budgetBlock) {
            budgetCol.appendChild(budgetBlock);
        }

        monthEntries.forEach(entry => {
            const row = document.createElement('div');
            row.className = 'history-entry';
            const badgeClass = entry.type === 'Spent' ? 'badge spent' : 'badge income';
            const amountSign = entry.type === 'Spent' ? '-' : '+';
            const jobLabel = entry.displayJob || entry.job || '';

            row.innerHTML = `
                <div class="history-entry__top">
                    <span class="${badgeClass}">${jobLabel}</span>
                    <span class="history-amount ${entry.type === 'Spent' ? 'neg' : 'pos'}">${amountSign}$${Math.abs(entry.amount || 0).toFixed(2)}</span>
                </div>
                <p class="history-date">${entry.date}</p>
                ${entry.category ? `<p class="history-note">Category: ${entry.category}</p>` : ''}
                ${entry.description ? `<p class="history-note">${entry.description}</p>` : ''}
            `;

            entriesGrid.appendChild(row);
        });

        layout.appendChild(entriesGrid);
        layout.appendChild(budgetCol);
        entryList.appendChild(layout);

        details.appendChild(entryList);
        list.appendChild(details);
    });
}

function buildMonthlyBudgetBlock(monthEntries, incomeTotal, subscriptions) {
    const totalNet = incomeTotal;
    const monthDate = monthEntries.length ? monthEntries[0].dateObj : new Date();
    const gasBonusNet = monthEntries
        .filter(e => e.type === 'Income' && e.job === 'GasBonus')
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const gasBonusAvailable = gasBonusNet || GAS_BONUS_NET;
    const gasSpent = monthEntries
        .filter(e => e.type === 'Spent' && e.category === 'Gas')
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const gasDelta = gasBonusAvailable - gasSpent;
    const gasOverspend = gasDelta < 0;

    const alloc = computeAllocations(totalNet, gasBonusNet);

    const monthlySubsTotal = subscriptions
        .filter(sub => isMonthlySubscriptionActiveForMonth(sub, monthDate))
        .reduce((sum, sub) => sum + (Number(sub.amount) || 0), 0);

    const yearlySubsTotal = subscriptions
        .filter(sub => (sub.cadence || '').toLowerCase() === 'yearly')
        .reduce((sum, sub) => sum + (Number(sub.amount) || 0), 0);

    const allocations = [
        { account: 'Net Income', category: '-', percent: null, amount: totalNet },
        { account: 'Gas Bonus', category: 'Gas', percent: alloc.percents.gasBonus, amount: alloc.gasBonus },
        { account: 'Gas Remaining', category: gasOverspend ? 'Gas (overspend hits Checkings)' : 'Gas', percent: null, amount: gasDelta },
        { account: 'MOM', category: 'Mom', amount: alloc.mom, percent: alloc.percents.mom },
        { account: 'AMEX Checkings', category: 'Spending', amount: alloc.checkings, percent: alloc.percents.checkings },
        ...(monthlySubsTotal > 0 ? [{ account: 'Subscriptions (Monthly)', category: 'Recurring', amount: monthlySubsTotal, percent: null }] : []),
        { account: 'AMEX HYSA', category: 'Savings', amount: alloc.hysa, percent: alloc.percents.hysa },
        { account: 'RothIRA', category: 'Retirement', amount: alloc.roth, percent: alloc.percents.roth },
        ...(yearlySubsTotal > 0 ? [{ account: 'Yearly Subscriptions', category: 'Recurring', amount: yearlySubsTotal, percent: null }] : [])
    ];

    const wrapper = document.createElement('div');
    wrapper.className = 'history-budget';

    const title = document.createElement('h4');
    title.textContent = 'Monthly Budget';
    wrapper.appendChild(title);

    const table = document.createElement('div');
    table.className = 'budget-table';

    const header = document.createElement('div');
    header.className = 'budget-row budget-header';
    header.innerHTML = `<span>Account</span><span>Category</span><span>%</span><span>Amount</span>`;
    table.appendChild(header);

    allocations.forEach(item => {
        const row = document.createElement('div');
        row.className = 'budget-row';
        row.innerHTML = `
            <span>${item.account}</span>
            <span>${item.category}</span>
            <span>${item.percent === null ? '-' : `${(item.percent * 100).toFixed(0)}%`}</span>
            <span class="entry-amount">${formatCurrency(item.amount)}</span>
        `;
        table.appendChild(row);
    });

    wrapper.appendChild(table);

    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'history-budget__summary';

    const summaryTitle = document.createElement('h5');
    summaryTitle.textContent = 'Summary';
    summaryDiv.appendChild(summaryTitle);

    const summaryTable = document.createElement('div');
    summaryTable.className = 'budget-table summary-table';

    const summaryHeader = document.createElement('div');
    summaryHeader.className = 'budget-row budget-header';
    summaryHeader.innerHTML = `<span>Account</span><span>Category</span><span>Amount</span>`;
    summaryTable.appendChild(summaryHeader);

    let netChecking = alloc.checkings;
    let summaryMomAmount = alloc.mom;

    if (gasDelta > 0) {
        const gasToMom = roundToCents(gasDelta * (2 / 3));
        const gasToChecking = roundToCents(gasDelta - gasToMom);
        summaryMomAmount += gasToMom;
        netChecking += gasToChecking;
    }

    summaryMomAmount = roundToCents(summaryMomAmount);
    netChecking = roundToCents(netChecking);

    let netHysa = roundToCents(netChecking + alloc.hysa);
    const targetTotal = roundToCents(totalNet);
    const rothAmount = roundToCents(alloc.roth);
    const summaryTotal = roundToCents(summaryMomAmount + netHysa + rothAmount);
    const residual = roundToCents(targetTotal - summaryTotal);

    // Keep displayed cents aligned so MOM + Gross HYSA + RothIRA equals Net Income.
    if (residual !== 0 && Math.abs(residual) <= 0.02) {
        netChecking = roundToCents(netChecking + residual);
        netHysa = roundToCents(netChecking + alloc.hysa);
    }

    const summaryNetIncome = roundToCents(totalNet - (alloc.gasBonus - gasDelta));

    const summaryRows = [
        { account: 'Net Income', category: '- gas', amount: summaryNetIncome },
        { account: 'MOM', category: 'Mom', amount: summaryMomAmount },
        { account: 'Net Checking', category: 'Spending budget', amount: netChecking },
        { account: 'Gross HYSA', category: 'Checking + HYSA', amount: netHysa },
        { account: 'RothIRA', category: 'Retirement', amount: rothAmount }
    ];

    summaryRows.forEach(item => {
        const row = document.createElement('div');
        row.className = 'budget-row';
        row.innerHTML = `
            <span>${item.account}</span>
            <span>${item.category}</span>
            <span class="entry-amount">${formatCurrency(item.amount)}</span>
        `;
        summaryTable.appendChild(row);
    });

    summaryDiv.appendChild(summaryTable);
    wrapper.appendChild(summaryDiv);

    return wrapper;
}
