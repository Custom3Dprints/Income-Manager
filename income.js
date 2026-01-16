import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, deleteDoc } from 'firebase/firestore';

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


// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

const TAX_RATE = 0.0816;
const GAS_BONUS_GROSS = 100;
const GAS_BONUS_NET = Number((GAS_BONUS_GROSS * (1 - TAX_RATE)).toFixed(2));

function parseEntryDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/').map(Number);
    if (parts.length !== 3) return null;
    return new Date(parts[2], parts[0] - 1, parts[1]);
}

function isSameMonthYear(date, month, year) {
    return date && date.getMonth() === month && date.getFullYear() === year;
}

function formatCurrency(value) {
    if (isNaN(value) || !isFinite(value)) return '$0.00';
    const sign = value < 0 ? '-' : '';
    return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function detectGasCategory(description = '', existingCategory = '') {
    const desc = description.toLowerCase();
    if (existingCategory && existingCategory.toLowerCase() === 'gas') return 'Gas';
    if (desc.includes('gas')) return 'Gas';
    return 'Other';
}

document.getElementById('submitBtn').addEventListener('click', submitData);
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');

if (deleteSelectedBtn) {
    deleteSelectedBtn.addEventListener('click', deleteSelectedEntries);
}

//document.getElementById('showHistoryBtn').addEventListener('click', showFullHistory);

let monthEntries = [];

async function submitData() {
    const job = document.getElementById('job').value;
    const amount = document.getElementById('amount').value;
    const dateInput = document.getElementById('date').value;

    if (!amount || !dateInput) {
        alert('Please add an amount and date.');
        return;
    }

    // Parse the input date string into a Date object
    const [year, month, day] = dateInput.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day); // Month is 0-indexed

    // Format the date to "month/day/year"
    const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;

    // Get the value from the new text box for "Spent"
    const spentDescription = job === "Spent" ? document.getElementById('spentDescription').value.trim() : null;
    const spentCategory = job === "Spent" ? detectGasCategory(spentDescription) : 'Other';

    if (job == "WTDC" || job == "Interest Payment" || job == "Gift" || job == "Other" || job == "Tutoring"){
        await addDoc(collection(db, "incomeData"), {
            job: job,
            amount: parseFloat(amount),
            date: formattedDate
        });
    
        setTimeout(function(){
            location.reload();
        }, 800);
        
    }else if (job == "Spent"){
        await addDoc(collection(db, "spentHistory"),{
            job: job,
            description: spentDescription,
            category: spentCategory,
            amount: parseFloat(amount),
            date: formattedDate
        });

        setTimeout(function(){
            location.reload();
        }, 800);

    }else{
        alert("Submitdata function in income.js not working!");
    }
}

async function showMonthlyBudget() {
    const budgetOutput = document.getElementById('budgetOutput');
    budgetOutput.innerHTML = '<h2>Monthly Budget</h2>';
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let [incomeSnap, spentSnap] = await Promise.all([
        getDocs(collection(db, 'incomeData')),
        getDocs(collection(db, 'spentHistory'))
    ]);

    let incomeData = incomeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const addedGasBonus = await ensureGasBonus(incomeData, currentMonth, currentYear);

    if (addedGasBonus) {
        incomeSnap = await getDocs(collection(db, 'incomeData'));
        incomeData = incomeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Refresh entries so the bonus shows up there as well.
        showCurrentEntries();
    }

    const spentData = spentSnap.docs.map(doc => doc.data());

    const monthlyIncome = incomeData.filter(item => {
        const date = parseEntryDate(item.date);
        return isSameMonthYear(date, currentMonth, currentYear) && item.job !== "Spent";
    });

    const baseIncome = monthlyIncome.filter(item => item.job !== 'GasBonus');
    const gasBonusEntries = monthlyIncome.filter(item => item.job === 'GasBonus');

    const baseNet = baseIncome.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const gasBonusNet = gasBonusEntries.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    // Net Income is user-entered income (gas already factored into entries); gas bonus is shown separately
    const totalNet = baseNet;
    const gasSpent = spentData.reduce((acc, curr) => {
        const date = parseEntryDate(curr.date);
        const category = detectGasCategory(curr.description, curr.category);
        if (isSameMonthYear(date, currentMonth, currentYear) && category === 'Gas') {
            return acc + (Number(curr.amount) || 0);
        }
        return acc;
    }, 0);

    const gasRemaining = Math.max(gasBonusNet - gasSpent, 0);
    const gasOverspend = Math.max(gasSpent - gasBonusNet, 0);

    const CHECKINGS_TARGET = 0.20;
    const HYSA_TARGET = 0.40;
    const MOM_TARGET = 0.11;

    function computeAllocations(total) {
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

        // Use fixed gas bonus amount (or stored), capped to total to avoid >100%
        const fixedGas = gasBonusNet || GAS_BONUS_NET;
        const gasBonusAmount = Math.min(fixedGas, total);
        const gasBonusPercent = total > 0 ? gasBonusAmount / total : 0;

        // Pool remaining after gas bonus
        let basePool = Math.max(total - gasBonusAmount, 0);

        // MOM minimum $100 if Net Income >= 200
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

        // Initial ratio split
        let checkingsAmount = remaining * (wCheck / wSum);
        let hysaAmount = remaining * (wHysa / wSum);
        let rothAmountBase = remaining * (wRoth / wSum);
        let rothAmount = rothAmountBase;

        // Cap checkings at 20% of total net, redistribute any excess to Roth
        const maxCheckings = total * 0.20;
        if (checkingsAmount > maxCheckings) {
            const excess = checkingsAmount - maxCheckings;
            checkingsAmount = maxCheckings;
            // Redistribute excess: 3/5 to HYSA (savings) and 2/5 to Roth
            const toHysa = excess * 0.6;
            const toRoth = excess * 0.4;
            hysaAmount += toHysa;
            rothAmount += toRoth;
        }

        // Ensure HYSA stays greater than Roth when possible
        if (hysaAmount <= rothAmount && (hysaAmount + rothAmount) > 0) {
            const diff = (rothAmount - hysaAmount) / 2;
            const shift = Math.min(diff + 0.01, rothAmount); // nudge HYSA above Roth
            rothAmount -= shift;
            checkingsAmount += 0; // unchanged
            // Apply shift to HYSA
            const newHysa = hysaAmount + shift;
            // keep non-negative
            const delta = newHysa - hysaAmount;
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

    const alloc = computeAllocations(totalNet);

    const allocations = [
        { account: 'Net Income', category: '-', percent: null, amount: totalNet },
        { account: 'Gas Bonus', category: 'Gas', percent: alloc.percents.gasBonus, amount: alloc.gasBonus },
        { account: 'Gas Remaining', category: gasOverspend ? 'Gas (overspend hits Checkings)' : 'Gas', percent: null, amount: gasOverspend ? -gasOverspend : gasRemaining },
        { account: 'MOM', category: 'Mom', amount: alloc.mom, percent: alloc.percents.mom },
        { account: 'AMEX Checkings', category: 'Spending', amount: alloc.checkings, percent: alloc.percents.checkings },
        { account: 'AMEX HYSA', category: 'Savings', amount: alloc.hysa, percent: alloc.percents.hysa },
        { account: 'RothIRA', category: 'Retirement', amount: alloc.roth, percent: alloc.percents.roth }
    ];

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

    budgetOutput.appendChild(table);
}

async function showCurrentEntries() {
    const entriesOutput = document.getElementById('entriesOutput');
    entriesOutput.innerHTML = '';

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const [incomeSnap, spentSnap] = await Promise.all([
        getDocs(collection(db, 'incomeData')),
        getDocs(collection(db, 'spentHistory'))
    ]);

    const incomeData = incomeSnap.docs.map(doc => ({
        id: doc.id,
        ref: doc.ref,
        type: 'Income',
        ...doc.data()
    }));

    const spentData = spentSnap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ref: doc.ref,
            type: 'Spent',
            ...data,
            category: detectGasCategory(data.description, data.category)
        };
    });

    const filteredData = [...incomeData, ...spentData].filter(item => {
        if (item.job === 'GasBonus') return false; // hide auto-added gas bonus from Entries
        const date = parseEntryDate(item.date);
        return isSameMonthYear(date, currentMonth, currentYear);
    });

    monthEntries = filteredData;

    renderEntries(monthEntries);
}

function renderEntries(entries) {
    const entriesOutput = document.getElementById('entriesOutput');
    if (!entriesOutput) return;

    entriesOutput.innerHTML = '';

    const sorted = [...entries].sort((a, b) => {
        const aParts = a.date.split('/');
        const bParts = b.date.split('/');
        const aDate = new Date(aParts[2], aParts[0] - 1, aParts[1]);
        const bDate = new Date(bParts[2], bParts[0] - 1, bParts[1]);
        return bDate - aDate;
    });

    if (!sorted.length) {
        entriesOutput.innerHTML = '<p class="helper-text">No entries yet.</p>';
        return;
    }

    sorted.forEach(entry => {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'entry-row';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'entry-checkbox';
        checkbox.value = entry.id;
        checkbox.setAttribute('aria-label', `Select ${entry.job} on ${entry.date}`);

        const content = document.createElement('div');
        content.className = 'entry-content';

        const header = document.createElement('div');
        header.className = 'entry-header';
        const amountValue = Number(entry.amount) || 0;
        const normalizedAmount = entry.type === 'Spent' ? -amountValue : amountValue;
        header.innerHTML = `<strong>${entry.job}</strong> <span class="entry-amount ${entry.type === 'Spent' ? 'neg' : 'pos'}">${formatCurrency(normalizedAmount)}</span>`;

        const dateEl = document.createElement('p');
        dateEl.textContent = `Date: ${entry.date}`;

        content.appendChild(header);
        content.appendChild(dateEl);

        if (entry.category) {
            const cat = document.createElement('p');
            cat.textContent = `Category: ${entry.category}`;
            content.appendChild(cat);
        }

        if (entry.description) {
            const desc = document.createElement('p');
            desc.textContent = `Note: ${entry.description}`;
            content.appendChild(desc);
        }

        entryDiv.appendChild(checkbox);
        entryDiv.appendChild(content);
        entriesOutput.appendChild(entryDiv);
    });
}

async function deleteSelectedEntries() {
    const checkboxes = Array.from(document.querySelectorAll('.entry-checkbox:checked'));
    if (!checkboxes.length) {
        alert('Select at least one entry to delete.');
        return;
    }

    if (!confirm(`Delete ${checkboxes.length} selected entr${checkboxes.length === 1 ? 'y' : 'ies'}?`)) {
        return;
    }

    if (!confirm('This cannot be undone. Confirm delete?')) {
        return;
    }

    const mapById = monthEntries.reduce((acc, entry) => {
        acc[entry.id] = entry;
        return acc;
    }, {});

    await Promise.all(
        checkboxes.map(box => {
            const entry = mapById[box.value];
            if (entry && entry.ref) {
                return deleteDoc(entry.ref);
            }
            return Promise.resolve();
        })
    );

    await showCurrentEntries();
    await showMonthlyBudget();
}

window.submitData = submitData;
window.showMonthlyBudget = showMonthlyBudget;
window.showCurrentEntries = showCurrentEntries;

document.addEventListener('DOMContentLoaded', showMonthlyBudget);
document.addEventListener('DOMContentLoaded', showCurrentEntries);

async function ensureGasBonus(incomeData, currentMonth, currentYear) {
    const now = new Date();
    if (now.getMonth() !== currentMonth || now.getFullYear() !== currentYear) return false;
    if (now.getDate() < 15) return false;

    const bonusExists = incomeData.some(item => {
        if (item.job !== 'GasBonus') return false;
        const date = parseEntryDate(item.date);
        return isSameMonthYear(date, currentMonth, currentYear);
    });

    if (bonusExists) return false;

    const netGasBonus = Number((GAS_BONUS_GROSS * (1 - TAX_RATE)).toFixed(2));
    const formattedDate = `${currentMonth + 1}/${now.getDate()}/${currentYear}`;

    await addDoc(collection(db, "incomeData"), {
        job: "GasBonus",
        amount: netGasBonus,
        grossAmount: GAS_BONUS_GROSS,
        taxRate: TAX_RATE,
        date: formattedDate,
        description: "Auto-added gas bonus (after tax)"
    });

    return true;
}
