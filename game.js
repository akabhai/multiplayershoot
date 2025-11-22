// GAME CONSTANTS
const TILE_SIZE = 64;
const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.entities = [];
        this.particles = [];
        this.projectiles = [];
        this.localPlayer = null;
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.lastTime = 0;
        this.assets = {};
        
        // Modules
        this.network = new NetworkManager(this);
        this.magnet = new MagnetRoom();

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // Input Handling
        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);
        window.addEventListener('mousemove', e => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        window.addEventListener('mousedown', () => this.useAbility(0)); // Basic attack

        // UI Listeners
        document.getElementById('btn-start').onclick = () => this.startGame();
        
        const heroBtns = document.querySelectorAll('.hero-btn');
        heroBtns.forEach(b => b.onclick = (e) => {
            heroBtns.forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
        });

        this.loop(0);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    startGame() {
        const name = document.getElementById('player-name').value;
        const heroType = document.querySelector('.hero-btn.active').dataset.hero;
        const isStreamer = document.getElementById('streamer-mode').checked;

        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('hud').style.display = 'block';

        // Initialize Local Player
        this.localPlayer = new Player(Math.random() * WORLD_WIDTH, Math.random() * WORLD_HEIGHT, name, heroType, true);
        this.entities.push(this.localPlayer);

        // Initialize Network (Connect to magnet room)
        this.network.connect(this.magnet.currentRoomId, this.localPlayer);
        
        // Save settings
        localStorage.setItem('aether_config', JSON.stringify({ name, heroType, isStreamer }));
    }

    useAbility(index) {
        if (!this.localPlayer) return;
        this.localPlayer.castAbility(index, this);
    }

    loop(timestamp) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (this.localPlayer) {
            this.update(dt);
            this.render();
        }

        requestAnimationFrame(t => this.loop(t));
    }

    update(dt) {
        // Input to Velocity
        if (this.localPlayer) {
            let dx = 0, dy = 0;
            if (this.keys['KeyW']) dy -= 1;
            if (this.keys['KeyS']) dy += 1;
            if (this.keys['KeyA']) dx -= 1;
            if (this.keys['KeyD']) dx += 1;

            // Camera World Pos
            const camX = this.camera.x + this.mouse.x;
            const camY = this.camera.y + this.mouse.y;
            
            // Calculate Angle
            this.localPlayer.angle = Math.atan2(
                (this.mouse.y + this.camera.y) - this.localPlayer.y,
                (this.mouse.x + this.camera.x) - this.localPlayer.x
            );

            this.localPlayer.move(dx, dy, dt);
        }

        // Update Network
        this.network.update(dt);

        // Update Physics & Entities
        this.entities.forEach(e => e.update(dt, this));
        this.projectiles.forEach((p, i) => {
            p.update(dt);
            if (p.life <= 0) this.projectiles.splice(i, 1);
        });
        this.particles.forEach((p, i) => {
            p.update(dt);
            if (p.life <= 0) this.particles.splice(i, 1);
        });

        // Camera Follow (Smooth)
        if (this.localPlayer) {
            const targetX = this.localPlayer.x - this.canvas.width / 2;
            const targetY = this.localPlayer.y - this.canvas.height / 2;
            this.camera.x += (targetX - this.camera.x) * 5 * dt;
            this.camera.y += (targetY - this.camera.y) * 5 * dt;
        }
        
        // UI Updates
        if(this.localPlayer) {
            document.getElementById('hp-bar').style.width = `${(this.localPlayer.hp / this.localPlayer.maxHp)*100}%`;
        }
    }

    render() {
        const ctx = this.ctx;
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        ctx.translate(-this.camera.x, -this.camera.y);

        // Draw Floor Grid (Parallax Illusion)
        this.drawGrid(ctx);

        // Sort for pseudo-3D depth
        const renderList = [...this.entities, ...this.projectiles].sort((a, b) => a.y - b.y);

        // Shadows first
        renderList.forEach(e => this.drawShadow(ctx, e));
        
        // Entities
        renderList.forEach(e => e.draw(ctx));

        // VFX
        ctx.globalCompositeOperation = 'screen';
        this.particles.forEach(p => p.draw(ctx));
        ctx.globalCompositeOperation = 'source-over';

        ctx.restore();
    }

    drawGrid(ctx) {
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        const startX = Math.floor(this.camera.x / TILE_SIZE) * TILE_SIZE;
        const startY = Math.floor(this.camera.y / TILE_SIZE) * TILE_SIZE;
        
        for(let x = startX; x < startX + this.canvas.width + TILE_SIZE; x += TILE_SIZE) {
            for(let y = startY; y < startY + this.canvas.height + TILE_SIZE; y += TILE_SIZE) {
                ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
            }
        }
    }

    drawShadow(ctx, e) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(e.x, e.y + 10, e.radius, e.radius * 0.4, 0, 0, Math.PI*2);
        ctx.fill();
    }

    addParticle(x, y, color, speed) {
        this.particles.push(new Particle(x, y, color, speed));
    }
}

// --- ENTITY CLASSES ---

class Entity {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.radius = 20;
    }
}

class Player extends Entity {
    constructor(x, y, name, type, isLocal) {
        super(x, y);
        this.name = name;
        this.type = type;
        this.isLocal = isLocal;
        this.angle = 0;
        this.hp = 100; this.maxHp = 100;
        this.speed = 300;
        this.cooldowns = [0,0,0,0];
    }

    move(dx, dy, dt) {
        // Physics Movement
        if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            this.vx = (dx / len) * this.speed;
            this.vy = (dy / len) * this.speed;
        } else {
            this.vx *= 0.9; // Friction
            this.vy *= 0.9;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;
        
        // World Bounds
        this.x = Math.max(0, Math.min(WORLD_WIDTH, this.x));
        this.y = Math.max(0, Math.min(WORLD_HEIGHT, this.y));
    }

    update(dt) {
        // Cooldown tick
        this.cooldowns = this.cooldowns.map(c => Math.max(0, c - dt));
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Body
        ctx.fillStyle = this.isLocal ? '#00f3ff' : '#ff0055';
        ctx.beginPath();
        ctx.rect(-15, -15, 30, 30);
        ctx.fill();
        
        // Glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = ctx.fillStyle;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Direction
        ctx.fillStyle = '#fff';
        ctx.fillRect(15, -2, 10, 4);

        ctx.restore();

        // Nameplate (3D offset)
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x, this.y - 40);
        
        // Health Bar
        ctx.fillStyle = '#333';
        ctx.fillRect(this.x - 20, this.y - 35, 40, 5);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(this.x - 20, this.y - 35, 40 * (this.hp/this.maxHp), 5);
    }

    castAbility(index, game) {
        if (this.cooldowns[index] > 0) return;

        // Mock Ability System
        if (index === 0) { // Plasma Shot
            const proj = new Projectile(this.x, this.y, this.angle, this.id);
            game.projectiles.push(proj);
            game.network.broadcastAction({ type: 'shoot', x: this.x, y: this.y, angle: this.angle });
            this.cooldowns[index] = 0.2;
        }
    }
}

class Projectile extends Entity {
    constructor(x, y, angle, ownerId) {
        super(x, y);
        this.vx = Math.cos(angle) * 800;
        this.vy = Math.sin(angle) * 800;
        this.life = 2; // Seconds
        this.owner = ownerId;
        this.radius = 5;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }

    draw(ctx) {
        ctx.fillStyle = '#ffaa00';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffaa00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 5, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Particle {
    constructor(x, y, color, speed) {
        this.x = x; this.y = y;
        this.vx = (Math.random() - 0.5) * speed;
        this.vy = (Math.random() - 0.5) * speed;
        this.life = 1.0;
        this.color = color;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }
    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 3, 3);
        ctx.globalAlpha = 1.0;
    }
}

// Start game
window.onload = () => new Game();
