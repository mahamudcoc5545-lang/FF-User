// ====================
// Firebase Config + Initialize (একসাথে)
// ====================
const firebaseConfig = {
    apiKey: "AIzaSyCN_MH6u2Bpo3bxfDC_dhC19U67LP8ZS_E",
    authDomain: "free-fire-22cac.firebaseapp.com",
    databaseURL: "https://free-fire-22cac-default-rtdb.firebaseio.com",
    projectId: "free-fire-22cac",
    storageBucket: "free-fire-22cac.firebasestorage.app",
    messagingSenderId: "554987602894",
    appId: "1:554987602894:web:51548645a15c0d1e8d619f",
    measurementId: "G-W2QYY1CQ8D"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ====================
// Global Variables
// ====================
let currentUser = null;
let isLoggedIn = false;
let tournaments = [];
let userTransactions = [];
let systemSettings = {};
let rememberMe = false;

// ====================
// Initialize (থিম + অন্য সব)
// ====================
document.addEventListener('DOMContentLoaded', function() {
    // থিম লোড
    const savedTheme = localStorage.getItem('theme');
    const themeIcon = document.getElementById('themeIcon');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if (themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
    } else {
        document.body.classList.remove('light-theme');
        if (themeIcon) themeIcon.classList.replace('fa-sun', 'fa-moon');
    }

    // বাকি initialization
    checkExistingLogin();
    loadSystemSettings();
    setupFirebaseListeners();
    initializePaymentMethods();
});

// ====================
// Theme Toggle
// ====================
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('themeIcon');
    if (body.classList.contains('light-theme')) {
        body.classList.remove('light-theme');
        themeIcon.classList.replace('fa-sun', 'fa-moon');
        localStorage.setItem('theme', 'dark');
    } else {
        body.classList.add('light-theme');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
        localStorage.setItem('theme', 'light');
    }
}

// ====================
// System Settings
// ====================
function loadSystemSettings() {
    database.ref('admin/settings').once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                systemSettings = snapshot.val();
                if (systemSettings.minWithdrawal && document.getElementById('minWithdrawalText')) {
                    document.getElementById('minWithdrawalText').textContent = `Minimum withdrawal: ৳${systemSettings.minWithdrawal}`;
                }
            } else {
                systemSettings = { minWithdrawal: 200 };
            }
        })
        .catch(() => {
            systemSettings = { minWithdrawal: 200 };
        });
}

// ====================
// Auto Login
// ====================
function checkExistingLogin() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            const userData = JSON.parse(savedUser);
            autoLogin(userData.username);
        } catch (e) {
            localStorage.removeItem('currentUser');
        }
    }
}

function autoLogin(username) {
    database.ref(`users/${username}`).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                currentUser = userData;
                currentUser.username = username;
                isLoggedIn = true;
                showUserDashboard();
                updateUserUI();
                showSuccess('Welcome back!');
            }
        })
        .catch(() => {
            localStorage.removeItem('currentUser');
        });
}

// ====================
// Firebase Listeners
// ====================
function setupFirebaseListeners() {
    // Notices
    database.ref('notices').on('value', (snapshot) => {
        if (snapshot.exists() && document.getElementById('noticeMarquee')) {
            let text = '';
            snapshot.forEach(child => {
                if (child.val().active) text += ' 📢 ' + child.val().message + ' | ';
            });
            if (text) document.getElementById('noticeMarquee').innerHTML = text;
        }
    });

    // Tournaments
    database.ref('tournaments').on('value', (snapshot) => {
        if (snapshot.exists()) {
            tournaments = [];
            snapshot.forEach(child => {
                const t = child.val();
                t.id = child.key;
                tournaments.push(t);
            });
            if (isLoggedIn) {
                displayTournaments();
                displayLiveTournament();
                displayUpcomingTournaments();
                displayActiveTournaments();
            }
        }
    });

    // User updates
    database.ref('users').on('value', (snapshot) => {
        if (snapshot.exists() && isLoggedIn && currentUser) {
            const userData = snapshot.val()[currentUser.username];
            if (userData) {
                currentUser.balance = userData.balance || 0;
                currentUser.name = userData.name || currentUser.username;
                currentUser.ffid = userData.ffid || '';
                updateUserUI();
            }
        }
    });
}

// ====================
// Payment Methods
// ====================
function initializePaymentMethods() {
    const recharge = document.getElementById('paymentMethod');
    const withdraw = document.getElementById('withdrawMethod');
    if (!recharge || !withdraw) return;
    ['bkash', 'nagad', 'rocket', 'upay'].forEach(m => {
        const opt1 = document.createElement('option');
        opt1.value = m;
        opt1.textContent = m.charAt(0).toUpperCase() + m.slice(1);
        recharge.appendChild(opt1);
        withdraw.appendChild(opt1.cloneNode(true));
    });
}

function showPaymentNumber() {
    const method = document.getElementById('paymentMethod').value;
    const info = document.getElementById('paymentNumberInfo');
    if (method && info) {
        document.getElementById('selectedMethodName').textContent = method.charAt(0).toUpperCase() + method.slice(1);
        document.getElementById('paymentNumber').textContent = '018XXXXXXXX';
        document.getElementById('paymentType').textContent = 'Personal';
        info.style.display = 'block';
    } else if (info) {
        info.style.display = 'none';
    }
}

// ====================
// Login & Register
// ====================
function userLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    rememberMe = document.getElementById('rememberMe').checked;

    if (!username || !password) return showError('Fill username and password');

    database.ref(`users/${username}`).once('value')
        .then(snapshot => {
            if (snapshot.exists() && snapshot.val().password === password) {
                currentUser = snapshot.val();
                currentUser.username = username;
                isLoggedIn = true;
                if (rememberMe) localStorage.setItem('currentUser', JSON.stringify({username}));
                showUserDashboard();
                updateUserUI();
                bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
                showSuccess('Login successful!');
            } else {
                showError('Invalid username or password');
            }
        })
        .catch(() => showError('Login failed'));
}

function registerUser() {
    const name = document.getElementById('regName').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const ffid = document.getElementById('regFFID').value.trim();

    if (!name || !username || !password || !ffid) return showError('Fill all fields');

    database.ref(`users/${username}`).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                showError('Username already exists');
            } else {
                const userData = {
                    name, password, ffid, balance: 100, kills: 0, wins: 0, matches: 0,
                    joinDate: new Date().toISOString(), transactions: {}, notifications: {}
                };
                database.ref(`users/${username}`).set(userData)
                    .then(() => {
                        currentUser = userData;
                        currentUser.username = username;
                        isLoggedIn = true;
                        localStorage.setItem('currentUser', JSON.stringify({username}));
                        showUserDashboard();
                        updateUserUI();
                        bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
                        showSuccess('Registered! +৳100 bonus');
                    })
                    .catch(() => showError('Registration failed'));
            }
        });
}

// ====================
// Dashboard & UI
// ====================
function showUserDashboard() {
    document.getElementById('guestView').classList.add('d-none');
    document.getElementById('userDashboard').classList.remove('d-none');
    document.getElementById('userBalanceCard').classList.remove('d-none');
    document.getElementById('loggedInUser').classList.remove('d-none');
    document.getElementById('loginBtn').classList.add('d-none');
    document.getElementById('floatingWithdrawBtn').classList.remove('d-none');
    showSection('home');
}

function updateUserUI() {
    if (!currentUser) return;
    document.getElementById('userBalance').textContent = currentUser.balance || 0;
    const card = document.getElementById('userProfileCard');
    if (card) {
        card.innerHTML = `
            <img src="https://cdn-icons-png.flaticon.com/512/3135/3135715.png" class="user-avatar mb-2">
            <h6>${currentUser.name || currentUser.username}</h6>
            <p class="small text-muted mb-2">FF ID: <span class="text-warning">${currentUser.ffid || 'N/A'}</span></p>
            <div class="d-flex justify-content-around">
                <div><small class="text-warning">Balance</small><p class="mb-0 text-success">৳${currentUser.balance || 0}</p></div>
                <div><small class="text-danger">Kills</small><p class="mb-0">${currentUser.kills || 0}</p></div>
                <div><small class="text-success">Wins</small><p class="mb-0">${currentUser.wins || 0}</p></div>
            </div>
        `;
    }
}

// ====================
// Withdraw & Recharge (সিম্পল ভার্সন)
// ====================
function showWithdrawModal() {
    if (!isLoggedIn) return showError('Login first');
    const modal = new bootstrap.Modal(document.getElementById('withdrawModal'));
    modal.show();
}

function submitWithdrawRequest() {
    if (!isLoggedIn) return showError('Login first');
    showSuccess('Withdrawal request submitted (demo)');
    bootstrap.Modal.getInstance(document.getElementById('withdrawModal')).hide();
}

function submitRechargeRequest() {
    if (!isLoggedIn) return showError('Login first');
    showSuccess('Recharge request submitted (demo)');
    bootstrap.Modal.getInstance(document.getElementById('rechargeModal')).hide();
}

// ====================
// Section Show
// ====================
function showSection(section) {
    document.querySelectorAll('#mainContent > section').forEach(s => s.classList.add('d-none'));
    document.getElementById(section + 'Section').classList.remove('d-none');
}

// ====================
// Logout
// ====================
function logout() {
    currentUser = null;
    isLoggedIn = false;
    localStorage.removeItem('currentUser');
    document.getElementById('guestView').classList.remove('d-none');
    document.getElementById('userDashboard').classList.add('d-none');
    document.getElementById('userBalanceCard').classList.add('d-none');
    document.getElementById('loggedInUser').classList.add('d-none');
    document.getElementById('loginBtn').classList.remove('d-none');
    document.getElementById('floatingWithdrawBtn').classList.add('d-none');
    showSection('home');
    showSuccess('Logged out');
}

// ====================
// Toast
// ====================
function showSuccess(msg) {
    document.getElementById('successToastBody').textContent = msg;
    new bootstrap.Toast(document.getElementById('successToast')).show();
}

function showError(msg) {
    document.getElementById('errorToastBody').textContent = msg;
    new bootstrap.Toast(document.getElementById('errorToast')).show();
}

// ====================
// Global Functions
// ====================
window.userLogin = userLogin;
window.registerUser = registerUser;
window.submitRechargeRequest = submitRechargeRequest;
window.submitWithdrawRequest = submitWithdrawRequest;
window.showWithdrawModal = showWithdrawModal;
window.toggleTheme = toggleTheme;
window.showSection = showSection;
window.logout = logout;
