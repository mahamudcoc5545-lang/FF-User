// Firebase Configuration and Initialization
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

// Global Variables
let currentUser = null;
let isLoggedIn = false;
let tournaments = [];
let userTransactions = [];
let paymentMethods = [];
let systemSettings = {};
let rememberMe = false;
let userNotifications = [];
let userMessages = [];

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    checkExistingLogin();
    loadSystemSettings();
    setupFirebaseListeners();
    initializePaymentMethods();
    // Create a demo tournament for testing
    createDemoTournament();
    startCountdownTimers(); // New: Start countdown for all tournaments
});

// Create Demo Tournament (for testing)
function createDemoTournament() {
    const demoTournament = {
        title: "Daily Solo Tournament",
        type: "solo",
        entryFee: 50,
        prize: 500,
        killReward: 10,
        maxPlayers: 50,
        joinedPlayers: 0,
        schedule: Date.now() + 86400000, // Tomorrow
        status: "upcoming",
        created: Date.now()
    };
    
    // Check if demo tournament already exists
    database.ref('tournaments/demo_tournament').once('value')
        .then((snapshot) => {
            if (!snapshot.exists()) {
                database.ref('tournaments/demo_tournament').set(demoTournament);
            }
        });
}

// Load System Settings
function loadSystemSettings() {
    database.ref('admin/settings').once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                systemSettings = snapshot.val();
                if (systemSettings.minWithdrawal) {
                    document.getElementById('minWithdrawalText').textContent = 
                        `Minimum withdrawal: ৳${systemSettings.minWithdrawal}`;
                }
            } else {
                // Default settings if not exists
                systemSettings = {
                    minWithdrawal: 200,
                    minRecharge: 100
                };
            }
        })
        .catch((error) => {
            console.log('Settings load error:', error);
            // Default settings on error
            systemSettings = {
                minWithdrawal: 200,
                minRecharge: 100
            };
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
    // Listen for notices
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
    
    // Listen for tournaments
    database.ref('tournaments').on('value', (snapshot) => {
        if (snapshot.exists()) {
            tournaments = [];
            snapshot.forEach((child) => {
                const tournament = child.val();
                tournament.id = child.key;
                tournaments.push(tournament);
            });
            
            // Update UI if user is logged in
            if (isLoggedIn) {
                displayTournaments();
                displayLiveTournament();
                displayUpcomingTournaments();
                displayActiveTournaments();
                startCountdownTimers(); // Update countdowns
            }
        }
    });
    
    // Listen for user updates
    database.ref('users').on('value', (snapshot) => {
        if (snapshot.exists() && isLoggedIn && currentUser) {
            const userData = snapshot.val()[currentUser.username];
            if (userData) {
                currentUser.balance = userData.balance || 0;
                currentUser.name = userData.name || currentUser.username;
                currentUser.ffid = userData.ffid || '';
                currentUser.phone = userData.phone || '';
                currentUser.kills = userData.kills || 0;
                currentUser.wins = userData.wins || 0;
                currentUser.matches = userData.matches || 0;
                
                // Load transactions
                if (userData.transactions) {
                    userTransactions = [];
                    Object.keys(userData.transactions).forEach(key => {
                        const transaction = userData.transactions[key];
                        transaction.id = key;
                        userTransactions.push(transaction);
                    });
                    
                    // Sort by timestamp (newest first)
                    userTransactions.sort((a, b) => {
                        const timeA = a.timestamp || a.date || 0;
                        const timeB = b.timestamp || b.date || 0;
                        return timeB - timeA;
                    });
                    
                    if (document.getElementById('historySection').classList.contains('d-none') === false) {
                        displayTransactions(userTransactions);
                    }
                }
                
                updateUserUI();
            }
        }
    });

    // New: Listen for user messages
    if (currentUser) {
        database.ref(`messages/${currentUser.username}`).on('value', (snapshot) => {
            userMessages = [];
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const message = child.val();
                    message.id = child.key;
                    userMessages.push(message);
                });
                displayUserMessages();
            }
        });
    }
}

// Initialize Payment Methods
function initializePaymentMethods() {
    // Default payment methods
    paymentMethods = [
        { name: 'bkash', number: '018XXXXXXXX', type: 'Personal', status: 'active' },
        { name: 'nagad', number: '018XXXXXXXX', type: 'Personal', status: 'active' },
        { name: 'rocket', number: '018XXXXXXXX', type: 'Personal', status: 'active' },
        { name: 'upay', number: '018XXXXXXXX', type: 'Personal', status: 'active' }
    ];
    
    updatePaymentMethods();
}

// Update Payment Methods in Recharge Modal
function updatePaymentMethods() {
    const select = document.getElementById('paymentMethod');
    select.innerHTML = '<option value="">Select Payment Method</option>';
    
    paymentMethods.forEach(method => {
        if (method.status === 'active') {
            const option = document.createElement('option');
            option.value = method.name;
            option.textContent = method.name.charAt(0).toUpperCase() + method.name.slice(1);
            select.appendChild(option);
        }
    });
}

// Show Payment Number
function showPaymentNumber() {
    const methodName = document.getElementById('paymentMethod').value;
    const infoDiv = document.getElementById('paymentNumberInfo');
    
    if (methodName) {
        const method = paymentMethods.find(m => m.name === methodName);
        if (method) {
            document.getElementById('selectedMethodName').textContent = method.name.charAt(0).toUpperCase() + method.name.slice(1);
            document.getElementById('paymentNumber').textContent = method.number;
            document.getElementById('paymentType').textContent = method.type || 'Personal';
            infoDiv.style.display = 'block';
        } else {
            infoDiv.style.display = 'none';
        }
    } else {
        infoDiv.style.display = 'none';
    }
}

// User Login - FIXED VERSION
function userLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();
    rememberMe = document.getElementById('rememberMe').checked;
    
    if (!username || !password) {
        showError('Please enter username and password');
        return;
    }
    
    database.ref(`users/${username}`).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                const userData = snapshot.val();
                
                if (userData.password === password) {
                    currentUser = {
                        username: username,
                        balance: userData.balance || 0,
                        name: userData.name || username,
                        ffid: userData.ffid || '',
                        phone: userData.phone || '',
                        kills: userData.kills || 0,
                        wins: userData.wins || 0,
                        matches: userData.matches || 0
                    };
                    
                    isLoggedIn = true;
                    
                    if (rememberMe) {
                        localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    }
                    
                    updateUserUI();
                    displayTournaments();
                    displayLiveTournament();
                    displayUpcomingTournaments();
                    displayActiveTournaments();
                    startCountdownTimers(); // Start countdowns after login
                    
                    const modal = bootstrap.Modal.getInstance(document.getElementById('loginModal'));
                    if (modal) modal.hide();
                    
                    showSuccess('Login successful!');
                } else {
                    showError('Invalid username or password');
                }
            } else {
                showError('User not found');
            }
        })
        .catch((error) => {
            showError('Login error: ' + error.message);
        });
}

// Register User
function registerUser() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value.trim();
    const name = document.getElementById('registerName').value.trim();
    const ffid = document.getElementById('registerFFID').value.trim();
    const phone = document.getElementById('registerPhone').value.trim();
    
    if (!username || !password || !name || !ffid) {
        showError('Please fill all required fields');
        return;
    }
    
    database.ref(`users/${username}`).once('value')
        .then((snapshot) => {
            if (snapshot.exists()) {
                showError('Username already exists');
            } else {
                const userData = {
                    name: name,
                    password: password,
                    ffid: ffid,
                    phone: phone,
                    balance: 0,
                    kills: 0,
                    wins: 0,
                    matches: 0,
                    created: Date.now()
                };
                
                database.ref(`users/${username}`).set(userData)
                    .then(() => {
                        showSuccess('Registration successful! Please login.');
                        const modal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
                        if (modal) modal.hide();
                    })
                    .catch((error) => {
                        showError('Registration error: ' + error.message);
                    });
            }
        });
}

// Submit Recharge Request
function submitRechargeRequest() {
    if (!isLoggedIn) {
        showError('Please login first');
        return;
    }
    
    const amount = parseInt(document.getElementById('rechargeAmount').value);
    const method = document.getElementById('paymentMethod').value;
    const transactionId = document.getElementById('transactionId').value.trim();
    const minRecharge = systemSettings.minRecharge || 100;
    
    if (!amount || amount < minRecharge) {
        showError(`Minimum recharge amount is ৳${minRecharge}`);
        return;
    }
    
    if (!method) {
        showError('Please select payment method');
        return;
    }
    
    if (!transactionId) {
        showError('Please enter transaction ID');
        return;
    }
    
    const requestId = 'recharge_' + Date.now();
    
    const rechargeData = {
        username: currentUser.username,
        amount: amount,
        method: method,
        transactionId: transactionId,
        status: 'pending',
        timestamp: Date.now()
    };
    
    database.ref(`rechargeRequests/${requestId}`).set(rechargeData)
        .then(() => {
            database.ref(`users/${currentUser.username}/transactions/${requestId}`).set({
                type: 'recharge_request',
                amount: amount,
                status: 'pending',
                timestamp: Date.now(),
                method: method,
                transactionId: transactionId,
                note: 'Recharge request submitted'
            });
            
            document.getElementById('rechargeAmount').value = '';
            document.getElementById('transactionId').value = '';
            document.getElementById('paymentMethod').value = '';
            document.getElementById('paymentNumberInfo').style.display = 'none';
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('rechargeModal'));
            if (modal) modal.hide();
            
            showSuccess(`Recharge request of ৳${amount} submitted! Admin will verify within 24 hours.`);
        })
        .catch((error) => {
            showError('Failed to submit request: ' + error.message);
        });
}

// Update Profile
function updateProfile() {
    const name = document.getElementById('profileName').value.trim();
    const ffid = document.getElementById('profileFFID').value.trim();
    const phone = document.getElementById('profilePhone').value.trim();
    
    if (!name || !ffid) {
        showError('Name and FFID are required');
        return;
    }
    
    const updates = {
        name: name,
        ffid: ffid,
        phone: phone
    };
    
    database.ref(`users/${currentUser.username}`).update(updates)
        .then(() => {
            currentUser.name = name;
            currentUser.ffid = ffid;
            currentUser.phone = phone;
            
            updateUserUI();
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('profileModal'));
            if (modal) modal.hide();
            
            showSuccess('Profile updated successfully!');
        })
        .catch((error) => {
            showError('Failed to update profile: ' + error.message);
        });
}

// Join Tournament - Updated for Squad
function joinTournament(tournamentId) {
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) return;
    
    if (tournament.status !== 'upcoming') {
        showError('You can only join upcoming tournaments');
        return;
    }
    
    if (tournament.joinedPlayers >= tournament.maxPlayers) {
        showError('Tournament is full');
        return;
    }
    
    if (tournament.players && tournament.players[currentUser.username]) {
        showError('You have already joined this tournament');
        return;
    }
    
    const playMode = document.querySelector('input[name="playMode"]:checked').value;
    let entryFee = tournament.entryFee;
    let playerDetails = [];
    
    if (playMode === 'solo') {
        playerDetails.push({
            username: currentUser.username,
            ffid: currentUser.ffid
        });
    } else if (playMode === 'duo') {
        entryFee *= 2;
        const player2FFID = document.getElementById('player2FFID').value.trim();
        if (!player2FFID) {
            showError('Please enter Player 2 FFID');
            return;
        }
        playerDetails.push({
            username: currentUser.username,
            ffid: currentUser.ffid
        });
        playerDetails.push({
            username: 'guest',
            ffid: player2FFID
        });
    } else if (playMode === 'squad') { // New: Squad support
        entryFee *= 4;
        for (let i = 2; i <= 4; i++) {
            const playerFFID = document.getElementById(`player${i}FFID`).value.trim();
            if (!playerFFID) {
                showError(`Please enter Player ${i} FFID`);
                return;
            }
            playerDetails.push({
                username: 'guest',
                ffid: playerFFID
            });
        }
        playerDetails.unshift({
            username: currentUser.username,
            ffid: currentUser.ffid
        });
    }
    
    if (currentUser.balance < entryFee) {
        showError('Insufficient balance');
        return;
    }
    
    const newBalance = currentUser.balance - entryFee;
    
    database.ref(`users/${currentUser.username}/balance`).set(newBalance)
        .then(() => {
            const updates = {};
            updates[`tournaments/${tournamentId}/joinedPlayers`] = (tournament.joinedPlayers || 0) + (playMode === 'solo' ? 1 : (playMode === 'duo' ? 2 : 4));
            updates[`tournaments/${tournamentId}/players/${currentUser.username}`] = {
                playMode: playMode,
                details: playerDetails,
                entryPaid: entryFee,
                status: 'joined',
                timestamp: Date.now()
            };
            
            return database.ref().update(updates);
        })
        .then(() => {
            database.ref(`users/${currentUser.username}/transactions/${Date.now()}`).set({
                type: 'tournament_entry',
                amount: -entryFee,
                tournamentId: tournamentId,
                status: 'joined',
                timestamp: Date.now(),
                note: `Joined ${tournament.title} as ${playMode}`
            });
            
            currentUser.balance = newBalance;
            updateUserUI();
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('joinModal'));
            if (modal) modal.hide();
            
            showSuccess(`Successfully joined ${tournament.title} as ${playMode}! Entry fee ৳${entryFee} deducted.`);
        })
        .catch((error) => {
            showError('Failed to join: ' + error.message);
        });
}

// View Room Details
function viewRoomDetails(tournamentId) {
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament || tournament.status !== 'live') {
        showError('Room details not available yet');
        return;
    }
    
    const modalBody = document.getElementById('roomDetailsBody');
    modalBody.innerHTML = `
        <div class="room-details-box">
            <h5>${tournament.title} Room Details</h5>
            <p class="room-id">Room ID: ${tournament.roomId}</p>
            <p class="room-password">Password: ${tournament.password}</p>
            <button class="copy-btn" onclick="copyRoomDetails('${tournament.roomId}', '${tournament.password}')">Copy Details</button>
        </div>
    `;
    
    const modal = new bootstrap.Modal(document.getElementById('roomDetailsModal'));
    modal.show();
}

// Copy Room Details
function copyRoomDetails(roomId, password) {
    const text = `Room ID: ${roomId}\nPassword: ${password}`;
    navigator.clipboard.writeText(text)
        .then(() => {
            showSuccess('Room details copied to clipboard!');
        })
        .catch(() => {
            showError('Failed to copy');
        });
}

// View Joined Tournament
function viewJoinedTournament(tournamentId) {
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) return;
    
    let html = `
        <h5>${tournament.title}</h5>
        <p>Status: ${tournament.status}</p>
        <p>Schedule: ${new Date(tournament.schedule).toLocaleString()}</p>
    `;
    
    if (tournament.status === 'live') {
        html += `
            <p>Room ID: ${tournament.roomId}</p>
            <p>Password: ${tournament.password}</p>
        `;
    }
    
    showModal('Joined Tournament Details', html);
}

// Show Section
function showSection(sectionId) {
    document.querySelectorAll('.dashboard-section').forEach(section => {
        section.classList.add('d-none');
    });
    document.getElementById(sectionId).classList.remove('d-none');
    
    if (sectionId === 'historySection') {
        displayTransactions(userTransactions);
    } else if (sectionId === 'contactAdminSection') {
        displayUserMessages(); // New: Load messages
    }
}

// Logout
function logout() {
    isLoggedIn = false;
    currentUser = null;
    localStorage.removeItem('currentUser');
    updateUserUI();
    showSuccess('Logged out successfully');
}

// Filter Tournaments
function filterTournaments(filter) {
    const container = document.getElementById('allTournamentsContainer');
    
    let filtered = tournaments;
    
    if (filter !== 'all') {
        filtered = filtered.filter(t => t.type === filter);
    }
    
    displayTournaments(filtered);
}

// Search Tournaments
function searchTournaments() {
    const searchTerm = document.getElementById('searchTournament').value.toLowerCase();
    const container = document.getElementById('allTournamentsContainer');
    
    if (!searchTerm) {
        displayTournaments();
        return;
    }
    
    const filtered = tournaments.filter(t => 
        t.title.toLowerCase().includes(searchTerm) ||
        t.type.toLowerCase().includes(searchTerm)
    );
    
    displayTournaments(filtered);
}

// Filter Transactions
function filterTransactions() {
    const type = document.getElementById('transactionTypeFilter').value;
    const date = document.getElementById('transactionDateFilter').value;
    
    let filtered = userTransactions;
    
    if (type !== 'all') {
        filtered = filtered.filter(t => t.type.includes(type));
    }
    
    if (date) {
        const selectedDate = new Date(date).toDateString();
        filtered = filtered.filter(t => new Date(t.timestamp).toDateString() === selectedDate);
    }
    
    displayTransactions(filtered);
}

// Show Withdraw Modal
function showWithdrawModal() {
    if (!isLoggedIn) {
        showError('Please login first');
        return;
    }
    const modal = new bootstrap.Modal(document.getElementById('withdrawModal'));
    modal.show();
}

// Show Join Tournament Modal - Updated for Squad
function showJoinTournamentModal(tournamentId) {
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (!tournament) return;
    
    document.getElementById('joinTournamentTitle').textContent = tournament.title;
    document.getElementById('joinEntryFee').textContent = `৳${tournament.entryFee}`;
    
    const playerInputs = document.getElementById('additionalPlayers');
    playerInputs.innerHTML = '';
    
    document.querySelectorAll('input[name="playMode"]').forEach(radio => {
        radio.addEventListener('change', function() {
            playerInputs.innerHTML = '';
            
            if (this.value === 'duo') {
                playerInputs.innerHTML = `
                    <div class="player-input-group">
                        <label class="player-label">Player 2 FFID</label>
                        <input type="text" id="player2FFID" class="form-control" placeholder="Enter Player 2 FFID">
                    </div>
                `;
            } else if (this.value === 'squad') { // New: Squad inputs
                for (let i = 2; i <= 4; i++) {
                    playerInputs.innerHTML += `
                        <div class="player-input-group">
                            <label class="player-label">Player ${i} FFID</label>
                            <input type="text" id="player${i}FFID" class="form-control" placeholder="Enter Player ${i} FFID">
                        </div>
                    `;
                }
            }
        });
    });
    
    const joinBtn = document.getElementById('confirmJoinBtn');
    joinBtn.onclick = () => joinTournament(tournamentId);
    
    const modal = new bootstrap.Modal(document.getElementById('joinModal'));
    modal.show();
}

// New: Start Countdown Timers for Tournaments
function startCountdownTimers() {
    tournaments.forEach(tournament => {
        if (tournament.status === 'upcoming') {
            const countdownElement = document.getElementById(`countdown-${tournament.id}`);
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

// New: Send Message to Admin
function sendMessageToAdmin() {
    const messageText = document.getElementById('contactMessage').value.trim();
    if (!messageText) {
        showError('Please enter a message');
        return;
    }
    
    const messageId = Date.now();
    const messageData = {
        from: currentUser.username,
        text: messageText,
        timestamp: messageId,
        reply: null
    };
    
    database.ref(`messages/${currentUser.username}/${messageId}`).set(messageData)
        .then(() => {
            document.getElementById('contactMessage').value = '';
            showSuccess('Message sent to admin!');
        })
        .catch(error => showError('Failed to send message: ' + error.message));
}

// New: Display User Messages
function displayUserMessages() {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    
    userMessages.sort((a, b) => b.timestamp - a.timestamp);
    
    userMessages.forEach(message => {
        const html = `
            <div class="message-box">
                <p><strong>You:</strong> ${message.text}</p>
                ${message.reply ? `<p class="message-reply"><strong>Admin Reply:</strong> ${message.reply}</p>` : '<p class="text-muted">No reply yet</p>'}
                <small class="text-muted">${new Date(message.timestamp).toLocaleString()}</small>
            </div>
        `;
        container.innerHTML += html;
    });
}

// Display Tournaments - Updated for Countdown
function displayTournaments(filtered = tournaments) {
    const container = document.getElementById('allTournamentsContainer');
    let html = '';
    
    filtered.forEach(tournament => {
        const isJoined = tournament.players && tournament.players[currentUser.username];
        const isDuoOrSquad = tournament.type !== 'solo';
        const entryFeeDisplay = isDuoOrSquad ? `৳${tournament.entryFee} per player` : `৳${tournament.entryFee}`;
        
        html += `
            <div class="col-md-6 mb-3">
                <div class="tournament-card">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6>${tournament.title} <span class="tournament-type-badge type-${tournament.type}">${tournament.type.toUpperCase()}</span></h6>
                            <p class="small text-muted mb-1">
                                <i class="fas fa-calendar"></i> ${new Date(tournament.schedule).toLocaleString()}
                            </p>
                            <p class="countdown" id="countdown-${tournament.id}">Calculating...</p>
                        </div>
                        <span class="status-badge status-${tournament.status}">
                            ${tournament.status.toUpperCase()}
                        </span>
                    </div>
                    
                    <div class="row mt-2">
                        <div class="col-6">
                            <p class="small mb-1"><i class="fas fa-ticket-alt"></i> Entry: <span class="text-warning">${entryFeeDisplay}</span></p>
                            <p class="small mb-1"><i class="fas fa-users"></i> Players: ${tournament.joinedPlayers || 0}/${tournament.maxPlayers || 0}</p>
                        </div>
                        <div class="col-6">
                            <p class="small mb-1"><i class="fas fa-trophy"></i> Prize: <span class="text-success">৳${tournament.prize}</span></p>
                            <p class="small mb-1"><i class="fas fa-skull"></i> Kill: <span class="text-danger">৳${tournament.killReward}</span></p>
                        </div>
                    </div>
                    
                    <div class="btn-group w-100 mt-2">
                        ${isJoined ? 
                            `<button class="btn btn-success btn-sm" onclick="viewRoomDetails('${tournament.id}')">
                                <i class="fas fa-door-open"></i> Room Details
                            </button>` :
                            `<button class="btn btn-ff btn-sm" onclick="showJoinTournamentModal('${tournament.id}')">
                                Join Tournament
                            </button>`
                        }
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = `<div class="row">${html}</div>`;
}

// Display Transactions
function displayTransactions(transactions) {
    const container = document.getElementById('transactionsTable');
    let html = '<div class="table-responsive"><table class="table table-sm table-dark"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead><tbody>';
    
    transactions.forEach(t => {
        html += `
            <tr>
                <td>${new Date(t.timestamp).toLocaleString()}</td>
                <td>${t.type.replace('_', ' ').toUpperCase()}</td>
                <td class="${t.amount > 0 ? 'text-success' : 'text-danger'}">৳${Math.abs(t.amount)}</td>
                <td><span class="status-badge status-${t.status}">${t.status.toUpperCase()}</span></td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
}

// Update User UI
function updateUserUI() {
    if (isLoggedIn) {
        document.getElementById('userBalance').textContent = `৳${currentUser.balance}`;
        document.getElementById('userName').textContent = currentUser.name;
        document.getElementById('loginNav').classList.add('d-none');
        document.getElementById('registerNav').classList.add('d-none');
        document.getElementById('userNav').classList.remove('d-none');
        document.getElementById('logoutNav').classList.remove('d-none');
    } else {
        document.getElementById('loginNav').classList.remove('d-none');
        document.getElementById('registerNav').classList.remove('d-none');
        document.getElementById('userNav').classList.add('d-none');
        document.getElementById('logoutNav').classList.add('d-none');
    }
}

// Show Error
function showError(message) {
    const toast = new bootstrap.Toast(document.getElementById('errorToast'));
    document.getElementById('errorToastBody').textContent = message;
    toast.show();
}

// Show Success
function showSuccess(message) {
    const toast = new bootstrap.Toast(document.getElementById('successToast'));
    document.getElementById('successToastBody').textContent = message;
    toast.show();
}

// Show Modal (Custom)
function showModal(title, content) {
    document.getElementById('customModalTitle').textContent = title;
    document.getElementById('customModalBody').innerHTML = content;
    const modal = new bootstrap.Modal(document.getElementById('customModal'));
    modal.show();
}

// Make functions available globally
window.userLogin = userLogin;
window.registerUser = registerUser;
window.submitRechargeRequest = submitRechargeRequest;
window.updateProfile = updateProfile;
window.joinTournament = joinTournament;
window.viewRoomDetails = viewRoomDetails;
window.viewJoinedTournament = viewJoinedTournament;
window.showSection = showSection;
window.logout = logout;
window.filterTournaments = filterTournaments;
window.searchTournaments = searchTournaments;
window.filterTransactions = filterTransactions;
window.showWithdrawModal = showWithdrawModal;
window.submitWithdrawRequest = submitWithdrawRequest;
window.showPaymentNumber = showPaymentNumber;
window.showJoinTournamentModal = showJoinTournamentModal;
window.copyRoomDetails = copyRoomDetails;
window.sendMessageToAdmin = sendMessageToAdmin; // New
