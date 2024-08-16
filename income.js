import { initializeApp } from "https://www.gstatic.com/firebasejs/9.12.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, query, where, deleteDoc } from "https://www.gstatic.com/firebasejs/9.12.1/firebase-firestore.js";


const firebaseConfig = {
    APIKEY: process.env.APIKEY,
    APPID: process.env.APPID,
    AUTHDOMAIN: process.env.AUTHDOMAIN,
    DATABSEURL: process.env.DATABSEURL,
    MEASUREMENTID: process.env.MEASUREMENTID,
    MESSAGINGSENDERID: process.env.MESSAGINGSENDERID,
    PROJECTID: process.env.PROJECTID,
    STORAGEBUCKET: process.env.STORAGEBUCKET
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
    const dateInput = document.getElementById('date').value;

    // Parse the input date string into a Date object
    const [year, month, day] = dateInput.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day); // Month is 0-indexed

    // Format the date to "month/day/year"
    const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
    //console.log(formattedDate);

    await addDoc(collection(db, "incomeData"), {
        job: job,
        amount: parseFloat(amount),
        date: formattedDate
    });

    setTimeout(function(){
        location.reload();
    }, 1000);
}

async function deleteData() {
    const job = document.getElementById('job').value;
    const amount = document.getElementById('amount').value;
    const date = document.getElementById('date').value;
    // Parse the input date string into a Date object
    const [year, month, day] = date.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day); // Month is 0-indexed

    // Format the date to "month/day/year"
    const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
    //console.log(formattedDate);

    if (!job || !date || !amount) {
        alert('Please fill out job, date, and amount fields');
        return;
    }

    // Query the Firestore collection to find the matching document
    const q = query(
        collection(db, "incomeData"),
        where('job', '==', job),
        where('date', '==', formattedDate),
        where('amount', '==', parseFloat(amount))
    );
    const snapshot = await getDocs(q);

    // If a matching document is found, delete it
    if (!snapshot.empty) {
        snapshot.forEach(async (doc) => {
            await deleteDoc(doc.ref);
        });
        //console.log(formattedDate);
    } else {
        alert('No matching document found');
    }
    setTimeout(function(){
        location.reload();
    }, 1000);
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
    
    let spendingMoney = Math.max(70, 0.20 * total);
    let mom = 100;
    let newtotal = total - spendingMoney - mom;
    let hysa = 0.35 * newtotal;
    let ira = 0.25 * newtotal;
    let fidelity = 0.15 * newtotal;
    let totalallocated = spendingMoney + mom + hysa + ira + fidelity;
    let remaining = total - totalallocated;

    if (total < 170 && total > 50){
        mom = total-50;
        spendingMoney = total-mom;
        newtotal = 0;
        hysa = 0;
        ira = 0;
        fidelity = 0;
        totalallocated = 0;
        remaining = 0;
        
    }else if (total < 50){
        mom = 0;
        spendingMoney = total;
        newtotal = 0;
        hysa = 0;
        ira = 0;
        fidelity = 0;
        totalallocated = 0;
        remaining = 0;
    }

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
        const dateParts = item.date.split('/');
        const date = new Date(dateParts[2], dateParts[0] - 1, dateParts[1]);
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
        entryDiv.style.marginBottom = '30px';
        section.appendChild(entryDiv);
    });

    entriesOutput.appendChild(section);
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
        const dateParts = curr.date.split('/');
        const date = new Date(dateParts[2], dateParts[0] - 1, dateParts[1]);
        const monthYear = `${date.getMonth() + 1}/${date.getFullYear()}`;

        if (!acc[monthYear]) {
            acc[monthYear] = { total: 0, entries: [] };
        }

        acc[monthYear].total += curr.amount;
        acc[monthYear].entries.push(curr);

        return acc;
    }, {});

    // Sort the organized history data by date in descending order
    const sortedHistoryData = Object.keys(organizedHistoryData).sort((a, b) => {
        const [monthA, yearA] = a.split('/').map(Number);
        const [monthB, yearB] = b.split('/').map(Number);
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



