



import { initializeApp } from "https://www.gstatic.com/firebasejs/9.12.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/9.12.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDlGWR_yUnBhiPgxl7Tf3af8lUp2S4cOow",
    authDomain: "finance-925e7.firebaseapp.com",
    databaseURL: "https://finance-925e7-default-rtdb.firebaseio.com",
    projectId: "finance-925e7",
    storageBucket: "finance-925e7.appspot.com",
    messagingSenderId: "1045461884935",
    appId: "1:1045461884935:web:280cdbfa1eb28a272c0aa2",
    measurementId: "G-NQNYE0ZM1C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

document.getElementById('submitBtn').addEventListener('click', submitData);
document.getElementById('deleteBtn').addEventListener('click', deleteData);
document.getElementById('showHistoryBtn').addEventListener('click', showFullHistory);

async function submitData() {
    const job = document.getElementById('job').value;
    const amount = document.getElementById('amount').value;
    const date = document.getElementById('date').value;

    if (job && amount && date) {
        await addDoc(collection(db, "incomeData"), {
            job: job,
            amount: parseFloat(amount),
            date: date
        });
    } else {
        alert('Please fill out all fields');
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
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const total = filteredData.reduce((acc, curr) => acc + curr.amount, 0);

    const spendingMoney = Math.max(70, 0.20 * total);
    const mom = 100;
    const newtotal = total - spendingMoney - mom;
    const hysa = 0.35 * newtotal;
    const ira = 0.25 * newtotal;
    const fidelity = 0.15 * newtotal;
    const totalallocated = spendingMoney + mom + hysa + ira + fidelity;
    const remaining = total - totalallocated;

    const section = document.createElement('div');
    section.innerHTML = `
        <p>Total Income: $${total.toFixed(2)}</p>
        <p>Spending: $${spendingMoney.toFixed(2)}</p>
        <p>Mom: $${mom.toFixed(2)}</p>
        <p>HYSA: $${hysa.toFixed(2)}</p>
        <p>IRA: $${ira.toFixed(2)}</p>
        <p>Fidelity: $${fidelity.toFixed(2)}</p>
        <p>Remaining: $${remaining.toFixed(2)}</p>
    `;
    section.style.marginBottom = '30px';
    budgetOutput.appendChild(section);
}

async function showCurrentEntries() {
    const entriesOutput = document.getElementById('entriesOutput');
    entriesOutput.innerHTML = '<h2>Entries</h2>';

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const snapshot = await getDocs(collection(db, 'incomeData'));
    const data = snapshot.docs.map(doc => doc.data());

    const filteredData = data.filter(item => {
        const date = new Date(item.date);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const section = document.createElement('div');
    filteredData.forEach(entry => {
        const entryDiv = document.createElement('div');
        entryDiv.innerHTML = `
            <p>Job: ${entry.job}</p>
            <p>Amount: $${entry.amount.toFixed(2)}</p>
            <p>Date: ${entry.date}</p>
        `;
        entryDiv.style.marginBottom = '35px';
        section.appendChild(entryDiv);
    });

    entriesOutput.appendChild(section);
}

async function deleteData() {
    const job = document.getElementById('job').value;
    const date = document.getElementById('date').value;
    const amount = document.getElementById('amount').value;

    if (!job || !date || !amount) {
        alert('Please fill out job, date, and amount fields');
        return;
    }

    const q = query(collection(db, "incomeData"), where('job', '==', job), where('date', '==', date), where('amount', '==', parseFloat(amount)));
    const snapshot = await getDocs(q);

    snapshot.forEach(async (doc) => {
        await deleteDoc(doc.ref);
    });
}


//
async function showFullHistory() {
    const mainDiv = document.querySelector('.main');
    mainDiv.innerHTML = ''; // Clear any existing content

    // Create a new div element for the title
    const title = document.createElement('div');
    title.className = "title";
    mainDiv.appendChild(title);

    const titleleft = document.createElement('div');
    titleleft.className = "titleleft";
    title.appendChild(titleleft);
    titleleft.innerHTML = `<h1>History</h1>`;

    const titleright = document.createElement('div');
    titleright.className = "titleright";
    title.appendChild(titleright);
    titleright.innerHTML = `<h1>Entries</h1>`;

    // Retrieve all data from Firestore
    const snapshot = await getDocs(collection(db, 'incomeData'));
    const data = snapshot.docs.map(doc => doc.data());

    // Organize data by month-year for history
    const organizedHistoryData = data.reduce((acc, curr) => {
        const date = new Date(curr.date);
        const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;

        if (!acc[monthYear]) {
            acc[monthYear] = { total: 0, entries: [] };
        }

        acc[monthYear].total += curr.amount;
        acc[monthYear].entries.push(curr);

        return acc;
    }, {});

    // Sort the organized history data by date in descending order
    const sortedHistoryData = Object.keys(organizedHistoryData).sort((a, b) => {
        const [monthA, yearA] = a.split('-').map(Number);
        const [monthB, yearB] = b.split('-').map(Number);
        return new Date(yearB, monthB - 1) - new Date(yearA, monthA - 1);
    }).map(key => ({ monthYear: key, ...organizedHistoryData[key] }));

    // Add history and entries data to content divs
    sortedHistoryData.forEach(({ monthYear, total, entries }) => {
        const border = document.createElement('div');
        border.className = 'border';
        mainDiv.appendChild(border);

        const content = document.createElement('div');
        content.className = 'content';
        border.appendChild(content);

        const left = document.createElement('div');
        left.className = 'left';
        content.appendChild(left);

        const spendingMoney = Math.max(70, 0.20 * total);
        const mom = 100;
        const newtotal = total - spendingMoney - mom;
        const hysa = 0.35 * newtotal;
        const ira = 0.25 * newtotal;
        const fidelity = 0.15 * newtotal;
        const totalallocated = spendingMoney + mom + hysa + ira + fidelity;
        const remaining = total - totalallocated;

        left.innerHTML = `
            <h3>${monthYear}</h3>
            <p>Total Income: $${total.toFixed(2)}</p>
            <p>Spending: $${spendingMoney.toFixed(2)}</p>
            <p>Mom: $${mom.toFixed(2)}</p>
            <p>HYSA: $${hysa.toFixed(2)}</p>
            <p>IRA: $${ira.toFixed(2)}</p>
            <p>Fidelity: $${fidelity.toFixed(2)}</p>
            <p>Remaining: $${remaining.toFixed(2)}</p>
        `;

        const right = document.createElement('div');
        right.className = 'right';
        content.appendChild(right);


        entries.forEach(entry => {
            const entryDiv = document.createElement('div');

            entryDiv.innerHTML = `
                <p>Job: ${entry.job}</p>
                <p>Amount: $${entry.amount.toFixed(2)}</p>
                <p>Date: ${entry.date}</p>
            `;
            entryDiv.style.marginBottom = '30px';
            right.appendChild(entryDiv);
        });
    });
}

















window.submitData = submitData;
window.showMonthlyBudget = showMonthlyBudget;
window.deleteData = deleteData;
window.showCurrentEntries = showCurrentEntries;
window.showFullHistory = showFullHistory;

document.addEventListener('DOMContentLoaded', showMonthlyBudget);
document.addEventListener('DOMContentLoaded', showCurrentEntries);






