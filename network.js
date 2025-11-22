class NetworkManager {
    constructor(game) {
        this.game = game;
        this.botNames = ["Ghost", "Viper", "Reaper", "Spectre", "Nomad", "Ranger", "Zero", "Echo"];
    }

    connect(roomId, localPlayer) {
        console.log(`Joined Room: ${roomId}`);
        document.getElementById('room-id').innerText = `SECTOR: ${roomId.substring(0,8)}`;

        // Start Bot Spawner
        this.spawnBots(15);
        setInterval(() => {
            if(this.game.entities.length < 20) this.spawnBots(1);
        }, 5000);
    }

    spawnBots(count) {
        for(let i=0; i<count; i++) {
            const bx = Math.random() * 4000;
            const by = Math.random() * 4000;
            const name = this.botNames[Math.floor(Math.random() * this.botNames.length)];
            const cls = ['assault', 'sniper', 'tank'][Math.floor(Math.random()*3)];
            
            const bot = new Player(bx, by, name, cls, false);
            bot.inventory[0] = { type: 'ak47', ammo: 999, dmg: 10, rate: 0.1 }; // Give bot gun
            this.game.entities.push(bot);
        }
        document.getElementById('alive-count').innerText = this.game.entities.length;
    }

    update(dt) {
        // Bot Logic Loop
        this.game.entities.forEach(e => {
            if(!e.isLocal && !e.dead) {
                this.updateBotAI(e, dt);
            }
        });
    }

    updateBotAI(bot, dt) {
        // 1. Move towards Zone or Wander
        if(bot.aiTimer <= 0) {
            const zone = this.game.zone;
            const angleToZone = Math.atan2(zone.y - bot.y, zone.x - bot.x);
            const dist = Math.hypot(zone.y - bot.y, zone.x - bot.x);
            
            if(dist > zone.radius * 0.8) {
                // Run to zone
                bot.targetAngle = angleToZone;
            } else {
                // Wander
                bot.targetAngle = (Math.random() * Math.PI * 2);
            }
            bot.aiTimer = 2.0;
        }
        bot.aiTimer -= dt;

        // Move
        bot.x += Math.cos(bot.targetAngle) * 180 * dt;
        bot.y += Math.sin(bot.targetAngle) * 180 * dt;
        bot.angle = bot.targetAngle;

        // 2. Combat
        const target = this.game.localPlayer;
        if(target && !target.dead) {
            const d = Math.hypot(target.x - bot.x, target.y - bot.y);
            if(d < 600) {
                // Aim at player
                bot.angle = Math.atan2(target.y - bot.y, target.x - bot.x);
                // Shoot burst
                if(Math.random() < 0.02) bot.shoot(this.game);
            }
        }
    }
}

// --- ENTITY CLASSES ---

class Entity {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.dead = false;
    }
}

class Player extends Entity {
    constructor(x, y, name, cls, isLocal) {
        super(x, y);
        this.name = name;
        this.class = cls;
        this.isLocal = isLocal;
        
        // Stats
        this.maxHp = cls==='tank' ? 150 : 100;
        this.hp = this.maxHp;
        this.shield = 0;
        this.speed = cls==='scout' ? 350 : 280;
        
        this.angle = 0;
        this.inventory = [null, null]; // 2 Weapon Slots
        this.activeSlot = 0;
        
        this.fireTimer = 0;
        this.shooting = false;
        this.aiTimer = 0;
    }

    update(dt, game) {
        if(this.dead) return;

        if(this.isLocal) {
            // Movement
            let dx=0, dy=0;
            if(game.input.keys['KeyW']) dy = -1;
            if(game.input.keys['KeyS']) dy = 1;
            if(game.input.keys['KeyA']) dx = -1;
            if(game.input.keys['KeyD']) dx = 1;
            
            if(dx||dy) {
                const len = Math.hypot(dx, dy);
                this.x += (dx/len) * this.speed * dt;
                this.y += (dy/len) * this.speed * dt;
            }

            // Aim
            this.angle = Math.atan2(
                (game.input.mouse.y + game.camera.y) - this.y,
                (game.input.mouse.x + game.camera.x) - this.x
            );

            // Shoot
            if(game.input.mouse.down) this.shoot(game);
        }

        // Cooldowns
        this.fireTimer -= dt;
    }

    shoot(game) {
        const wep = this.inventory[this.activeSlot];
        if(!wep || this.fireTimer > 0 || wep.ammo <= 0) {
            // Default pistol if empty
            if(!wep && this.fireTimer <= 0) {
                 this.fireBullet(game, 15, 0.4, 1500); // Pistol stats
                 this.fireTimer = 0.4;
            }
            return;
        }

        wep.ammo--;
        this.fireTimer = wep.rate;
        this.fireBullet(game, wep.dmg, wep.rate, 2000);
        
        // Camera Shake
        if(this.isLocal) game.shake = 5;
    }

    fireBullet(game, dmg, rate, speed) {
        const spread = (Math.random()-0.5) * 0.1;
        game.projectiles.push(new Projectile(this.x, this.y, this.angle + spread, speed, dmg, this));
        this.shooting = true;
        setTimeout(()=>this.shooting=false, 100);
    }

    takeDamage(amount) {
        // Shield first
        if(this.shield > 0) {
            const absorb = Math.min(this.shield, amount);
            this.shield -= absorb;
            amount -= absorb;
        }
        this.hp -= amount;
        
        if(this.hp <= 0 && !this.dead) {
            this.dead = true;
            if(this.isLocal) {
                document.getElementById('end-screen').style.display = 'flex';
            } else {
                // Kill Feed
                const feed = document.getElementById('kill-feed');
                const msg = document.createElement('div');
                msg.innerText = `${this.name} ELIMINATED`;
                msg.style.color = '#ff2a6d';
                feed.prepend(msg);
                setTimeout(()=>msg.remove(), 4000);
            }
        }
    }

    pickup(type) {
        // Simple loot logic
        if(type === 'medkit') { this.hp = Math.min(this.hp+50, this.maxHp); return true; }
        if(type === 'shield') { this.shield = Math.min(this.shield+50, 100); return true; }
        
        // Weapon Data
        const data = {
            'ak47': { dmg: 25, rate: 0.1, ammo: 30 },
            'm416': { dmg: 20, rate: 0.08, ammo: 40 },
            'sniper': { dmg: 90, rate: 1.5, ammo: 5 },
            'shotgun': { dmg: 15, rate: 0.8, ammo: 8, pellets: 5 }
        }[type];

        if(data) {
            this.inventory[this.activeSlot] = { type, ...data };
            return true;
        }
        return false;
    }
    
    switchWeapon(idx) { this.activeSlot = idx; }

    updateHUD() {
        // Sync HTML UI
        const hpPct = (this.hp / this.maxHp) * 100;
        document.getElementById('hp-bar').style.width = `${hpPct}%`;
        document.getElementById('hp-text').innerText = Math.ceil(this.hp);
        
        const shPct = this.shield;
        document.getElementById('shield-bar').style.width = `${shPct}%`;
        document.getElementById('shield-text').innerText = Math.ceil(this.shield);

        // Weapon
        const wep = this.inventory[this.activeSlot];
        const slotEl = document.getElementById('slot-1'); // Simplified for demo
        if(wep) {
            slotEl.querySelector('.wep-name').innerText = wep.type.toUpperCase();
            slotEl.querySelector('.ammo-count').innerText = wep.ammo;
        } else {
            slotEl.querySelector('.wep-name').innerText = "PISTOL";
            slotEl.querySelector('.ammo-count').innerText = "∞";
        }
    }

    draw(ctx) {
        if(this.dead) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Character Circle
        ctx.fillStyle = this.isLocal ? '#00f3ff' : '#ff2a6d';
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI*2);
        ctx.fill();

        // Hands / Gun
        ctx.fillStyle = '#333';
        ctx.fillRect(10, -5, 25, 10); // Gun barrel

        // Helmet Detail
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath(); ctx.arc(3, 0, 8, 0, Math.PI*2); ctx.fill();

        ctx.restore();

        // Nameplate
        if(!this.isLocal) {
            ctx.fillStyle = '#fff';
            ctx.font = '10px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, this.x, this.y - 30);
            // Enemy HP Bar
            ctx.fillStyle = 'red'; ctx.fillRect(this.x-15, this.y-25, 30, 3);
            ctx.fillStyle = '#0f0'; ctx.fillRect(this.x-15, this.y-25, 30*(this.hp/this.maxHp), 3);
        }
    }
}

class Projectile {
    constructor(x, y, angle, speed, dmg, owner) {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.damage = dmg;
        this.owner = owner;
        this.life = 1.5;
        this.remove = false;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        if(this.life <= 0) this.remove = true;

        // Collision Check
        if(this.owner.isLocal) {
            // Check vs Bots
            const game = this.owner.game || window.game; // Hacky access
            // (In a real engine, pass game ref properly)
        }
    }

    draw(ctx) {
        ctx.strokeStyle = '#ffaa00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.vx*0.04, this.y - this.vy*0.04);
        ctx.stroke();
    }
}

class Loot extends Entity {
    constructor(x, y, type) {
        super(x, y);
        this.type = type;
        this.float = 0;
    }
    draw(ctx) {
        this.float += 0.1;
        ctx.fillStyle = '#fcee0a';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.type.toUpperCase(), this.x, this.y - 10 + Math.sin(this.float)*5);
        
        ctx.fillStyle = 'rgba(252, 238, 10, 0.3)';
        ctx.beginPath(); ctx.arc(this.x, this.y, 10, 0, Math.PI*2); ctx.fill();
    }
}

class Tree extends Entity {
    constructor(x, y) {
        super(x, y);
        this.h = 120; // Height for sorting
    }
    draw(ctx) {
        // 2.5D Tree Projection
        const topY = this.y - 120;
        
        // Trunk
        ctx.fillStyle = '#3e2723';
        ctx.fillRect(this.x - 8, topY + 80, 16, 40);
        
        // Leaves (Circle Cluster)
        ctx.fillStyle = '#2e7d32';
        ctx.beginPath(); ctx.arc(this.x, topY + 40, 40, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#388e3c';
        ctx.beginPath(); ctx.arc(this.x - 10, topY + 30, 30, 0, Math.PI*2); ctx.fill();
    }
}

class Building extends Entity {
    constructor(x, y, w, h) {
        super(x, y);
        this.w = w; this.h = h;
    }
    draw(ctx) {
        // Simple Roof Render
        ctx.fillStyle = '#263238';
        ctx.fillRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);
        ctx.strokeStyle = '#37474f';
        ctx.lineWidth = 5;
        ctx.strokeRect(this.x - this.w/2, this.y - this.h/2, this.w, this.h);
    }
}
