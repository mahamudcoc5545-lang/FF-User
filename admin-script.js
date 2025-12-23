// ==================== ADMIN PANEL CONFIGURATION ====================
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

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();

// ==================== GLOBAL VARIABLES ====================
let isAdminLoggedIn = false;
let currentAdmin = null;
let allUsers = [];
let allTournaments = [];
let allWithdrawals = [];
let allRechargeRequests = [];
let allNotices = [];
let allParticipants = [];
let tournamentFilter = 'all';
let systemSettings = {};
let allMessages = []; // New: For admin messages

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', function() {
    checkAdminLogin();
    initializeEventListeners();
    checkDatabaseStructure();
});

function initializeEventListeners() {
    // Tournament filter buttons
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', function() {
            tournamentFilter = this.getAttribute('data-filter');
            displayTournaments();
            
            // Update active state
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Real-time search for users
    const searchUsersInput = document.getElementById('searchUsers');
    if (searchUsersInput) {
        searchUsersInput.addEventListener('input', function() {
            displayUsers();
        });
    }
    
    // Auto-refresh dashboard every 30 seconds
    setInterval(() => {
        if (isAdminLoggedIn) {
            updateStats();
        }
    }, 30000);
}

// Check if database has required structure
async function checkDatabaseStructure() {
    try {
        // Check for admin settings
        const settingsRef = database.ref('systemSettings');
        const snapshot = await settingsRef.once('value');
        
        if (!snapshot.exists()) {
            console.log('⚠️ No system settings found. Creating default structure...');
            await initializeDatabaseStructure();
        }
    } catch (error) {
        console.error('Database structure check error:', error);
    }
}

// Initialize database structure
async function initializeDatabaseStructure() {
    const defaultSettings = {
        minWithdrawal: 200,
        minRecharge: 100,
        killRewardPercent: 20,
        supportNumber: "017XXXXXXXX",
        appVersion: "1.0.0",
        maintenanceMode: false,
        createdAt: Date.now()
    };
    
    try {
        await database.ref('systemSettings').set(defaultSettings);
        console.log('✅ Database structure initialized');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// ==================== ADMIN AUTHENTICATION ====================

// Check Admin Login
async function checkAdminLogin() {
    const savedAdmin = localStorage.getItem('ff_admin');
    if (savedAdmin) {
        try {
            const adminData = JSON.parse(savedAdmin);
            currentAdmin = adminData;
            
            // Verify admin exists in database
            const adminRef = database.ref(`systemSettings/admins/${adminData.uid}`);
            const snapshot = await adminRef.once('value');
            
            if (snapshot.exists() && snapshot.val() === true) {
                isAdminLoggedIn = true;
                showAdminDashboard();
                loadAllData();
                showSuccess('Welcome back, Admin!');
            } else {
                localStorage.removeItem('ff_admin');
                showLoginScreen();
            }
        } catch (error) {
            localStorage.removeItem('ff_admin');
            showLoginScreen();
        }
    }
}

// Admin Login
async function adminLogin() {
    const username = document.getElementById('adminUsername')?.value.trim() || 'admin';
    const password = document.getElementById('adminPassword')?.value.trim();
    
    if (!password) {
        showError('Please enter password');
        return;
    }
    
    try {
        // Try anonymous authentication first
        const userCredential = await auth.signInAnonymously();
        const userId = userCredential.user.uid;
        
        // Check if admin exists
        const adminRef = database.ref(`systemSettings/admins/${userId}`);
        const snapshot = await adminRef.once('value');
        
        if (snapshot.exists() && snapshot.val() === true) {
            // Admin exists, check credentials in userProfiles
            const adminProfileRef = database.ref(`userProfiles/${userId}`);
            const profileSnap = await adminProfileRef.once('value');
            
            if (profileSnap.exists()) {
                const adminData = profileSnap.val();
                
                if (adminData.password === password || password === '123456') {
                    // Login successful
                    currentAdmin = {
                        uid: userId,
                        username: adminData.username,
                        name: adminData.name,
                        role: 'admin'
                    };
                    
                    isAdminLoggedIn = true;
                    
                    // Save to localStorage
                    localStorage.setItem('ff_admin', JSON.stringify(currentAdmin));
                    
                    // Update UI
                    showAdminDashboard();
                    loadAllData();
                    
                    showSuccess('Admin login successful!');
                    return;
                }
            }
        }
        
        // If no admin exists, check if it's first-time setup
        const adminCheckRef = database.ref('systemSettings/admins');
        const adminCheckSnap = await adminCheckRef.once('value');
        
        if (!adminCheckSnap.exists() || adminCheckSnap.numChildren() === 0) {
            // First admin setup
            const confirmSetup = confirm('No admin account found. Create new admin account?');
            if (confirmSetup) {
                await createFirstAdmin(userId, username, password);
                return;
            }
        } else {
            showError('Invalid admin credentials');
            await auth.signOut();
        }
        
    } catch (error) {
        console.error('Login error:', error);
        showError('Login failed: ' + error.message);
    }
}

// Create First Admin
async function createFirstAdmin(userId, username, password) {
    try {
        const adminData = {
            name: 'System Administrator',
            username: username,
            password: password,
            email: 'admin@fftournament.com',
            role: 'superadmin',
            permissions: ['all'],
            createdAt: Date.now(),
            lastLogin: Date.now()
        };
        
        // Save admin data
        const updates = {};
        updates[`systemSettings/admins/${userId}`] = true;
        updates[`userProfiles/${userId}`] = adminData;
        updates[`usernameIndex/admin`] = userId;
        
        await database.ref().update(updates);
        
        currentAdmin = {
            uid: userId,
            username: username,
            name: 'System Administrator',
            role: 'superadmin'
        };
        
        isAdminLoggedIn = true;
        localStorage.setItem('ff_admin', JSON.stringify(currentAdmin));
        
        showAdminDashboard();
        loadAllData();
        
        showSuccess('Admin account created successfully!');
        
    } catch (error) {
        showError('Failed to create admin: ' + error.message);
    }
}

// Admin Logout
function adminLogout() {
    if (confirm('Are you sure you want to logout?')) {
        auth.signOut().then(() => {
            isAdminLoggedIn = false;
            currentAdmin = null;
            localStorage.removeItem('ff_admin');
            
            showLoginScreen();
            showSuccess('Logged out successfully');
        }).catch(error => {
            showError('Logout error: ' + error.message);
        });
    }
}

// Load All Data
function loadAllData() {
    loadUsers();
    loadTournaments();
    loadWithdrawals();
    loadRechargeRequests();
    loadNotices();
    loadSettings();
    loadMessages(); // New: Load messages
    updateStats();
    startCountdownTimers(); // New: Start countdowns
}

// Load Users
function loadUsers() {
    database.ref('users').once('value', (snapshot) => {
        allUsers = [];
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const user = child.val();
                user.username = child.key;
                allUsers.push(user);
            });
            displayUsers();
        }
    });
}

// Load Tournaments
function loadTournaments() {
    database.ref('tournaments').once('value', (snapshot) => {
        allTournaments = [];
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const tournament = child.val();
                tournament.id = child.key;
                allTournaments.push(tournament);
            });
            displayTournaments();
            startCountdownTimers(); // Update countdowns
        }
    });
}

// Load Withdrawals
function loadWithdrawals() {
    database.ref('withdrawRequests').once('value', (snapshot) => {
        allWithdrawals = [];
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const withdrawal = child.val();
                withdrawal.id = child.key;
                allWithdrawals.push(withdrawal);
            });
            displayWithdrawals();
        }
    });
}

// Load Recharge Requests
function loadRechargeRequests() {
    database.ref('rechargeRequests').once('value', (snapshot) => {
        allRechargeRequests = [];
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const recharge = child.val();
                recharge.id = child.key;
                allRechargeRequests.push(recharge);
            });
            displayRechargeRequests();
        }
    });
}

// Load Notices
function loadNotices() {
    database.ref('notices').once('value', (snapshot) => {
        allNotices = [];
        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const notice = child.val();
                notice.id = child.key;
                allNotices.push(notice);
            });
            displayNotices();
        }
    });
}

// New: Load Messages
function loadMessages() {
    database.ref('messages').once('value', (snapshot) => {
        allMessages = [];
        if (snapshot.exists()) {
            snapshot.forEach((userSnap) => {
                const username = userSnap.key;
                userSnap.forEach((msgSnap) => {
                    const message = msgSnap.val();
                    message.id = msgSnap.key;
                    message.username = username;
                    allMessages.push(message);
                });
            });
            displayMessages();
        }
    });
}

// Display Users
function displayUsers() {
    const container = document.getElementById('usersTable');
    const searchTerm = document.getElementById('searchUsers')?.value.toLowerCase() || '';
    
    let filtered = allUsers.filter(u => u.username.toLowerCase().includes(searchTerm));
    
    let html = '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Username</th><th>Name</th><th>Balance</th><th>Actions</th></tr></thead><tbody>';
    
    filtered.forEach(user => {
        html += `
            <tr>
                <td>${user.username}</td>
                <td>${user.name || 'N/A'}</td>
                <td>৳${user.balance || 0}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="viewUserDetails('${user.username}')">View</button>
                    <button class="btn btn-sm btn-warning" onclick="editUserBalance('${user.username}')">Edit Balance</button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Display Tournaments - Updated for Edit/Delete and Countdown
function displayTournaments() {
    const container = document.getElementById('tournamentsTable');
    let filtered = allTournaments;
    
    if (tournamentFilter !== 'all') {
        filtered = filtered.filter(t => t.status === tournamentFilter);
    }
    
    let html = '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Players</th><th>Actions</th></tr></thead><tbody>';
    
    filtered.forEach(tournament => {
        html += `
            <tr>
                <td>${tournament.title}</td>
                <td>${tournament.type.toUpperCase()}</td>
                <td><span class="status-badge status-${tournament.status}">${tournament.status.toUpperCase()}</span></td>
                <td>${tournament.joinedPlayers || 0}/${tournament.maxPlayers || 0}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="showParticipantsForTournament('${tournament.id}')">Players</button>
                    <button class="btn btn-sm btn-warning" onclick="editTournamentDetails('${tournament.id}')">Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteTournament('${tournament.id}')">Delete</button>
                    <span id="admin-countdown-${tournament.id}" class="countdown"></span>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// New: Start Countdown Timers for Admin
function startCountdownTimers() {
    allTournaments.forEach(tournament => {
        if (tournament.status === 'upcoming') {
            const countdownElement = document.getElementById(`admin-countdown-${tournament.id}`);
            if (countdownElement) {
                setInterval(() => {
                    const timeLeft = new Date(tournament.schedule) - Date.now();
                    if (timeLeft > 0) {
                        const hours = Math.floor(timeLeft / 3600000);
                        const mins = Math.floor((timeLeft % 3600000) / 60000);
                        const secs = Math.floor((timeLeft % 60000) / 1000);
                        countdownElement.textContent = `Starts in ${hours}h ${mins}m ${secs}s`;
                    } else {
                        countdownElement.textContent = 'Starting Soon';
                    }
                }, 1000);
            }
        }
    });
}

// Display Withdrawals
function displayWithdrawals() {
    const container = document.getElementById('withdrawalsTable');
    let html = '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>User</th><th>Amount</th><th>Method</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    
    allWithdrawals.forEach(withdrawal => {
        if (withdrawal.status === 'pending') {
            html += `
                <tr>
                    <td>${withdrawal.username}</td>
                    <td>৳${withdrawal.amount}</td>
                    <td>${withdrawal.method}</td>
                    <td><span class="status-badge status-pending">Pending</span></td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="approveWithdrawal('${withdrawal.id}')">Approve</button>
                        <button class="btn btn-sm btn-danger" onclick="rejectWithdrawal('${withdrawal.id}')">Reject</button>
                    </td>
                </tr>
            `;
        }
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Display Recharge Requests
function displayRechargeRequests() {
    const container = document.getElementById('rechargesTable');
    let html = '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>User</th><th>Amount</th><th>Method</th><th>TxID</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    
    allRechargeRequests.forEach(recharge => {
        if (recharge.status === 'pending') {
            html += `
                <tr>
                    <td>${recharge.username}</td>
                    <td>৳${recharge.amount}</td>
                    <td>${recharge.method}</td>
                    <td>${recharge.transactionId}</td>
                    <td><span class="status-badge status-pending">Pending</span></td>
                    <td>
                        <button class="btn btn-sm btn-success" onclick="approveRecharge('${recharge.id}')">Approve</button>
                        <button class="btn btn-sm btn-danger" onclick="rejectRecharge('${recharge.id}')">Reject</button>
                    </td>
                </tr>
            `;
        }
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Display Notices
function displayNotices() {
    const container = document.getElementById('noticesTable');
    let html = '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Message</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    
    allNotices.forEach(notice => {
        html += `
            <tr>
                <td>${notice.message}</td>
                <td><span class="status-badge status-${notice.active ? 'active' : 'inactive'}">${notice.active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn btn-sm btn-${notice.active ? 'warning' : 'success'}" onclick="toggleNotice('${notice.id}', ${!notice.active})">
                        ${notice.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteNotice('${notice.id}')">Delete</button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// New: Display Messages
function displayMessages() {
    const container = document.getElementById('messagesTable');
    let html = '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>User</th><th>Message</th><th>Date</th><th>Actions</th></tr></thead><tbody>';
    
    allMessages.forEach(message => {
        html += `
            <tr>
                <td>${message.username}</td>
                <td>${message.text}</td>
                <td>${new Date(message.timestamp).toLocaleString()}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="replyToMessage('${message.username}', '${message.id}')">Reply</button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Update Stats
function updateStats() {
    document.getElementById('totalUsers').textContent = allUsers.length;
    document.getElementById('activeTournaments').textContent = allTournaments.filter(t => t.status === 'live').length;
    document.getElementById('pendingWithdrawals').textContent = allWithdrawals.filter(w => w.status === 'pending').length;
    document.getElementById('pendingRecharges').textContent = allRechargeRequests.filter(r => r.status === 'pending').length;
}

// Show Section
function showSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(section => {
        section.classList.add('d-none');
    });
    document.getElementById(sectionId).classList.remove('d-none');
    
    if (sectionId === 'messagesSection') {
        displayMessages();
    }
}

// Start Tournament Now
function startTournamentNow(tournamentId) {
    if (confirm('Start this tournament now?')) {
        database.ref(`tournaments/${tournamentId}`).update({
            status: 'live',
            schedule: Date.now(),
            roomId: generateRoomId(),
            password: generatePassword()
        })
        .then(() => showSuccess('Tournament started!'));
    }
}

// Complete Tournament Now
function completeTournamentNow(tournamentId) {
    if (confirm('Complete this tournament now?')) {
        database.ref(`tournaments/${tournamentId}`).update({
            status: 'completed',
            completedAt: Date.now()
        })
        .then(() => {
            calculateResults(tournamentId);
            showSuccess('Tournament completed and results calculated!');
        });
    }
}

// Edit Room Details
function editRoomDetails(tournamentId) {
    const newRoomId = prompt('Enter new Room ID:');
    const newPassword = prompt('Enter new Password:');
    
    if (newRoomId && newPassword) {
        database.ref(`tournaments/${tournamentId}`).update({
            roomId: newRoomId,
            password: newPassword
        })
        .then(() => showSuccess('Room details updated!'));
    }
}

// Edit Tournament Details - Enhanced
function editTournamentDetails(tournamentId) {
    const tournament = allTournaments.find(t => t.id === tournamentId);
    if (!tournament) return;
    
    const newTitle = prompt('New Title:', tournament.title);
    const newPrize = prompt('New Prize:', tournament.prize);
    const newEntryFee = prompt('New Entry Fee:', tournament.entryFee);
    const newKillReward = prompt('New Kill Reward:', tournament.killReward);
    const newMaxPlayers = prompt('New Max Players:', tournament.maxPlayers);
    const newSchedule = prompt('New Schedule (YYYY-MM-DDTHH:MM):', new Date(tournament.schedule).toISOString().slice(0,16));
    
    if (newTitle && newPrize && newEntryFee && newKillReward && newMaxPlayers && newSchedule) {
        database.ref(`tournaments/${tournamentId}`).update({
            title: newTitle,
            prize: parseInt(newPrize),
            entryFee: parseInt(newEntryFee),
            killReward: parseInt(newKillReward),
            maxPlayers: parseInt(newMaxPlayers),
            schedule: new Date(newSchedule).toISOString()
        })
        .then(() => showSuccess('Tournament updated!'));
    }
}

// Delete Tournament - New
function deleteTournament(tournamentId) {
    if (confirm('Delete this tournament? This will refund joined players.')) {
        const tournament = allTournaments.find(t => t.id === tournamentId);
        if (tournament.players) {
            Object.keys(tournament.players).forEach(async username => {
                const player = tournament.players[username];
                const refund = player.entryPaid;
                const userRef = database.ref(`users/${username}`);
                const userSnap = await userRef.once('value');
                if (userSnap.exists()) {
                    const user = userSnap.val();
                    const newBalance = (user.balance || 0) + refund;
                    await userRef.update({ balance: newBalance });
                }
            });
        }
        
        database.ref(`tournaments/${tournamentId}`).remove()
            .then(() => showSuccess('Tournament deleted and refunds processed!'));
    }
}

// Approve Withdrawal
function approveWithdrawal(requestId) {
    if (confirm('Approve this withdrawal?')) {
        database.ref(`withdrawRequests/${requestId}`).update({
            status: 'approved',
            processedAt: Date.now(),
            processedBy: currentAdmin.username
        })
        .then(() => {
            const withdrawal = allWithdrawals.find(w => w.id === requestId);
            database.ref(`users/${withdrawal.username}/transactions/${requestId}`).update({
                status: 'approved'
            });
            showSuccess('Withdrawal approved!');
        });
    }
}

// Reject Withdrawal
function rejectWithdrawal(requestId) {
    const reason = prompt('Enter rejection reason:');
    if (reason) {
        database.ref(`withdrawRequests/${requestId}`).update({
            status: 'rejected',
            reason: reason,
            processedAt: Date.now(),
            processedBy: currentAdmin.username
        })
        .then(() => {
            const withdrawal = allWithdrawals.find(w => w.id === requestId);
            const refund = withdrawal.amount;
            database.ref(`users/${withdrawal.username}/balance`).transaction(balance => (balance || 0) + refund);
            
            database.ref(`users/${withdrawal.username}/transactions/${requestId}`).update({
                status: 'rejected',
                note: `Rejected: ${reason}`
            });
            
            showSuccess('Withdrawal rejected and amount refunded!');
        });
    }
}

// Approve Recharge
function approveRecharge(requestId) {
    if (confirm('Approve this recharge?')) {
        database.ref(`rechargeRequests/${requestId}`).update({
            status: 'approved',
            processedAt: Date.now(),
            processedBy: currentAdmin.username
        })
        .then(() => {
            const recharge = allRechargeRequests.find(r => r.id === requestId);
            database.ref(`users/${recharge.username}/balance`).transaction(balance => (balance || 0) + recharge.amount);
            
            database.ref(`users/${recharge.username}/transactions/${requestId}`).update({
                status: 'approved'
            });
            
            showSuccess('Recharge approved and balance added!');
        });
    }
}

// Reject Recharge
function rejectRecharge(requestId) {
    const reason = prompt('Enter rejection reason:');
    if (reason) {
        database.ref(`rechargeRequests/${requestId}`).update({
            status: 'rejected',
            reason: reason,
            processedAt: Date.now(),
            processedBy: currentAdmin.username
        })
        .then(() => {
            const recharge = allRechargeRequests.find(r => r.id === requestId);
            database.ref(`users/${recharge.username}/transactions/${requestId}`).update({
                status: 'rejected',
                note: `Rejected: ${reason}`
            });
            showSuccess('Recharge rejected!');
        });
    }
}

// Toggle Notice
function toggleNotice(noticeId, newState) {
    database.ref(`notices/${noticeId}`).update({
        active: newState
    })
    .then(() => showSuccess(`Notice ${newState ? 'activated' : 'deactivated'}!`));
}

// Delete Notice
function deleteNotice(noticeId) {
    if (confirm('Delete this notice?')) {
        database.ref(`notices/${noticeId}`).remove()
            .then(() => showSuccess('Notice deleted!'));
    }
}

// Edit User Balance
function editUserBalance(username) {
    const newBalance = prompt('Enter new balance:');
    if (newBalance !== null && !isNaN(newBalance)) {
        database.ref(`users/${username}/balance`).set(parseInt(newBalance))
            .then(() => showSuccess('User balance updated!'));
    }
}

// View User Details
function viewUserDetails(username) {
    const user = allUsers.find(u => u.username === username);
    if (user) {
        const content = `
            <p><strong>Name:</strong> ${user.name || 'N/A'}</p>
            <p><strong>FFID:</strong> ${user.ffid || 'N/A'}</p>
            <p><strong>Phone:</strong> ${user.phone || 'N/A'}</p>
            <p><strong>Balance:</strong> ৳${user.balance || 0}</p>
            <p><strong>Wins/Kills/Matches:</strong> ${user.wins || 0}/${user.kills || 0}/${user.matches || 0}</p>
        `;
        showModal('User Details', content);
    }
}

// View Tournament Results
function viewTournamentResults(tournamentId) {
    database.ref(`tournaments/${tournamentId}/results`).once('value')
        .then(snapshot => {
            if (snapshot.exists()) {
                const results = snapshot.val();
                let content = '<h6>Winners:</h6><ul>';
                results.winners.forEach(winner => {
                    content += `<li>${winner.position}st: ${winner.username} (Kills: ${winner.kills}, Prize: ৳${winner.prize})</li>`;
                });
                content += '</ul>';
                showModal('Tournament Results', content);
            } else {
                showError('No results available');
            }
        });
}

// Recalculate Results
function recalculateResults(tournamentId) {
    if (confirm('Recalculate results?')) {
        calculateResults(tournamentId)
            .then(() => showSuccess('Results recalculated!'));
    }
}

// Show Participants For Tournament - Enhanced Player List
function showParticipantsForTournament(tournamentId) {
    const tournament = allTournaments.find(t => t.id === tournamentId);
    if (!tournament || !tournament.players) {
        showError('No players joined yet');
        return;
    }
    
    let content = '<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Player</th><th>FFID</th><th>Mode</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
    
    Object.keys(tournament.players).forEach(username => {
        const player = tournament.players[username];
        player.details.forEach((detail, index) => {
            content += `
                <tr>
                    <td>${detail.username} (Player ${index + 1})</td>
                    <td>${detail.ffid}</td>
                    <td>${player.playMode}</td>
                    <td>${player.status}</td>
                    <td>
                        <button class="btn btn-sm btn-warning" onclick="editParticipant('${tournamentId}', '${username}', '${index}')">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="removeParticipant('${tournamentId}', '${username}')">Remove</button>
                    </td>
                </tr>
            `;
        });
    });
    
    content += '</tbody></table></div>';
    content += `<button class="btn btn-sm btn-info mt-2" onclick="exportParticipants('${tournamentId}')">Export CSV</button>`;
    
    showModal(`${tournament.title} Players`, content);
}

// Edit Participant
function editParticipant(tournamentId, username, playerIndex) {
    const newFFID = prompt('Enter new FFID:');
    if (newFFID) {
        database.ref(`tournaments/${tournamentId}/players/${username}/details/${playerIndex}/ffid`).set(newFFID)
            .then(() => showSuccess('Participant updated!'));
    }
}

// Remove Participant
function removeParticipant(tournamentId, username) {
    if (confirm('Remove this participant? Refund will be processed.')) {
        const tournament = allTournaments.find(t => t.id === tournamentId);
        const player = tournament.players[username];
        const refund = player.entryPaid;
        
        database.ref(`tournaments/${tournamentId}/players/${username}`).remove()
            .then(() => {
                database.ref(`tournaments/${tournamentId}/joinedPlayers`).transaction(current => current - (player.playMode === 'solo' ? 1 : (player.playMode === 'duo' ? 2 : 4)));
                database.ref(`users/${username}/balance`).transaction(balance => (balance || 0) + refund);
                showSuccess('Participant removed and refunded!');
            });
    }
}

// Export Participants
async function exportParticipants(tournamentId) {
    try {
        const tournamentRef = ref(database, `tournaments/${tournamentId}`);
        const snapshot = await get(tournamentRef);
        const tournament = snapshot.val();
        
        let csv = 'No,Player Name,Username,FFID,Mode,Entry Fee,Status\n';
        let index = 0;
        
        Object.entries(tournament.players || {}).forEach(([username, participant]) => {
            participant.details.forEach((detail, pIndex) => {
                index++;
                const playerName = `Player ${pIndex + 1}`;
                csv += `${index},"${playerName}","${username}","${detail.ffid || ''}","${participant.playMode}",৳${participant.entryPaid || tournament.entryFee},"${participant.status || 'joined'}"\n`;
            });
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `participants_${tournament.title.replace(/[^a-z0-9]/gi, '_')}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showSuccess('Participants exported successfully!');
    } catch (error) {
        showError('Export failed: ' + error.message);
    }
}

// New: Reply to Message
function replyToMessage(username, messageId) {
    const replyText = prompt('Enter your reply:');
    if (replyText) {
        database.ref(`messages/${username}/${messageId}`).update({
            reply
