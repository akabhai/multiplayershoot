// --- ENGINE CONFIG ---
const TILE_SIZE = 100;
const WORLD_SIZE = 4000; 
const VIEW_DIST = 1400;

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Optimization
        
        this.lastTime = 0;
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.shake = 0;

        this.input = { keys: {}, mouse: { x: 0, y: 0, down: false } };
        
        // Game State
        this.localPlayer = null;
        this.entities = []; // Players + Bots
        this.mapObjects = []; // Walls, Trees, Loot
        this.projectiles = [];
        this.particles = [];
        
        this.zone = { x: WORLD_SIZE/2, y: WORLD_SIZE/2, radius: WORLD_SIZE, targetRadius: 500, time: 300 };
        
        this.network = new NetworkManager(this);
        this.magnet = new MagnetRoom();
        
        this.initInput();
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // UI Hooks
        document.getElementById('btn-deploy').onclick = () => this.deploy();
        document.querySelectorAll('.class-card').forEach(c => {
            c.onclick = () => {
                document.querySelectorAll('.class-card').forEach(x => x.classList.remove('active'));
                c.classList.add('active');
            };
        });
        
        // Start Loop
        requestAnimationFrame(t => this.loop(t));
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initInput() {
        window.addEventListener('keydown', e => {
            this.input.keys[e.code] = true;
            if(e.code === 'KeyF') this.tryInteract();
            if(e.code === 'Digit1') this.localPlayer?.switchWeapon(0);
            if(e.code === 'Digit2') this.localPlayer?.switchWeapon(1);
            if(e.code === 'KeyR') this.localPlayer?.reload();
        });
        window.addEventListener('keyup', e => this.input.keys[e.code] = false);
        window.addEventListener('mousemove', e => {
            this.input.mouse.x = e.clientX;
            this.input.mouse.y = e.clientY;
        });
        window.addEventListener('mousedown', () => this.input.mouse.down = true);
        window.addEventListener('mouseup', () => this.input.mouse.down = false);
    }

    deploy() {
        const name = document.getElementById('player-name').value || 'Survivor';
        const cls = document.querySelector('.class-card.active').dataset.class;
        
        document.getElementById('lobby-screen').style.display = 'none';
        document.getElementById('hud').style.display = 'block';

        // Spawn in random safe location
        const sx = 500 + Math.random() * (WORLD_SIZE - 1000);
        const sy = 500 + Math.random() * (WORLD_SIZE - 1000);

        this.localPlayer = new Player(sx, sy, name, cls, true);
        this.entities.push(this.localPlayer);

        // Generate World around player (Procedural)
        this.generateMap();

        // Connect to Network Simulation
        this.network.connect(this.magnet.roomId, this.localPlayer);
    }

    generateMap() {
        // 1. Grid of Trees
        for(let i=0; i<300; i++) {
            this.mapObjects.push(new Tree(Math.random()*WORLD_SIZE, Math.random()*WORLD_SIZE));
        }
        // 2. Buildings (Clusters)
        const towns = [{x:1000,y:1000}, {x:3000,y:3000}, {x:2000,y:2000}];
        towns.forEach(t => {
            for(let j=0; j<6; j++) {
                const bx = t.x + (Math.random()-0.5)*600;
                const by = t.y + (Math.random()-0.5)*600;
                this.mapObjects.push(new Building(bx, by, 150, 150));
                // Spawn Loot inside
                if(Math.random()>0.3) this.mapObjects.push(new Loot(bx+50, by+50, this.getRandomLoot()));
            }
        });
    }

    getRandomLoot() {
        const pool = ['ak47', 'm416', 'shotgun', 'sniper', 'medkit', 'shield'];
        return pool[Math.floor(Math.random()*pool.length)];
    }

    tryInteract() {
        if(!this.localPlayer || this.localPlayer.dead) return;
        // Find nearest loot
        let nearest = null, dist = 80;
        this.mapObjects.forEach((obj, i) => {
            if(obj instanceof Loot) {
                const d = Math.hypot(obj.x - this.localPlayer.x, obj.y - this.localPlayer.y);
                if(d < dist) { dist = d; nearest = i; }
            }
        });

        if(nearest !== null) {
            const loot = this.mapObjects[nearest];
            if(this.localPlayer.pickup(loot.type)) {
                this.mapObjects.splice(nearest, 1);
            }
        }
    }

    loop(ts) {
        const dt = Math.min((ts - this.lastTime) / 1000, 0.1);
        this.lastTime = ts;

        if(this.localPlayer) {
            this.update(dt);
            this.render();
        }

        requestAnimationFrame(t => this.loop(t));
    }

    update(dt) {
        // Zone Logic
        this.zone.time -= dt;
        if(this.zone.time <= 0 && this.zone.radius > this.zone.targetRadius) {
            this.zone.radius -= 15 * dt;
        }
        // Update Entities
        this.entities.forEach(e => e.update(dt, this));
        this.projectiles.forEach((p,i) => {
            p.update(dt);
            if(p.remove) this.projectiles.splice(i, 1);
        });
        this.particles.forEach((p,i) => {
            p.update(dt);
            if(p.life <= 0) this.particles.splice(i, 1);
        });
        
        // Network Sync
        this.network.update(dt);

        // Camera Follow
        if(this.localPlayer) {
            // Screen shake decay
            if(this.shake > 0) this.shake *= 0.9;
            const shakeX = (Math.random()-0.5)*this.shake;
            const shakeY = (Math.random()-0.5)*this.shake;

            this.camera.x += (this.localPlayer.x - this.canvas.width/2 - this.camera.x) * 0.1;
            this.camera.y += (this.localPlayer.y - this.canvas.height/2 - this.camera.y) * 0.1;
            
            // Zone Damage
            const d = Math.hypot(this.localPlayer.x - this.zone.x, this.localPlayer.y - this.zone.y);
            if(d > this.zone.radius) this.localPlayer.takeDamage(10*dt);
        }

        // Update UI Strings
        document.getElementById('zone-timer').innerText = Math.max(0, Math.ceil(this.zone.time)) + "s";
    }

    render() {
        const ctx = this.ctx;
        // Background
        ctx.fillStyle = '#1a1e16'; // Dark Earth
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        // Camera Translate
        ctx.translate(-Math.floor(this.camera.x), -Math.floor(this.camera.y));
        
        // Draw Grid (Terrain Detail)
        this.drawTerrain(ctx);

        // --- RENDER SORTING (Z-BUFFER) ---
        // We mix players, trees, walls, and loot into one list and sort by Y
        const renderList = [];
        
        // 1. Map Objects
        this.mapObjects.forEach(o => {
            if(this.inView(o)) renderList.push({ type: 'obj', z: o.y + (o.h||0), obj: o });
        });
        // 2. Entities
        this.entities.forEach(e => {
            renderList.push({ type: 'ent', z: e.y, obj: e });
        });
        // 3. Projectiles
        this.projectiles.forEach(p => {
            renderList.push({ type: 'proj', z: p.y, obj: p });
        });

        renderList.sort((a,b) => a.z - b.z);

        // Draw Shadows first
        renderList.forEach(item => {
            if(item.type === 'ent') this.drawShadow(ctx, item.obj);
        });

        // Draw Objects
        renderList.forEach(item => {
            item.obj.draw(ctx);
        });

        // Particles (On Top)
        ctx.globalCompositeOperation = 'screen'; // Additive blending for glow
        this.particles.forEach(p => p.draw(ctx));
        ctx.globalCompositeOperation = 'source-over';

        // Zone Boundary
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(this.zone.x, this.zone.y, this.zone.radius, 0, Math.PI*2);
        ctx.stroke();

        ctx.restore();

        // UI Updates (Local Player Vitals)
        if(this.localPlayer) {
            this.localPlayer.updateHUD();
            this.drawMinimap();
        }
    }

    inView(obj) {
        // Culling optimization
        return (obj.x > this.camera.x - 200 && obj.x < this.camera.x + this.canvas.width + 200 &&
                obj.y > this.camera.y - 200 && obj.y < this.camera.y + this.canvas.height + 200);
    }

    drawTerrain(ctx) {
        ctx.strokeStyle = '#252b20';
        ctx.lineWidth = 2;
        const sx = Math.floor(this.camera.x / TILE_SIZE) * TILE_SIZE;
        const sy = Math.floor(this.camera.y / TILE_SIZE) * TILE_SIZE;
        
        for(let x=sx; x<sx+this.canvas.width+TILE_SIZE; x+=TILE_SIZE) {
            for(let y=sy; y<sy+this.canvas.height+TILE_SIZE; y+=TILE_SIZE) {
                ctx.strokeRect(x,y,TILE_SIZE,TILE_SIZE);
            }
        }
    }

    drawShadow(ctx, e) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, 20, 10, 0, 0, Math.PI*2);
        ctx.fill();
    }

    drawMinimap() {
        const mc = document.getElementById('radar-canvas');
        const mx = mc.getContext('2d');
        mc.width = 160; mc.height = 160;
        
        // Clear
        mx.fillStyle = '#000'; mx.fillRect(0,0,160,160);
        
        const scale = 160 / 2000; // View range on radar
        const cx = 80; const cy = 80;

        // Entities
        this.entities.forEach(e => {
            if(e === this.localPlayer || e.dead) return;
            // Only show shooting enemies
            if(e.shooting) {
                const rx = (e.x - this.localPlayer.x) * scale + cx;
                const ry = (e.y - this.localPlayer.y) * scale + cy;
                if(rx>0 && rx<160 && ry>0 && ry<160) {
                    mx.fillStyle = 'red'; mx.fillRect(rx-2, ry-2, 4, 4);
                }
            }
        });

        // Zone Arc
        // (Simplification for radar view)
        
        // Self
        mx.fillStyle = '#0ff';
        mx.beginPath(); mx.moveTo(cx, cy-4); mx.lineTo(cx-3, cy+3); mx.lineTo(cx+3, cy+3);
        mx.fill();
    }
}

// --- PRIMITIVE RENDERER (2.5D) ---
function drawPrism(ctx, x, y, w, h, zH, color) {
    // x,y is bottom-left corner on ground
    // zH is height of the object
    const roofY = y - zH; 
    
    // Side Face (Darker)
    ctx.fillStyle = adjustColor(color, -40);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, roofY);
    ctx.lineTo(x, roofY);
    ctx.fill();

    // Roof Face (Lighter)
    ctx.fillStyle = adjustColor(color, 20);
    ctx.fillRect(x, roofY - w*0.5, w, w*0.5); // Fake perspective roof
}

function adjustColor(color, amount) {
    // Simple hex adjustment logic would go here
    return color; // Placeholder
}

// Start Game
window.onload = () => new Game();
