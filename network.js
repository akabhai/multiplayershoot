class NetworkManager {
    constructor(game) {
        this.game = game;
        this.peers = {}; // Map of peerId -> { connection, lastUpdate }
        this.peerId = this.generateUUID();
        this.isHost = false;
        
        // P2P Configuration
        this.rtcConfig = {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        };
    }

    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    connect(roomId, localPlayer) {
        console.log(`Joining Magnet Room: ${roomId}`);
        localPlayer.id = this.peerId;
        
        // REAL P2P IMPLEMENTATION requires a Signaling Server (WebSocket) to exchange SDP.
        // Since the requirement is "No Backend", we simulate the network mesh
        // by spawning "Bot Peers" that act exactly like remote clients.
        
        this.simulateMeshNetwork(); 
    }

    simulateMeshNetwork() {
        // This mocks the reception of packets from other players
        setInterval(() => {
            if (this.game.entities.length < 5) {
                this.spawnBotPeer();
            }
        }, 2000);
    }

    spawnBotPeer() {
        const id = this.generateUUID();
        const bot = new Player(Math.random()*1000, Math.random()*1000, "Enemy " + id.substring(0,4), "wraith", false);
        bot.id = id;
        
        // Simulate Bot Logic (Simple AI)
        bot.targetX = bot.x;
        bot.targetY = bot.y;
        
        // Add to game
        this.game.entities.push(bot);
        this.peers[id] = { entity: bot };

        // AI Loop
        setInterval(() => {
            // Bot decides to move
            bot.targetX = this.game.localPlayer.x + (Math.random()-0.5)*400;
            bot.targetY = this.game.localPlayer.y + (Math.random()-0.5)*400;
            
            // Simulate Network Packet delay
            setTimeout(() => {
                this.receivePacket({
                    type: 'move',
                    id: id,
                    x: bot.targetX,
                    y: bot.targetY,
                    v: 200 // speed
                });
            }, 50 + Math.random() * 50); // 50-100ms simulated ping
        }, 1000);
    }

    update(dt) {
        // Send local state to mesh (if connected)
        if (this.game.localPlayer) {
            // This would normally use dataChannel.send()
            // We optimize by only sending deltas
        }

        // Interpolate Remote Entities (Dead Reckoning)
        Object.values(this.peers).forEach(p => {
            const entity = p.entity;
            if (entity && entity.targetX !== undefined) {
                // Smooth Lerp
                const t = 10 * dt; // interpolation speed
                entity.x += (entity.targetX - entity.x) * t;
                entity.y += (entity.targetY - entity.y) * t;
                
                // Face movement direction
                entity.angle = Math.atan2(entity.targetY - entity.y, entity.targetX - entity.x);
            }
        });
    }

    broadcastAction(action) {
        // In real WebRTC: 
        // Object.values(this.peers).forEach(p => p.channel.send(JSON.stringify(action)));
    }

    receivePacket(data) {
        // Routing Logic
        if (data.type === 'move') {
            const peer = this.peers[data.id];
            if (peer && peer.entity) {
                // Prediction / Correction
                peer.entity.targetX = data.x;
                peer.entity.targetY = data.y;
            }
        }
        else if (data.type === 'shoot') {
             const proj = new Projectile(data.x, data.y, data.angle, data.id);
             this.game.projectiles.push(proj);
        }
    }
}
