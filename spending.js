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


async function Spent(){
    // Retrieve all data from Firestore
    const snapshot = await getDocs(collection(db, 'spentHistory'));
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


    const containerDiv = document.querySelector('.container');
    
    
    // Add history and entries data to content divs
    sortedHistoryData.forEach(({ monthYear, total, entries }) => {
        const content = document.createElement('div');
        content.className = "content";
        containerDiv.appendChild(content);

        content.innerHTML = `
            <p id="monthyear">${monthYear}</p>
            <p id="total">Total spent: -$${total}</p>
        `

        const entryContainer = document.createElement('div');
        entryContainer.className = 'entryContainer';
        containerDiv.appendChild(entryContainer);

        // Sort entries by date (ascending)
        const sortedEntries = entries.sort((a, b) => {
            const [monthA, dayA, yearA] = a.date.split('/').map(Number);
            const [monthB, dayB, yearB] = b.date.split('/').map(Number);
            return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
        });


        sortedEntries.forEach(entry =>{
            const entryDiv = document.createElement('div');
            
            entryDiv.innerHTML = `
                <p id="entriesSpent">Spent: -$${entry.amount.toFixed(2)}</p>
                <p id="entriesDate">Date: ${entry.date}</p>
            `
            entryDiv.className = "entriesDiv";
            entryContainer.appendChild(entryDiv);
        });
    });

}


document.addEventListener("DOMContentLoaded", Spent);


