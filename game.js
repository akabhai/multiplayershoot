// 2.5D ENGINE CONSTANTS
const BLOCK_SIZE = 60;
const MAP_W = 30;
const MAP_H = 30;

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        
        this.renderList = []; // The Z-buffer array
        this.entities = [];
        this.projectiles = [];
        this.particles = [];
        this.mapBlocks = [];
        
        this.localPlayer = null;
        this.network = new NetworkManager(this);
        this.magnet = new MagnetRoom();
        
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('keydown', e => this.keys[e.code] = true);
        window.addEventListener('keyup', e => this.keys[e.code] = false);
        window.addEventListener('mousemove', e => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        window.addEventListener('mousedown', () => {
            if(this.localPlayer) this.localPlayer.attack(this);
        });

        document.getElementById('btn-start').onclick = () => this.startGame();
        
        // Select Hero Logic
        document.querySelectorAll('.hero-card').forEach(c => {
            c.onclick = () => {
                document.querySelectorAll('.hero-card').forEach(x => x.classList.remove('active'));
                c.classList.add('active');
            }
        });

        this.generateMap();
        this.loop(0);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    generateMap() {
        // Generate a procedural arena with pillars
        for(let x=0; x<MAP_W; x++) {
            for(let y=0; y<MAP_H; y++) {
                // Edges
                if(x===0 || x===MAP_W-1 || y===0 || y===MAP_H-1) {
                    this.mapBlocks.push(new Block(x*BLOCK_SIZE, y*BLOCK_SIZE, 80, '#333'));
                }
                // Random Pillars
                else if(Math.random() < 0.05) {
                    const h = 40 + Math.random() * 60;
                    this.mapBlocks.push(new Block(x*BLOCK_SIZE, y*BLOCK_SIZE, h, '#445'));
                }
            }
        }
    }

    startGame() {
        const name = document.getElementById('player-name').value;
        const type = document.querySelector('.hero-card.active').dataset.hero;
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('hud').style.display = 'block';

        // Spawn Center
        const cx = (MAP_W * BLOCK_SIZE) / 2;
        const cy = (MAP_H * BLOCK_SIZE) / 2;
        
        this.localPlayer = new Player(cx, cy, name, type, true);
        this.entities.push(this.localPlayer);
        this.network.connect(this.magnet.currentRoomId, this.localPlayer);
    }

    loop(ts) {
        const dt = Math.min((ts - (this.lastTime||ts))/1000, 0.1);
        this.lastTime = ts;

        if(this.localPlayer) {
            this.update(dt);
            this.render();
        }
        requestAnimationFrame(t => this.loop(t));
    }

    update(dt) {
        // Player Input
        if(this.localPlayer) {
            let dx=0, dy=0;
            if(this.keys['KeyW']) dy = -1;
            if(this.keys['KeyS']) dy = 1;
            if(this.keys['KeyA']) dx = -1;
            if(this.keys['KeyD']) dx = 1;
            
            this.localPlayer.move(dx, dy, dt, this.mapBlocks);
            
            // Camera Follow (Smooth)
            this.camera.x += (this.localPlayer.x - this.canvas.width/2 - this.camera.x) * 0.1;
            this.camera.y += (this.localPlayer.y - this.canvas.height/2 - this.camera.y) * 0.1;
        }

        // Entities
        this.entities.forEach(e => e.update(dt));
        this.network.update(dt); // Bot simulation
        
        // Projectiles
        for(let i=this.projectiles.length-1; i>=0; i--) {
            let p = this.projectiles[i];
            p.update(dt);
            if(p.life <= 0) this.projectiles.splice(i, 1);
        }

        // Particles
        for(let i=this.particles.length-1; i>=0; i--) {
            this.particles[i].update(dt);
            if(this.particles[i].life <= 0) this.particles.splice(i, 1);
        }
    }

    render() {
        const ctx = this.ctx;
        // Clear & Background
        ctx.fillStyle = '#0a0b10';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        // Camera Transform
        ctx.translate(-Math.floor(this.camera.x), -Math.floor(this.camera.y));

        // Draw Grid Floor
        this.drawFloor(ctx);

        // 1. COLLECT RENDERABLES
        // We put everything into a list to sort by Y (Depth)
        this.renderList = [];

        // Blocks
        this.mapBlocks.forEach(b => {
            // Culling: Only draw if on screen
            if(this.isOnScreen(b.x, b.y, BLOCK_SIZE)) {
                this.renderList.push({ type: 'block', obj: b, y: b.y + BLOCK_SIZE, z: 0 });
            }
        });

        // Entities
        this.entities.forEach(e => {
            this.renderList.push({ type: 'entity', obj: e, y: e.y, z: e.z });
        });

        // Projectiles
        this.projectiles.forEach(p => {
            this.renderList.push({ type: 'proj', obj: p, y: p.y, z: p.z });
        });

        // 2. DEPTH SORT
        // Sort by Bottom Y coordinate. 
        this.renderList.sort((a, b) => a.y - b.y);

        // 3. DRAW LOOP
        this.renderList.forEach(item => {
            if(item.type === 'block') item.obj.draw(ctx);
            else if(item.type === 'entity') item.obj.draw(ctx);
            else if(item.type === 'proj') item.obj.draw(ctx);
        });

        // 4. OVERLAY VFX (No depth sort needed, always on top)
        ctx.globalCompositeOperation = 'screen';
        this.particles.forEach(p => p.draw(ctx));
        ctx.globalCompositeOperation = 'source-over';

        ctx.restore();
        
        // UI Sync
        if(this.localPlayer) {
            const hpPct = (this.localPlayer.hp / this.localPlayer.maxHp)*100;
            document.getElementById('hp-bar').style.width = `${hpPct}%`;
        }
    }

    drawFloor(ctx) {
        ctx.strokeStyle = '#1a1b20';
        ctx.lineWidth = 1;
        const startX = Math.floor(this.camera.x / BLOCK_SIZE) * BLOCK_SIZE;
        const startY = Math.floor(this.camera.y / BLOCK_SIZE) * BLOCK_SIZE;
        const w = this.canvas.width + BLOCK_SIZE;
        const h = this.canvas.height + BLOCK_SIZE;

        ctx.beginPath();
        for(let x = startX; x < startX + w; x += BLOCK_SIZE) {
            ctx.moveTo(x, startY); ctx.lineTo(x, startY+h);
        }
        for(let y = startY; y < startY + h; y += BLOCK_SIZE) {
            ctx.moveTo(startX, y); ctx.lineTo(startX+w, y);
        }
        ctx.stroke();
    }
    
    isOnScreen(x, y, size) {
        return x + size > this.camera.x && x < this.camera.x + this.canvas.width &&
               y + size > this.camera.y && y < this.camera.y + this.canvas.height;
    }
}

// --- 2.5D PRIMITIVES ---

// Static Map Block
class Block {
    constructor(x, y, h, color) {
        this.x = x; this.y = y;
        this.w = BLOCK_SIZE; this.h = BLOCK_SIZE;
        this.height = h; // Z-height
        this.color = color;
        
        // Pre-calc colors for 3D effect
        this.topColor = lighten(color, 20);
        this.sideColor = darken(color, 20);
        this.frontColor = color;
    }

    draw(ctx) {
        // 2.5D Projection: y is ground level. z moves UP (negative screen y)
        const screenX = this.x;
        const screenY = this.y; 
        const z = this.height;

        // 1. Front Face (facing camera)
        ctx.fillStyle = this.frontColor;
        ctx.fillRect(screenX, screenY + this.h - z, this.w, z);

        // 2. Top Face (lid)
        ctx.fillStyle = this.topColor;
        ctx.fillRect(screenX, screenY - z, this.w, this.h);
        
        // 3. Border/Detail
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.strokeRect(screenX, screenY - z, this.w, this.h);
    }
}

class Entity {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.z = 0; // Height from ground
        this.vx = 0; this.vy = 0; this.vz = 0;
        this.radius = 20;
    }
}

class Player extends Entity {
    constructor(x, y, name, type, isLocal) {
        super(x, y);
        this.name = name;
        this.type = type; // 'titan' or 'wraith'
        this.isLocal = isLocal;
        this.hp = 100; this.maxHp = 100;
        this.speed = 250;
        this.animTimer = 0;
    }

    move(dx, dy, dt, blocks) {
        // Simple Physics
        if(dx||dy) {
            const len = Math.hypot(dx, dy);
            this.vx = (dx/len)*this.speed;
            this.vy = (dy/len)*this.speed;
        } else {
            this.vx *= 0.8; this.vy *= 0.8;
        }

        const nextX = this.x + this.vx * dt;
        const nextY = this.y + this.vy * dt;

        // Block Collision (Simple AABB)
        if(!this.checkCollisions(nextX, this.y, blocks)) this.x = nextX;
        if(!this.checkCollisions(this.x, nextY, blocks)) this.y = nextY;
    }

    checkCollisions(x, y, blocks) {
        // Collision simplified to bounding box center
        for(let b of blocks) {
            if(x > b.x && x < b.x+b.w && y > b.y && y < b.y+b.h) return true;
        }
        return false;
    }

    update(dt) {
        this.animTimer += dt * 5;
    }

    draw(ctx) {
        // 2.5D Rendering of Character
        
        // Shadow (Ground level)
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, 15, 8, 0, 0, Math.PI*2);
        ctx.fill();

        // Calculate Screen Position with "Bobbing" animation
        const bob = Math.sin(this.animTimer) * 2;
        const screenY = this.y - this.z - 10 - bob; 
        
        // Determine Color
        const color = this.isLocal ? '#00f3ff' : '#ff0055';
        
        if(this.type === 'titan') {
            // TITAN: Cube-like heavy mech
            drawPrism(ctx, this.x - 15, screenY - 40, 30, 30, 40, color);
        } else {
            // WRAITH: Cylinder-like fast unit
            drawCylinder(ctx, this.x, screenY, 12, 35, color);
        }

        // Nameplate (Floating 3D text)
        ctx.fillStyle = '#fff';
        ctx.font = '11px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x, screenY - 55);
        
        // Health
        ctx.fillStyle = '#222';
        ctx.fillRect(this.x - 15, screenY - 50, 30, 4);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(this.x - 15, screenY - 50, 30 * (this.hp/this.maxHp), 4);
    }

    attack(game) {
        const p = new Projectile(this.x, this.y, this.z + 25, game.mouse.x + game.camera.x, game.mouse.y + game.camera.y, this.isLocal);
        game.projectiles.push(p);
    }
}

class Projectile extends Entity {
    constructor(x, y, z, tx, ty, own) {
        super(x, y);
        this.z = z;
        const angle = Math.atan2(ty - y, tx - x);
        this.vx = Math.cos(angle) * 600;
        this.vy = Math.sin(angle) * 600;
        this.life = 1.5;
        this.owner = own;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }

    draw(ctx) {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI*2);
        ctx.fill();

        // Bullet (Floating)
        const sy = this.y - this.z;
        ctx.fillStyle = '#ffeebb';
        ctx.shadowBlur = 10; 
        ctx.shadowColor = '#ffaa00';
        ctx.beginPath();
        ctx.arc(this.x, sy, 5, 0, Math.PI*2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Particle {
    constructor(x, y, z, color) {
        this.x=x; this.y=y; this.z=z;
        this.vx = (Math.random()-0.5)*100;
        this.vy = (Math.random()-0.5)*100;
        this.vz = Math.random()*100;
        this.life = 1.0;
        this.color = color;
    }
    update(dt) {
        this.x += this.vx*dt;
        this.y += this.vy*dt;
        this.z += this.vz*dt;
        this.vz -= 200*dt; // Gravity
        if(this.z < 0) { this.z=0; this.vx*=0.5; this.vy*=0.5; }
        this.life -= dt;
    }
    draw(ctx) {
        const sy = this.y - this.z;
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, sy, 3, 3);
        ctx.globalAlpha = 1.0;
    }
}

// --- RENDER HELPERS ---

function drawPrism(ctx, x, y, w, h, d, color) {
    // d = depth (height in 3d)
    // x,y = top-left of base on screen
    
    const topC = lighten(color, 30);
    const sideC = darken(color, 20);
    
    // Front
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, d);
    
    // Top
    ctx.fillStyle = topC;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x+w, y);
    ctx.lineTo(x+w+5, y-10); // Fake perspective slant
    ctx.lineTo(x+5, y-10);
    ctx.fill();
    
    // Side
    ctx.fillStyle = sideC;
    ctx.beginPath();
    ctx.moveTo(x+w, y);
    ctx.lineTo(x+w+5, y-10);
    ctx.lineTo(x+w+5, y-10+d);
    ctx.lineTo(x+w, y+d);
    ctx.fill();
}

function drawCylinder(ctx, x, y, r, h, color) {
    // x, y = bottom center coords
    // h = height upwards
    
    const topY = y - h;
    
    // Body
    ctx.fillStyle = color;
    ctx.fillRect(x-r, topY, r*2, h);
    
    // Shade Side
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x+r/2, topY, r/2, h);
    
    // Top Circle
    ctx.fillStyle = lighten(color, 20);
    ctx.beginPath();
    ctx.ellipse(x, topY, r, r*0.4, 0, 0, Math.PI*2);
    ctx.fill();
    
    // Bottom Circle Curve
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r*0.4, 0, 0, Math.PI, 0); // Half circle
    ctx.fill();
}

function lighten(col, amt) { return adjustColor(col, amt); }
function darken(col, amt) { return adjustColor(col, -amt); }

function adjustColor(color, amount) {
    // Very basic Hex adjuster
    let usePound = false;
    if (color[0] == "#") { color = color.slice(1); usePound = true; }
    let num = parseInt(color,16);
    let r = (num >> 16) + amount;
    if (r > 255) r = 255; else if  (r < 0) r = 0;
    let b = ((num >> 8) & 0x00FF) + amount;
    if (b > 255) b = 255; else if  (b < 0) b = 0;
    let g = (num & 0x0000FF) + amount;
    if (g > 255) g = 255; else if  (g < 0) g = 0;
    return (usePound?"#":"") + (g | (b << 8) | (r << 16)).toString(16).padStart(6,'0');
}

window.onload = () => new Game();
