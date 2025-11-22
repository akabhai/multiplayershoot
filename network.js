class NetworkManager {
    constructor(game) {
        this.game = game;
        this.peers = {};
    }

    connect(roomId, localPlayer) {
        // Simulate adding bots for single-player test
        setInterval(() => {
            if (this.game.entities.length < 4) {
                this.spawnBot();
            }
        }, 3000);
    }

    spawnBot() {
        const id = Math.random().toString(36).substring(7);
        const bot = new Player(Math.random()*1000, Math.random()*1000, "Bot-" + id, Math.random()>0.5?'titan':'wraith', false);
        bot.id = id;
        bot.targetX = bot.x; 
        bot.targetY = bot.y;
        this.game.entities.push(bot);
        this.peers[id] = bot;
    }

    update(dt) {
        // Simulate AI Movement
        Object.values(this.peers).forEach(bot => {
            // Random destination logic
            if(Math.random() < 0.02) {
                bot.targetX = this.game.localPlayer.x + (Math.random()-0.5)*500;
                bot.targetY = this.game.localPlayer.y + (Math.random()-0.5)*500;
            }

            // Move bot
            const dx = bot.targetX - bot.x;
            const dy = bot.targetY - bot.y;
            const dist = Math.hypot(dx, dy);
            
            if(dist > 10) {
                bot.move(dx/dist, dy/dist, dt, this.game.mapBlocks);
            }
            
            // Bot shoots sometimes
            if(Math.random() < 0.01) bot.attack(this.game);
        });
    }
}
