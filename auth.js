import {
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    signInWithPopup
} from 'firebase/auth';

function addAuthStyles() {
    if (document.getElementById('firebase-auth-styles')) return;

    const style = document.createElement('style');
    style.id = 'firebase-auth-styles';
    style.textContent = `
        .firebase-auth-gate { position: fixed; z-index: 1001; top: 50%; left: 50%; width: min(460px, calc(100vw - 32px)); margin: 0; padding: 32px; transform: translate(-50%, -50%); text-align: center; border-radius: 12px; background: #fff; box-shadow: 0 6px 24px rgba(0,0,0,.12); color: #1f2937; }
        .firebase-auth-gate h1 { margin: 0 0 12px; font-size: 1.6rem; }
        .firebase-auth-gate p { margin: 0 0 20px; line-height: 1.5; }
        .firebase-auth-button { border: 0; border-radius: 7px; padding: 11px 18px; font: inherit; cursor: pointer; background: #2563eb; color: #fff; }
        .firebase-auth-button:disabled { opacity: .65; cursor: wait; }
        .firebase-auth-error { min-height: 1.3em; margin-top: 14px !important; color: #b91c1c; }
        .firebase-user-menu { margin-left: 24px; display: flex; align-items: center; gap: 10px; color: inherit; }
        .firebase-user-menu a { border: 1px solid currentColor; border-radius: 5px; color: inherit; padding: 6px 10px; font: inherit; text-decoration: none; }
        .firebase-user-menu a:hover { background: rgba(14, 28, 103, 0.08); }
        .firebase-signed-out .max-content,
        .firebase-signed-out .subscriptions-container,
        .firebase-signed-out .main,
        .firebase-signed-out #app,
        .firebase-signed-out #history-app { display: none !important; }
        @media (max-width: 600px) { .firebase-user-menu span { display: none; } }
    `;
    document.head.appendChild(style);
}

function showSignIn(auth) {
    addAuthStyles();
    if (document.querySelector('.firebase-auth-gate')) return;

    const gate = document.createElement('section');
    gate.className = 'firebase-auth-gate';
    gate.innerHTML = `
        <h1>Sign in to Income Tracker</h1>
        <p>Use the Google account authorized for this tracker to view or change your financial data.</p>
        <button type="button" class="firebase-auth-button">Sign in with Google</button>
        <p class="firebase-auth-error" role="alert"></p>
    `;

    const button = gate.querySelector('button');
    const error = gate.querySelector('.firebase-auth-error');
    button.addEventListener('click', async () => {
        button.disabled = true;
        error.textContent = '';
        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
        } catch (err) {
            console.error('Firebase sign-in failed:', err);
            error.textContent = 'Sign-in could not be completed. Please try again.';
        } finally {
            button.disabled = false;
        }
    });

    document.body.appendChild(gate);
}

function showUserMenu(auth, user) {
    addAuthStyles();
    let menu = document.querySelector('.firebase-user-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.className = 'firebase-user-menu';
        const navContainer = document.querySelector('.navbar__container');
        (navContainer || document.body).appendChild(menu);
    }
    menu.innerHTML = '<a href="profile.html" aria-label="Open profile">Profile</a>';
}

/**
 * Defers all Firestore work until Firebase has restored an authenticated user.
 */
export function requireSignIn(app, onSignedIn) {
    const auth = getAuth(app);
    let loadedUid = null;

    // Render an actionable state immediately. Firebase may take a moment to
    // restore persisted authentication, and leaving the page empty during
    // that wait makes a working app look broken.
    showSignIn(auth);

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            loadedUid = null;
            document.body.classList.add('firebase-signed-out');
            document.querySelector('.firebase-user-menu')?.remove();
            showSignIn(auth);
            return;
        }

        document.body.classList.remove('firebase-signed-out');
        document.querySelector('.firebase-auth-gate')?.remove();
        showUserMenu(auth, user);
        if (loadedUid === user.uid) return;
        loadedUid = user.uid;

        try {
            await onSignedIn(user);
        } catch (err) {
            console.error('Firestore access failed:', err);
            alert('This Google account is signed in, but it is not authorized to access this tracker. Confirm that its Firebase Auth UID matches the UID in your Firestore rule.');
        }
    });
}
