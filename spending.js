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

let spentEntries = [];

document.addEventListener('DOMContentLoaded', initSpending);

async function initSpending() {
    const main = document.querySelector('.main');
    if (!main) return;

    main.innerHTML = '';
    main.classList.add('spending-shell');

    const controls = document.createElement('div');
    controls.className = 'spending-controls';
    controls.innerHTML = `
        <div>
            <h1>Spending</h1>
            <p class="subtext">Filter by month, search by description, and see totals at a glance.</p>
        </div>
        <div class="spending-filters">
            <select id="monthFilter">
                <option value="all">All months</option>
            </select>
            <input type="search" id="spendSearch" placeholder="Search description or date">
        </div>
    `;
    main.appendChild(controls);

    const list = document.createElement('div');
    list.id = 'spendingList';
    list.className = 'spending-list';
    main.appendChild(list);

    spentEntries = await loadSpent();
    populateMonthFilter(spentEntries);
    renderSpending(spentEntries, 'all', '');

    const monthSelect = document.getElementById('monthFilter');
    const searchInput = document.getElementById('spendSearch');

    if (monthSelect) {
        monthSelect.addEventListener('change', () => {
            renderSpending(spentEntries, monthSelect.value, searchInput ? searchInput.value : '');
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderSpending(spentEntries, monthSelect ? monthSelect.value : 'all', searchInput.value);
        });
    }
}

async function loadSpent() {
    const snap = await getDocs(collection(db, 'spentHistory'));
    return snap.docs.map(doc => {
        const data = doc.data();
        const dateObj = parseDate(data.date);
        const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
        return {
            id: doc.id,
            ref: doc.ref,
            ...data,
            dateObj,
            monthKey
        };
    });
}

function parseDate(dateStr) {
    const [m, d, y] = dateStr.split('/').map(Number);
    return new Date(y, m - 1, d);
}

function monthLabel(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function populateMonthFilter(entries) {
    const select = document.getElementById('monthFilter');
    if (!select) return;
    const months = Array.from(new Set(entries.map(e => e.monthKey))).sort((a, b) => new Date(b) - new Date(a));
    months.forEach(key => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = monthLabel(key);
        select.appendChild(opt);
    });
}

function renderSpending(entries, monthFilter, searchTerm) {
    const list = document.getElementById('spendingList');
    if (!list) return;
    list.innerHTML = '';

    const filtered = entries.filter(e => {
        const matchesMonth = monthFilter === 'all' || e.monthKey === monthFilter;
        const term = searchTerm.trim().toLowerCase();
        const matchesSearch = !term || `${e.description || ''} ${e.date}`.toLowerCase().includes(term);
        return matchesMonth && matchesSearch;
    });

    const grouped = filtered.reduce((acc, entry) => {
        if (!acc[entry.monthKey]) acc[entry.monthKey] = [];
        acc[entry.monthKey].push(entry);
        return acc;
    }, {});

    const monthKeys = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

    if (!monthKeys.length) {
        list.innerHTML = '<p class="helper-text">No spending matches your filters.</p>';
        return;
    }

    monthKeys.forEach(key => {
        const monthEntries = grouped[key].sort((a, b) => b.dateObj - a.dateObj);
        const total = monthEntries.reduce((sum, e) => sum + (e.amount || 0), 0);

        const panel = document.createElement('div');
        panel.className = 'spend-panel';

        const header = document.createElement('div');
        header.className = 'spend-header';
        header.innerHTML = `
            <div>
                <h3>${monthLabel(key)}</h3>
                <p class="subtext">Total spent: $${total.toFixed(2)}</p>
            </div>
        `;
        panel.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'spend-grid';

        monthEntries.forEach(entry => {
            const card = document.createElement('div');
            card.className = 'spend-card';
            card.innerHTML = `
                <p class="spend-desc">${capitalize(entry.description || 'Spending')}</p>
                <p class="spend-amount">-$${(entry.amount || 0).toFixed(2)}</p>
                <p class="spend-date">${entry.date}</p>
            `;
            grid.appendChild(card);
        });

        panel.appendChild(grid);
        list.appendChild(panel);
    });
}

function capitalize(text) {
    return text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

