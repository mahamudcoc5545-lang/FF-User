// Global Variables
let currentUser = null;
let isLoggedIn = false;
let tournaments = [];
let userTransactions = [];
let systemSettings = {};
let rememberMe = false;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    checkExistingLogin();
    loadSystemSettings();
    setupFirebaseListeners();
    initializePaymentMethods();
});

// Load System Settings
function loadSystemSettings() {
    database.ref('admin/settings').once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                systemSettings = snapshot.val();
                if (systemSettings.minWithdrawal) {
                    document.getElementById('minWithdrawalText').textContent = `Minimum withdrawal: ৳${systemSettings.minWithdrawal}`;
                }
            } else {
                systemSettings = { minWithdrawal: 200 };
            }
        });
}

// Check Existing Login
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

// Setup Firebase Listeners
function setupFirebaseListeners() {
    database.ref('notices').on('value', (snapshot) => {
        if (snapshot.exists()) {
            let noticeText = '';
            snapshot.forEach((child) => {
                const notice = child.val();
                if (notice.active) {
                    noticeText += ' 📢 ' + notice.message + ' | ';
                }
            });
            if (noticeText) {
                document.getElementById('noticeMarquee').innerHTML = noticeText;
            }
        }
    });

    database.ref('tournaments').on('value', (snapshot) => {
        if (snapshot.exists()) {
            tournaments = [];
            snapshot.forEach((child) => {
                const tournament = child.val();
                tournament.id = child.key;
                tournaments.push(tournament);
            });
            if (isLoggedIn) {
                displayTournaments();
                displayLiveTournament();
                displayUpcomingTournaments();
                displayActiveTournaments();
            }
        }
    });

    database.ref('users').on('value', (snapshot) => {
        if (snapshot.exists() && isLoggedIn && currentUser) {
            const userData = snapshot.val()[currentUser.username];
            if (userData) {
                currentUser.balance = userData.balance || 0;
                currentUser.name = userData.name || currentUser.username;
                currentUser.ffid = userData.ffid || '';
                if (userData.transactions) {
                    userTransactions = Object.keys(userData.transactions).map(key => {
                        const t = userData.transactions[key];
                        t.id = key;
                        return t;
                    });
                    userTransactions.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                }
                updateUserUI();
            }
        }
    });
}

// Initialize Payment Methods
function initializePaymentMethods() {
    const rechargeSelect = document.getElementById('paymentMethod');
    const withdrawSelect = document.getElementById('withdrawMethod');
    const methods = ['bkash', 'nagad', 'rocket', 'upay'];
    methods.forEach(m => {
        const opt1 = document.createElement('option');
        opt1.value = m;
        opt1.textContent = m.charAt(0).toUpperCase() + m.slice(1);
        rechargeSelect.appendChild(opt1);
        const opt2 = opt1.cloneNode(true);
        withdrawSelect.appendChild(opt2);
    });
}

// Show Payment Number
function showPaymentNumber() {
    const method = document.getElementById('paymentMethod').value;
    const info = document.getElementById('paymentNumberInfo');
    if (method) {
        document.getElementById('selectedMethodName').textContent = method.charAt(0).toUpperCase() + method.slice(1);
        document.getElementById('paymentNumber').textContent = '018XXXXXXXX';
        document.getElementById('paymentType').textContent = 'Personal';
        info.style.display = 'block';
    } else {
        info.style.display = 'none';
    }
}

// User Login
function userLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    rememberMe = document.getElementById('rememberMe').checked;
    if (!username || !password) return showError('Fill all fields');
    database.ref(`users/${username}`).once('value').then(snapshot => {
        if (snapshot.exists() && snapshot.val().password === password) {
            currentUser = snapshot.val();
            currentUser.username = username;
            isLoggedIn = true;
            if (rememberMe) localStorage.setItem('currentUser', JSON.stringify({username}));
            showUserDashboard();
            bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
            showSuccess('Login successful!');
        } else {
            showError('Invalid credentials');
        }
    });
}

// Register User
function registerUser() {
    const name = document.getElementById('regName').value.trim();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value.trim();
    const ffid = document.getElementById('regFFID').value.trim();
    if (!name || !username || !password || !ffid) return showError('Fill all fields');
    database.ref(`users/${username}`).once('value').then(snapshot => {
        if (snapshot.exists()) {
            showError('Username exists');
        } else {
            const userData = { name, password, ffid, balance: 100, kills: 0, wins: 0, matches: 0, joinDate: new Date().toISOString(), transactions: {}, notifications: {} };
            database.ref(`users/${username}`).set(userData).then(() => {
                currentUser = userData;
                currentUser.username = username;
                isLoggedIn = true;
                localStorage.setItem('currentUser', JSON.stringify({username}));
                showUserDashboard();
                bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
                showSuccess('Registered! +৳100 bonus');
            });
        }
    });
}

// Show User Dashboard
function showUserDashboard() {
    document.getElementById('guestView').classList.add('d-none');
    document.getElementById('userDashboard').classList.remove('d-none');
    document.getElementById('userBalanceCard').classList.remove('d-none');
    document.getElementById('loggedInUser').classList.remove('d-none');
    document.getElementById('loginBtn').classList.add('d-none');
    document.getElementById('floatingWithdrawBtn').classList.remove('d-none');
    showSection('home');
}

// Update User UI
function updateUserUI() {
    document.getElementById('userBalance').textContent = currentUser.balance || 0;
    const profileCard = document.getElementById('userProfileCard');
    if (profileCard) {
        profileCard.innerHTML = `
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

// Submit Withdraw Request (Corrected)
function submitWithdrawRequest() {
    if (!isLoggedIn) return showError('Please login first');
    const amount = parseInt(document.getElementById('withdrawAmount').value);
    const method = document.getElementById('withdrawMethod').value;
    const accountNumber = document.getElementById('withdrawAccountNumber').value.trim();
    const minWithdrawal = systemSettings.minWithdrawal || 200;
    if (!amount || amount < minWithdrawal) return showError(`Minimum withdrawal ৳${minWithdrawal}`);
    if (!method || !accountNumber) return showError('Fill all fields');
    if (currentUser.balance < amount) return showError('Insufficient balance');
    const requestId = 'withdraw_' + Date.now();
    const newBalance = currentUser.balance - amount;
    const withdrawData = { username: currentUser.username, amount, method, accountNumber, status: 'pending', timestamp: Date.now(), name: currentUser.name || currentUser.username };
    database.ref(`users/${currentUser.username}/balance`).set(newBalance)
        .then(() => database.ref(`withdrawRequests/${requestId}`).set(withdrawData))
        .then(() => database.ref(`users/${currentUser.username}/transactions/${requestId}`).set({
            type: 'withdrawal_request', amount: -amount, status: 'pending', timestamp: Date.now(), method
        }))
        .then(() => {
            currentUser.balance = newBalance;
            updateUserUI();
            document.getElementById('withdrawAmount').value = '';
            document.getElementById('withdrawAccountNumber').value = '';
            bootstrap.Modal.getInstance(document.getElementById('withdrawModal')).hide();
            showSuccess(`Withdrawal request of ৳${amount} submitted!`);
        })
        .catch(err => showError('Error: ' + err.message));
}

// অন্যান্য ফাংশনগুলো (joinTournament, displayTournaments, showSection, logout, showSuccess, showError ইত্যাদি) তোমার আগের কোড থেকে কপি করে রাখো

// Global functions
window.userLogin = userLogin;
window.registerUser = registerUser;
window.submitWithdrawRequest = submitWithdrawRequest;
window.showWithdrawModal = showWithdrawModal;
window.showSection = showSection;
window.logout = logout;
window.showSuccess = msg => {
    document.getElementById('successToastBody').textContent = msg;
    new bootstrap.Toast(document.getElementById('successToast')).show();
};
window.showError = msg => {
    document.getElementById('errorToastBody').textContent = msg;
    new bootstrap.Toast(document.getElementById('errorToast')).show();
};
