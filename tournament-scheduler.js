// Tournament Status Auto Management System
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, get, update, push, onValue } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

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

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

class TournamentScheduler {
    constructor() {
        this.tournaments = [];
        this.activeIntervals = new Map();
        this.initialize();
    }

    async initialize() {
        console.log('🎮 Tournament Scheduler Initialized');
        await this.loadTournaments();
        this.setupRealtimeListener();
        this.startAutoScheduler();
    }

    async loadTournaments() {
        try {
            const tournamentsRef = ref(database, 'tournaments');
            const snapshot = await get(tournamentsRef);
            
            if (snapshot.exists()) {
                snapshot.forEach((childSnapshot) => {
                    const tournament = childSnapshot.val();
                    tournament.id = childSnapshot.key;
                    this.tournaments.push(tournament);
                    this.scheduleTournament(tournament);
                });
                console.log(`Loaded ${this.tournaments.length} tournaments`);
            }
        } catch (error) {
            console.error('Error loading tournaments:', error);
        }
    }

    setupRealtimeListener() {
        const tournamentsRef = ref(database, 'tournaments');
        
        onValue(tournamentsRef, (snapshot) => {
            this.tournaments = [];
            snapshot.forEach((childSnapshot) => {
                const tournament = childSnapshot.val();
                tournament.id = childSnapshot.key;
                this.tournaments.push(tournament);
            });
            
            // Clear existing intervals
            this.activeIntervals.forEach(interval => clearInterval(interval));
            this.activeIntervals.clear();
            
            // Schedule all tournaments
            this.tournaments.forEach(tournament => {
                this.scheduleTournament(tournament);
            });
        });
    }

    scheduleTournament(tournament) {
        if (!tournament.schedule || tournament.status === 'completed') {
            return;
        }

        const scheduleTime = new Date(tournament.schedule).getTime();
        const now = Date.now();
        const timeUntilStart = scheduleTime - now;

        // Schedule status updates
        this.scheduleStatusUpdates(tournament, scheduleTime);
        
        // If tournament should already be live or completed
        if (tournament.status === 'upcoming' && timeUntilStart <= 0) {
            this.updateToLive(tournament.id);
        }
        
        if (tournament.status === 'live') {
            const endTime = scheduleTime + (2 * 60 * 60 * 1000); // 2 hours after start
            if (now >= endTime) {
                this.completeTournament(tournament.id);
            } else {
                this.scheduleCompletion(tournament.id, endTime);
            }
        }
    }

    scheduleStatusUpdates(tournament, scheduleTime) {
        const tournamentId = tournament.id;
        const now = Date.now();
        const timeUntilStart = scheduleTime - now;

        // Clear existing interval for this tournament
        if (this.activeIntervals.has(tournamentId)) {
            clearInterval(this.activeIntervals.get(tournamentId));
            this.activeIntervals.delete(tournamentId);
        }

        if (tournament.status === 'upcoming' && timeUntilStart > 0) {
            // Schedule to go live 10 minutes before start
            const goLiveTime = scheduleTime - (10 * 60 * 1000);
            const timeUntilGoLive = goLiveTime - now;

            if (timeUntilGoLive > 0) {
                setTimeout(() => {
                    this.updateToLive(tournamentId);
                }, timeUntilGoLive);
            }

            // Schedule completion (2 hours after start)
            const completionTime = scheduleTime + (2 * 60 * 60 * 1000);
            const timeUntilCompletion = completionTime - now;

            if (timeUntilCompletion > 0) {
                setTimeout(() => {
                    this.completeTournament(tournamentId);
                }, timeUntilCompletion);
            }

            // Start interval checking every minute
            const intervalId = setInterval(() => {
                this.checkTournamentStatus(tournamentId);
            }, 60000); // Check every minute

            this.activeIntervals.set(tournamentId, intervalId);
        }
    }

    async checkTournamentStatus(tournamentId) {
        try {
            const tournamentRef = ref(database, `tournaments/${tournamentId}`);
            const snapshot = await get(tournamentRef);
            
            if (snapshot.exists()) {
                const tournament = snapshot.val();
                const scheduleTime = new Date(tournament.schedule).getTime();
                const now = Date.now();

                if (tournament.status === 'upcoming') {
                    // Check if should go live (10 minutes before)
                    const goLiveTime = scheduleTime - (10 * 60 * 1000);
                    if (now >= goLiveTime) {
                        await this.updateToLive(tournamentId);
                    }
                } else if (tournament.status === 'live') {
                    // Check if should complete (2 hours after start)
                    const completionTime = scheduleTime + (2 * 60 * 60 * 1000);
                    if (now >= completionTime) {
                        await this.completeTournament(tournamentId);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking tournament status:', error);
        }
    }

    async updateToLive(tournamentId) {
        try {
            const tournamentRef = ref(database, `tournaments/${tournamentId}`);
            const snapshot = await get(tournamentRef);
            
            if (snapshot.exists()) {
                const tournament = snapshot.val();
                
                // Only update if currently upcoming
                if (tournament.status === 'upcoming') {
                    await update(tournamentRef, {
                        status: 'live',
                        roomId: tournament.roomId || this.generateRoomId(),
                        password: tournament.password || this.generatePassword(),
                        liveAt: Date.now()
                    });

                    // Send notifications to joined players
                    await this.notifyPlayers(tournamentId, 'live');
                    
                    console.log(`🎮 Tournament ${tournamentId} is now LIVE`);
                    
                    // Log activity
                    await this.logActivity(`Tournament "${tournament.title}" is now LIVE`);
                }
            }
        } catch (error) {
            console.error('Error updating to live:', error);
        }
    }

    async completeTournament(tournamentId) {
        try {
            const tournamentRef = ref(database, `tournaments/${tournamentId}`);
            const snapshot = await get(tournamentRef);
            
            if (snapshot.exists()) {
                const tournament = snapshot.val();
                
                // Only update if currently live
                if (tournament.status === 'live') {
                    // Calculate results and distribute prizes
                    await this.calculateResults(tournamentId);
                    
                    // Update status to completed
                    await update(tournamentRef, {
                        status: 'completed',
                        completedAt: Date.now()
                    });

                    // Send notifications to players
                    await this.notifyPlayers(tournamentId, 'completed');
                    
                    console.log(`🏆 Tournament ${tournamentId} completed`);
                    
                    // Log activity
                    await this.logActivity(`Tournament "${tournament.title}" completed`);
                    
                    // Clear interval for this tournament
                    if (this.activeIntervals.has(tournamentId)) {
                        clearInterval(this.activeIntervals.get(tournamentId));
                        this.activeIntervals.delete(tournamentId);
                    }
                }
            }
        } catch (error) {
            console.error('Error completing tournament:', error);
        }
    }

    async calculateResults(tournamentId) {
        try {
            const playersRef = ref(database, `tournaments/${tournamentId}/players`);
            const snapshot = await get(playersRef);
            
            if (snapshot.exists()) {
                const players = [];
                snapshot.forEach((childSnapshot) => {
                    const player = childSnapshot.val();
                    player.username = childSnapshot.key;
                    players.push(player);
                });

                // Sort by kills (descending)
                players.sort((a, b) => (b.kills || 0) - (a.kills || 0));

                // Get tournament details
                const tournamentRef = ref(database, `tournaments/${tournamentId}`);
                const tournamentSnap = await get(tournamentRef);
                const tournament = tournamentSnap.val();

                // Distribute prizes
                const winners = [];
                
                if (players.length >= 1) {
                    // 1st prize
                    winners.push({
                        username: players[0].username,
                        position: 1,
                        prize: tournament.prize,
                        kills: players[0].kills || 0
                    });
                    
                    // Add kill rewards
                    const killReward = (players[0].kills || 0) * tournament.killReward;
                    await this.addUserBalance(players[0].username, tournament.prize + killReward);
                }

                if (players.length >= 2) {
                    // 2nd prize (50% of 1st)
                    const secondPrize = tournament.prize * 0.5;
                    winners.push({
                        username: players[1].username,
                        position: 2,
                        prize: secondPrize,
                        kills: players[1].kills || 0
                    });
                    
                    const killReward = (players[1].kills || 0) * tournament.killReward;
                    await this.addUserBalance(players[1].username, secondPrize + killReward);
                }

                if (players.length >= 3) {
                    // 3rd prize (25% of 1st)
                    const thirdPrize = tournament.prize * 0.25;
                    winners.push({
                        username: players[2].username,
                        position: 3,
                        prize: thirdPrize,
                        kills: players[2].kills || 0
                    });
                    
                    const killReward = (players[2].kills || 0) * tournament.killReward;
                    await this.addUserBalance(players[2].username, thirdPrize + killReward);
                }

                // Add kill rewards for all players
                players.forEach(player => {
                    if (player.kills && player.kills > 0) {
                        const killReward = player.kills * tournament.killReward;
                        this.addUserBalance(player.username, killReward);
                    }
                });

                // Save results
                const resultsRef = ref(database, `tournaments/${tournamentId}/results`);
                await update(resultsRef, {
                    winners: winners,
                    totalPlayers: players.length,
                    calculatedAt: Date.now()
                });
            }
        } catch (error) {
            console.error('Error calculating results:', error);
        }
    }

    async addUserBalance(username, amount) {
        try {
            const userRef = ref(database, `users/${username}`);
            const snapshot = await get(userRef);
            
            if (snapshot.exists()) {
                const user = snapshot.val();
                const newBalance = (user.balance || 0) + amount;
                
                await update(userRef, {
                    balance: newBalance
                });

                // Add transaction record
                const transactionRef = ref(database, `users/${username}/transactions/${Date.now()}`);
                await update(transactionRef, {
                    type: 'tournament_winning',
                    amount: amount,
                    timestamp: Date.now(),
                    status: 'completed'
                });
            }
        } catch (error) {
            console.error('Error adding user balance:', error);
        }
    }

    async notifyPlayers(tournamentId, status) {
        try {
            const playersRef = ref(database, `tournaments/${tournamentId}/players`);
            const snapshot = await get(playersRef);
            
            if (snapshot.exists()) {
                const players = [];
                snapshot.forEach((childSnapshot) => {
                    players.push(childSnapshot.key);
                });

                // Add notifications for each player
                players.forEach(async (username) => {
                    const notificationRef = ref(database, `notifications/${username}/${Date.now()}`);
                    let message = '';
                    
                    if (status === 'live') {
                        message = '🎮 Tournament is now LIVE! Check room details.';
                    } else if (status === 'completed') {
                        message = '🏆 Tournament completed! Check your results and winnings.';
                    }
                    
                    await update(notificationRef, {
                        message: message,
                        type: status,
                        tournamentId: tournamentId,
                        timestamp: Date.now(),
                        read: false
                    });
                });
            }
        } catch (error) {
            console.error('Error notifying players:', error);
        }
    }

    async logActivity(message) {
        try {
            const activityRef = ref(database, `activities/${Date.now()}`);
            await update(activityRef, {
                message: message,
                timestamp: Date.now(),
                type: 'system'
            });
        } catch (error) {
            console.error('Error logging activity:', error);
        }
    }

    generateRoomId() {
        return Math.floor(100000000 + Math.random() * 900000000).toString();
    }

    generatePassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let password = '';
        for (let i = 0; i < 6; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    startAutoScheduler() {
        // Run every 30 seconds to check tournaments
        setInterval(() => {
            this.tournaments.forEach(tournament => {
                if (tournament.status !== 'completed') {
                    this.checkTournamentStatus(tournament.id);
                }
            });
        }, 30000); // 30 seconds
    }
}

// Start the scheduler
window.tournamentScheduler = new TournamentScheduler();
