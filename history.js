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
    renderHistory(allEntries, '');

    const searchInput = document.getElementById('historySearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderHistory(allEntries, e.target.value);
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

    const spentData = spentSnap.docs.map(doc => ({
        id: doc.id,
        type: 'Spent',
        ...doc.data()
    }));

    return [...incomeData, ...spentData].map(item => ({
        ...item,
        dateObj: parseDate(item.date)
    }));
}

function parseDate(dateStr) {
    const [m, d, y] = dateStr.split('/').map(Number);
    return new Date(y, m - 1, d);
}

function formatMonth(dateObj) {
    return dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function renderHistory(entries, searchTerm) {
    const list = document.getElementById('historyList');
    if (!list) return;
    list.innerHTML = '';

    const current = new Date();
    const currentMonth = current.getMonth();
    const currentYear = current.getFullYear();

    const filtered = entries.filter(e => {
        const term = searchTerm.trim().toLowerCase();
        const matchesTerm = !term || `${e.job} ${e.description || ''} ${e.date}`.toLowerCase().includes(term);
        const isCurrentMonth = e.dateObj.getMonth() === currentMonth && e.dateObj.getFullYear() === currentYear;
        return matchesTerm && !isCurrentMonth;
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
        const incomeTotal = monthEntries.filter(e => e.type === 'Income').reduce((sum, e) => sum + (e.amount || 0), 0);
        const spentTotal = monthEntries.filter(e => e.type === 'Spent').reduce((sum, e) => sum + (e.amount || 0), 0);
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

        monthEntries.forEach(entry => {
            const row = document.createElement('div');
            row.className = 'history-entry';
            const badgeClass = entry.type === 'Spent' ? 'badge spent' : 'badge income';
            const amountSign = entry.type === 'Spent' ? '-' : '+';

            row.innerHTML = `
                <div class="history-entry__top">
                    <span class="${badgeClass}">${entry.job}</span>
                    <span class="history-amount ${entry.type === 'Spent' ? 'neg' : 'pos'}">${amountSign}$${Math.abs(entry.amount || 0).toFixed(2)}</span>
                </div>
                <p class="history-date">${entry.date}</p>
                ${entry.description ? `<p class="history-note">${entry.description}</p>` : ''}
            `;

            entryList.appendChild(row);
        });

        details.appendChild(entryList);
        list.appendChild(details);
    });
}
