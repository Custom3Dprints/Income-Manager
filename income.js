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

function formatCurrency(value) {
    if (isNaN(value) || !isFinite(value)) return '$0.00';
    return `$${value.toFixed(2)}`;
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

    // Parse the input date string into a Date object
    const [year, month, day] = dateInput.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day); // Month is 0-indexed

    // Format the date to "month/day/year"
    const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
    //console.log(formattedDate);

    // Get the value from the new text box for "Spent"
    const spentDescription = job === "Spent" ? document.getElementById('spentDescription').value.trim() : null;

    if (job == "W2" || job == "Interest Payment" || job == "Gift" || job == "Other" || job == "Tutoring"){
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
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const snapshot = await getDocs(collection(db, 'incomeData'));
    const data = snapshot.docs.map(doc => doc.data());

    const filteredData = data.filter(item => {
        const date = new Date(item.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear && item.job !== "Spent";
    });

    // Entries are already net income; no additional tax adjustment
    const netIncome = filteredData.reduce((acc, curr) => acc + curr.amount, 0);

    const allocations = [
        { label: 'Total Net Income', percent: '-', amount: netIncome },
        { label: 'AMEX Checking', percent: '23%', amount: netIncome * 0.23 },
        { label: 'AMEX HYSA', percent: '40%', amount: netIncome * 0.40 },
        { label: 'Roth IRA', percent: '27%', amount: netIncome * 0.27 },
        { label: 'Webull', percent: '10%', amount: netIncome * 0.10 }
    ];

    const table = document.createElement('div');
    table.className = 'budget-table';

    const header = document.createElement('div');
    header.className = 'budget-row budget-header';
    header.innerHTML = `<span>Category</span><span>%</span><span>Amount</span>`;
    table.appendChild(header);

    allocations.forEach(item => {
        const row = document.createElement('div');
        row.className = 'budget-row';
        row.innerHTML = `
            <span>${item.label}</span>
            <span>${item.percent}</span>
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

    const spentData = spentSnap.docs.map(doc => ({
        id: doc.id,
        ref: doc.ref,
        type: 'Spent',
        ...doc.data()
    }));

    const filteredData = [...incomeData, ...spentData].filter(item => {
        const dateParts = item.date.split('/');
        const date = new Date(dateParts[2], dateParts[0] - 1, dateParts[1]);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
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
        header.innerHTML = `<strong>${entry.job}</strong> <span class="entry-amount ${entry.type === 'Spent' ? 'neg' : 'pos'}">${entry.type === 'Spent' ? '-' : ''}$${entry.amount.toFixed(2)}</span>`;

        const dateEl = document.createElement('p');
        dateEl.textContent = `Date: ${entry.date}`;

        content.appendChild(header);
        content.appendChild(dateEl);

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
