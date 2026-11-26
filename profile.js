import { initializeApp } from 'firebase/app';
import { getAuth, signOut } from 'firebase/auth';
import { requireSignIn } from './auth';

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

function renderProfile(user) {
    const container = document.getElementById('profile-app');
    if (!container) return;

    container.innerHTML = `
        <section class="profile-card">
            <p class="profile-eyebrow">Account</p>
            <h1>Profile</h1>
            <p class="profile-email">${user.email || 'Signed in account'}</p>
            <button type="button" id="profileSignOut" class="profile-signout">Sign out</button>
        </section>
    `;

    document.getElementById('profileSignOut').addEventListener('click', async () => {
        document.body.classList.add('firebase-signed-out');
        await signOut(getAuth(app));
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => requireSignIn(app, renderProfile), { once: true });
} else {
    requireSignIn(app, renderProfile);
}
