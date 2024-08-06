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
document.getElementById('historyBtn').addEventListener('click', showHistory);
document.getElementById('deleteBtn').addEventListener('click', deleteData);

async function submitData() {
    const job = document.getElementById('job').value;
    const amount = document.getElementById('amount').value;
    const date = document.getElementById('date').value;

    if (job && amount && date) {
        await addDoc(collection(db, "incomeData"),{
            job: job,
            amount: parseFloat(amount),
            date: date
        });
    } else {
        alert('Please fill out all fields');
    }
}

async function showHistory() {
    const historyOutput = document.getElementById('historyOutput');
    historyOutput.innerHTML = '<h2>History</h2>';
    
    const snapshot = await getDocs(collection(db, 'incomeData'));
    const data = snapshot.docs.map(doc => doc.data());
    
    const organizedData = data.reduce((acc, curr) => {
        const date = new Date(curr.date);
        const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;
        
        if (!acc[monthYear]) {
            acc[monthYear] = { total: 0, entries: [] };
        }
        
        acc[monthYear].total += curr.amount;
        acc[monthYear].entries.push(curr);
        
        return acc;
    }, {});

    for (const [monthYear, { total, entries }] of Object.entries(organizedData)) {
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
            <h3>${monthYear}</h3>
            <p>Total Income: $${total.toFixed(2)}</p>
            <p>Spending: $${spendingMoney.toFixed(2)}</p>
            <p>Mom: $${mom.toFixed(2)}</p>
            <p>HYSA: $${hysa.toFixed(2)}</p>
            <p>IRA: $${ira.toFixed(2)}</p>
            <p>Fidelity: $${fidelity.toFixed(2)}</p>
            <p>Remaining: $${remaining.toFixed(2)}</p>
        `;
        section.style.marginBottom = '30px'; // Adjust the margin as needed
        historyOutput.appendChild(section);
    }
}

async function showEntries() {
    const entriesOutput = document.getElementById('entriesOutput');
    entriesOutput.innerHTML = '<h2>Entries</h2>';

    const snapshot = await getDocs(collection(db, 'incomeData'));
    const data = snapshot.docs.map(doc => doc.data());

    const organizedData = data.reduce((acc, curr) => {
        const date = new Date(curr.date);
        const monthYear = `${date.getMonth() + 1}-${date.getFullYear()}`;

        if (!acc[monthYear]) {
            acc[monthYear] = [];
        }

        acc[monthYear].push(curr);

        return acc;
    }, {});

    for (const [monthYear, entries] of Object.entries(organizedData)) {
        const section = document.createElement('div');
        section.innerHTML = `<h3>${monthYear}</h3>`;
        
        entries.forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.innerHTML = `
                <p>Job: ${entry.job}</p>
                <p>Amount: $${entry.amount.toFixed(2)}</p>
                <p>Date: ${entry.date}</p>
            `;
            entryDiv.style.marginBottom = '35px'; // Adjust the margin as needed
            section.appendChild(entryDiv);
        });

        entriesOutput.appendChild(section);
    }
}

async function deleteData() {
    const job = document.getElementById('job').value;
    const date = document.getElementById('date').value;
    const amount = document.getElementById('amount').value;

    if (!job || !date || !amount) {
        alert('Please fill out job and date fields');
        return;
    }   
    
    const q = query(collection(db, "incomeData"), where('job', '==', job), where('date', '==', date), where('amount', '==', parseFloat(amount)));
    const snapshot = await getDocs(q);
    
    snapshot.forEach(async (doc) => {
        await deleteDoc(doc.ref);
    });
}

window.submitData = submitData;
window.showHistory = showHistory;
window.deleteData = deleteData;
window.showEntries = showEntries;

document.addEventListener('DOMContentLoaded', showHistory);
document.addEventListener('DOMContentLoaded', showEntries);






