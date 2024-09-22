import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, query, where, deleteDoc } from 'firebase/firestore';


const firebaseConfig = {
    apiKey: process.env.apiKey ,
    authDomain: process.env.authDomain ,
    databaseURL: process.env.databaseURL ,
    projectId: process.env.projectId ,
    storageBucket: process.env.storageBucket ,
    messagingSenderId: process.env.messagingSenderId ,
    appId: process.env.appId ,
    measurementId: process.env.measurementId 
};



// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
const db = getFirestore(app);

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
            <p>Checkings: $${remaining.toFixed(2)}</p>
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
document.addEventListener('DOMContentLoaded', showFullHistory);