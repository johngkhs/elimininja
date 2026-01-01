// ElimiNinja - Main Game Engine
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Dojo size (play area)
const DOJO_WIDTH = 560;
const DOJO_HEIGHT = 375;
const DOJO_MARGIN = 60; // Visible area outside dojo where shurikens spawn

// Canvas size includes margin for seeing incoming shurikens
const CANVAS_WIDTH = DOJO_WIDTH + DOJO_MARGIN * 2;
const CANVAS_HEIGHT = DOJO_HEIGHT + DOJO_MARGIN * 2;
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

// Game constants
const NINJA_RADIUS = 15;
const NINJA_SPEED = 375; // pixels per second
const NINJA_ZEN_SPEED = 280; // 75% of regular speed for zen execution
const SWORD_LENGTH = 35;
const SWING_RADIUS = 50;
const MOVE_RANGE = 120; // visual indicator for movement range (also max move distance)
const SHURIKEN_RADIUS = 14;
const SHURIKEN_SPEED = 120;
const SUSHI_RADIUS = 7;

// Shuriken type unlock times (in seconds)
const GREEN_UNLOCK_TIME = 0;  // Green available from start
const RED_UNLOCK_TIME = 20;
const BLACK_UNLOCK_TIME = 45;

// Game state
let gameState = 'start'; // start, playing, gameover, zen-select
let gameTime = 0;
let score = 0;
let lastTime = 0;
let timeScale = 1;

// Entities
let ninja = null;
let shurikens = [];
let deadShurikens = [];
let explosions = [];
let sushis = [];
let sushiCount = 0;

// Zen mode
let zenMode = false;
let zenPoints = [];
let zenTimer = 0;
let zenExecuting = false;
let zenPath = [];
let zenPathIndex = 0;

// Field of view
let fieldOfView = CANVAS_WIDTH * 1.5; // diameter of visible area (starts outside dojo)
let blackShurikenTimers = new Map();

// Spawn timing
let shurikenSpawnTimer = 0;
let sushiSpawnTimer = 0;

// Get base spawn interval based on game time
function getSpawnInterval() {
    // Start at 1.5 seconds, decrease to minimum of 0.2 seconds
    const baseInterval = Math.max(0.2, 1.5 - gameTime / 30);
    return baseInterval;
}

// Ninja class
class Ninja {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.targetX = x;
        this.targetY = y;
        this.angle = 0; // facing direction
        this.moving = false;
        this.glowing = false;
        this.glowTimer = 0; // for pulsing glow effect
        this.swingProgress = 0; // 0 to 1 during movement
    }

    update(dt) {
        // Update glow timer for pulsing effect
        if (this.glowing) {
            this.glowTimer += dt * 5;
        }

        if (this.moving) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 5) {
                this.x = this.targetX;
                this.y = this.targetY;
                this.moving = false;
                this.swingProgress = 0;
            } else {
                // Use faster speed during zen execution
                const currentSpeed = zenExecuting ? NINJA_ZEN_SPEED : NINJA_SPEED;
                const speed = currentSpeed * dt;
                const moveX = (dx / dist) * speed;
                const moveY = (dy / dist) * speed;
                this.x += moveX;
                this.y += moveY;

                // Calculate swing progress based on distance traveled (faster swing)
                const totalDist = Math.sqrt(
                    Math.pow(this.targetX - this.startX, 2) +
                    Math.pow(this.targetY - this.startY, 2)
                );
                const traveled = Math.sqrt(
                    Math.pow(this.x - this.startX, 2) +
                    Math.pow(this.y - this.startY, 2)
                );
                // During zen, spin slower; otherwise single fast swing
                if (zenExecuting) {
                    this.swingProgress = (traveled / totalDist) * 2; // 2 full rotations (slower)
                } else {
                    this.swingProgress = Math.min(1, (traveled / totalDist) * 2); // 2x faster swing
                }
            }
        }
    }

    moveTo(x, y, ignoreRange = false) {
        // Calculate distance to target
        const dx = x - this.x;
        const dy = y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Clamp to MOVE_RANGE - if clicking outside circle, move to edge
        // Skip this for zen mode movements
        if (!ignoreRange && dist > MOVE_RANGE) {
            x = this.x + (dx / dist) * MOVE_RANGE;
            y = this.y + (dy / dist) * MOVE_RANGE;
        }

        // Clamp to dojo bounds
        x = Math.max(DOJO_MARGIN + NINJA_RADIUS, Math.min(DOJO_MARGIN + DOJO_WIDTH - NINJA_RADIUS, x));
        y = Math.max(DOJO_MARGIN + NINJA_RADIUS, Math.min(DOJO_MARGIN + DOJO_HEIGHT - NINJA_RADIUS, y));

        this.startX = this.x;
        this.startY = this.y;
        this.targetX = x;
        this.targetY = y;
        this.angle = Math.atan2(y - this.y, x - this.x);
        this.moving = true;
        this.swingProgress = 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw movement range indicator when not moving
        if (!this.moving && !zenExecuting) {
            ctx.beginPath();
            ctx.arc(0, 0, MOVE_RANGE, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.stroke();
        }

        ctx.rotate(this.angle);

        // Only draw sword when moving
        if (this.moving || zenExecuting) {
            let swordAngle;
            let swordExtension = 1;

            if (zenExecuting) {
                // During zen: slower 360 degree spins (swingProgress goes 0-4 for rotations)
                swordAngle = this.swingProgress * Math.PI * 2;
                swordExtension = 1;
            } else {
                // Swing from behind (-135°) through front to other side (135°)
                const easedProgress = Math.sin(this.swingProgress * Math.PI);
                const startAngle = -Math.PI * 0.75;
                const endAngle = Math.PI * 0.75;
                swordAngle = startAngle + this.swingProgress * (endAngle - startAngle);
                swordExtension = 0.6 + easedProgress * 0.4;
            }

            ctx.save();
            ctx.rotate(swordAngle);

            const currentSwordLength = SWORD_LENGTH * swordExtension;

            // Sword handle (wooden)
            ctx.fillStyle = '#654321';
            ctx.beginPath();
            ctx.roundRect(NINJA_RADIUS - 4, -3, 10, 6, 2);
            ctx.fill();

            // Handle wrap
            ctx.strokeStyle = '#8b4513';
            ctx.lineWidth = 2;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(NINJA_RADIUS - 2 + i * 3, -3);
                ctx.lineTo(NINJA_RADIUS - 2 + i * 3, 3);
                ctx.stroke();
            }

            // Sword blade with gradient
            const bladeGradient = ctx.createLinearGradient(NINJA_RADIUS + 6, 0, NINJA_RADIUS + currentSwordLength, 0);
            bladeGradient.addColorStop(0, '#e8e8e8');
            bladeGradient.addColorStop(0.5, '#ffffff');
            bladeGradient.addColorStop(1, '#c0c0c0');

            ctx.fillStyle = bladeGradient;
            ctx.beginPath();
            ctx.moveTo(NINJA_RADIUS + 6, -3);
            ctx.lineTo(NINJA_RADIUS + currentSwordLength - 5, -2);
            ctx.lineTo(NINJA_RADIUS + currentSwordLength, 0);
            ctx.lineTo(NINJA_RADIUS + currentSwordLength - 5, 2);
            ctx.lineTo(NINJA_RADIUS + 6, 3);
            ctx.closePath();
            ctx.fill();

            // Blade edge highlight
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(NINJA_RADIUS + 8, 0);
            ctx.lineTo(NINJA_RADIUS + currentSwordLength - 3, 0);
            ctx.stroke();

            ctx.restore();
        }

        // Draw ninja body (fully black circle)
        ctx.beginPath();
        ctx.arc(0, 0, NINJA_RADIUS, 0, Math.PI * 2);

        // Pulsing glow effect on body when zen is ready
        if (this.glowing) {
            const pulse = (Math.sin(this.glowTimer) + 1) / 2; // 0 to 1
            const glowColor = `rgba(255, 215, 0, ${0.3 + pulse * 0.5})`;
            ctx.fillStyle = glowColor;
            ctx.fill();

            // Add outer glow
            ctx.shadowColor = 'gold';
            ctx.shadowBlur = 10 + pulse * 10;
            ctx.fill();
            ctx.shadowBlur = 0;
        } else {
            ctx.fillStyle = '#111';
            ctx.fill();
        }

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
    }

    // Check if a point is in the sword swing arc
    isInSwingArc(px, py, radius) {
        const dx = px - this.x;
        const dy = py - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > SWING_RADIUS + radius) return false;

        const pointAngle = Math.atan2(dy, dx);
        let angleDiff = pointAngle - this.angle;

        // Normalize angle difference to -PI to PI
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Check if within front 180 degrees (90 degrees each side)
        return Math.abs(angleDiff) < Math.PI / 2;
    }

    // Check if hit from behind
    isHitFromBehind(px, py) {
        const dx = px - this.x;
        const dy = py - this.y;
        const pointAngle = Math.atan2(dy, dx);
        let angleDiff = pointAngle - this.angle;

        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        // Behind is more than 90 degrees from facing direction
        return Math.abs(angleDiff) > Math.PI / 2;
    }
}

// Shuriken class
class Shuriken {
    constructor(x, y, vx, vy, type = 'white') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.type = type;
        this.rotation = 0;
        this.timeInDojo = 0;
        this.enteredDojo = false; // Track if shuriken has entered the dojo
    }

    isInsideDojo() {
        return this.x >= DOJO_MARGIN && this.x <= DOJO_MARGIN + DOJO_WIDTH &&
               this.y >= DOJO_MARGIN && this.y <= DOJO_MARGIN + DOJO_HEIGHT;
    }

    update(dt) {
        this.x += this.vx * dt * timeScale;
        this.y += this.vy * dt * timeScale;
        this.rotation += 10 * dt * timeScale;

        // Track when shuriken enters the dojo
        if (!this.enteredDojo && this.isInsideDojo()) {
            this.enteredDojo = true;
        }

        // Only count time when inside dojo
        if (this.enteredDojo) {
            this.timeInDojo += dt * timeScale;
        }

        // Green shuriken homing
        if (this.type === 'green' && ninja) {
            const dx = ninja.x - this.x;
            const dy = ninja.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                // Strong gravitational pull toward ninja
                const pullStrength = 100;
                this.vx += (dx / dist) * pullStrength * dt * timeScale;
                this.vy += (dy / dist) * pullStrength * dt * timeScale;

                // Maintain constant speed
                const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
                this.vx = (this.vx / currentSpeed) * SHURIKEN_SPEED;
                this.vy = (this.vy / currentSpeed) * SHURIKEN_SPEED;
            }
        }

        // Only bounce off dojo walls after shuriken has entered the dojo
        // Also only bounce if moving toward the wall (prevents warping on entry)
        if (this.enteredDojo) {
            const dojoLeft = DOJO_MARGIN;
            const dojoRight = DOJO_MARGIN + DOJO_WIDTH;
            const dojoTop = DOJO_MARGIN;
            const dojoBottom = DOJO_MARGIN + DOJO_HEIGHT;

            // Left wall - only bounce if moving left
            if (this.x - SHURIKEN_RADIUS < dojoLeft && this.vx < 0) {
                this.x = dojoLeft + SHURIKEN_RADIUS;
                this.vx = Math.abs(this.vx);
            }
            // Right wall - only bounce if moving right
            if (this.x + SHURIKEN_RADIUS > dojoRight && this.vx > 0) {
                this.x = dojoRight - SHURIKEN_RADIUS;
                this.vx = -Math.abs(this.vx);
            }
            // Top wall - only bounce if moving up
            if (this.y - SHURIKEN_RADIUS < dojoTop && this.vy < 0) {
                this.y = dojoTop + SHURIKEN_RADIUS;
                this.vy = Math.abs(this.vy);
            }
            // Bottom wall - only bounce if moving down
            if (this.y + SHURIKEN_RADIUS > dojoBottom && this.vy > 0) {
                this.y = dojoBottom - SHURIKEN_RADIUS;
                this.vy = -Math.abs(this.vy);
            }
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Shuriken color based on type
        const colors = {
            white: '#f0f0f0',
            green: '#44ff44',
            red: '#ff4444',
            black: '#222'
        };

        ctx.fillStyle = colors[this.type];
        ctx.strokeStyle = this.type === 'black' ? '#444' : '#888';
        ctx.lineWidth = 1;

        // Draw 4-pointed shuriken
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI / 2);
            const outerX = Math.cos(angle) * SHURIKEN_RADIUS;
            const outerY = Math.sin(angle) * SHURIKEN_RADIUS;
            const innerAngle = angle + Math.PI / 4;
            const innerX = Math.cos(innerAngle) * (SHURIKEN_RADIUS * 0.4);
            const innerY = Math.sin(innerAngle) * (SHURIKEN_RADIUS * 0.4);

            if (i === 0) {
                ctx.moveTo(outerX, outerY);
            } else {
                ctx.lineTo(outerX, outerY);
            }
            ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Center hole
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#333';
        ctx.fill();

        ctx.restore();
    }
}

// Dead shuriken (fading out)
class DeadShuriken {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.alpha = 1;
        this.lifetime = 2;
    }

    update(dt) {
        this.lifetime -= dt;
        this.alpha = Math.max(0, this.lifetime / 2);
        return this.lifetime > 0;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.translate(this.x, this.y);

        const colors = {
            white: '#f0f0f0',
            green: '#44ff44',
            red: '#ff4444',
            black: '#222'
        };

        ctx.fillStyle = colors[this.type];
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const angle = (i * Math.PI / 2);
            const outerX = Math.cos(angle) * SHURIKEN_RADIUS;
            const outerY = Math.sin(angle) * SHURIKEN_RADIUS;
            const innerAngle = angle + Math.PI / 4;
            const innerX = Math.cos(innerAngle) * (SHURIKEN_RADIUS * 0.4);
            const innerY = Math.sin(innerAngle) * (SHURIKEN_RADIUS * 0.4);

            if (i === 0) {
                ctx.moveTo(outerX, outerY);
            } else {
                ctx.lineTo(outerX, outerY);
            }
            ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

// Explosion class
class Explosion {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.timer = 2;
        this.exploded = false;
        this.radius = 0;
        this.maxRadius = 50;
        this.alpha = 1;
    }

    update(dt) {
        if (!this.exploded) {
            this.timer -= dt * timeScale;
            if (this.timer <= 0) {
                this.exploded = true;
                // Check if ninja is caught in explosion
                const dx = ninja.x - this.x;
                const dy = ninja.y - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.maxRadius + NINJA_RADIUS) {
                    gameOver();
                }
                // Destroy nearby shurikens
                shurikens = shurikens.filter(s => {
                    const sdx = s.x - this.x;
                    const sdy = s.y - this.y;
                    const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
                    if (sdist < this.maxRadius) {
                        score++;
                        updateScore();
                        if (s.type !== 'red') {
                            deadShurikens.push(new DeadShuriken(s.x, s.y, s.type));
                        }
                        return false;
                    }
                    return true;
                });
            }
        } else {
            this.radius += 300 * dt;
            this.alpha -= 2 * dt;
        }
        return this.alpha > 0;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (!this.exploded) {
            // Pulsing warning
            const pulse = 0.5 + Math.sin(this.timer * 10) * 0.5;
            ctx.beginPath();
            ctx.arc(0, 0, 15 + pulse * 10, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, ${Math.floor(100 * this.timer / 2)}, 0, 0.5)`;
            ctx.fill();

            // Timer text
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(Math.ceil(this.timer).toString(), 0, 0);
        } else {
            // Explosion effect
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
            gradient.addColorStop(0, `rgba(255, 255, 200, ${this.alpha})`);
            gradient.addColorStop(0.3, `rgba(255, 150, 50, ${this.alpha * 0.8})`);
            gradient.addColorStop(0.7, `rgba(255, 50, 0, ${this.alpha * 0.5})`);
            gradient.addColorStop(1, `rgba(100, 0, 0, 0)`);

            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        ctx.restore();
    }
}

// Sushi class
class Sushi {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    update(dt) {
        this.bobOffset += dt * 3;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y + Math.sin(this.bobOffset) * 2);

        // Cute round sushi ball
        // Rice base (round)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, SUSHI_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#eee';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Salmon on top (cute curved shape)
        ctx.fillStyle = '#fa8072';
        ctx.beginPath();
        ctx.ellipse(0, -1, SUSHI_RADIUS * 0.7, SUSHI_RADIUS * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cute shine highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.arc(-2, -3, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// Spawn a shuriken from off-screen
function spawnShuriken() {
    // Determine which types are available
    const availableTypes = ['white'];
    if (gameTime >= GREEN_UNLOCK_TIME) availableTypes.push('green');
    if (gameTime >= RED_UNLOCK_TIME) availableTypes.push('red');
    if (gameTime >= BLACK_UNLOCK_TIME) availableTypes.push('black');

    // Weighted random selection (white > green > red > black)
    const weights = { white: 50, green: 30, red: 15, black: 5 };
    let totalWeight = 0;
    for (const type of availableTypes) {
        totalWeight += weights[type];
    }

    let random = Math.random() * totalWeight;
    let type = 'white';
    for (const t of availableTypes) {
        random -= weights[t];
        if (random <= 0) {
            type = t;
            break;
        }
    }

    // Spawn at edge of canvas (in the visible margin area)
    const edge = Math.floor(Math.random() * 4);
    let x, y, vx, vy;

    // Calculate dojo center for targeting
    const dojoCenterX = DOJO_MARGIN + DOJO_WIDTH / 2;
    const dojoCenterY = DOJO_MARGIN + DOJO_HEIGHT / 2;

    switch (edge) {
        case 0: // Top
            x = DOJO_MARGIN + Math.random() * DOJO_WIDTH;
            y = SHURIKEN_RADIUS + 5;
            break;
        case 1: // Right
            x = CANVAS_WIDTH - SHURIKEN_RADIUS - 5;
            y = DOJO_MARGIN + Math.random() * DOJO_HEIGHT;
            break;
        case 2: // Bottom
            x = DOJO_MARGIN + Math.random() * DOJO_WIDTH;
            y = CANVAS_HEIGHT - SHURIKEN_RADIUS - 5;
            break;
        case 3: // Left
            x = SHURIKEN_RADIUS + 5;
            y = DOJO_MARGIN + Math.random() * DOJO_HEIGHT;
            break;
    }

    // Calculate direction toward dojo center with some randomness
    const toDojoCenterX = dojoCenterX - x;
    const toDojoCenterY = dojoCenterY - y;
    const toDist = Math.sqrt(toDojoCenterX * toDojoCenterX + toDojoCenterY * toDojoCenterY);

    // Base direction toward center
    let dirX = toDojoCenterX / toDist;
    let dirY = toDojoCenterY / toDist;

    // Add some randomness (up to 30 degrees deviation)
    const angleOffset = (Math.random() - 0.5) * Math.PI * 0.33;
    const cos = Math.cos(angleOffset);
    const sin = Math.sin(angleOffset);
    const newDirX = dirX * cos - dirY * sin;
    const newDirY = dirX * sin + dirY * cos;

    vx = newDirX * SHURIKEN_SPEED;
    vy = newDirY * SHURIKEN_SPEED;

    shurikens.push(new Shuriken(x, y, vx, vy, type));
}

// Spawn sushi at random position inside dojo
function spawnSushi() {
    const padding = 30;
    const x = DOJO_MARGIN + padding + Math.random() * (DOJO_WIDTH - padding * 2);
    const y = DOJO_MARGIN + padding + Math.random() * (DOJO_HEIGHT - padding * 2);
    sushis.push(new Sushi(x, y));
}

// Update field of view based on black shurikens
function updateFieldOfView() {
    let targetFOV = CANVAS_WIDTH * 1.5; // Start larger than canvas (outside dojo)

    for (const shuriken of shurikens) {
        if (shuriken.type === 'black' && shuriken.enteredDojo) {
            // FOV starts shrinking immediately when black shuriken enters
            // Starts from outside the dojo and shrinks smoothly
            const shrinkRate = 40; // pixels per second of shrinkage
            const startFOV = CANVAS_WIDTH * 1.2; // Start slightly outside dojo
            const fov = Math.max(80, startFOV - shuriken.timeInDojo * shrinkRate);
            targetFOV = Math.min(targetFOV, fov);
        }
    }

    // Smooth transition for FOV changes
    const transitionSpeed = 200; // How fast FOV changes
    const dt = 1 / 60; // Approximate frame time
    if (targetFOV < fieldOfView) {
        fieldOfView = Math.max(targetFOV, fieldOfView - transitionSpeed * dt);
    } else if (targetFOV > fieldOfView) {
        // Quick recovery when black shurikens are eliminated
        fieldOfView = Math.min(targetFOV, fieldOfView + transitionSpeed * 3 * dt);
    }
}

// Check collisions
function checkCollisions() {
    if (!ninja) return;

    // Check sushi collection
    sushis = sushis.filter(sushi => {
        const dx = ninja.x - sushi.x;
        const dy = ninja.y - sushi.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < NINJA_RADIUS + SUSHI_RADIUS) {
            if (sushiCount < 3) {
                sushiCount++;
                updatePowerBar();
                if (sushiCount >= 3) {
                    ninja.glowing = true;
                }
            }
            return false;
        }
        return true;
    });

    // Check shuriken collisions
    shurikens = shurikens.filter(shuriken => {
        const dx = ninja.x - shuriken.x;
        const dy = ninja.y - shuriken.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Check if shuriken hits ninja
        if (dist < NINJA_RADIUS + SHURIKEN_RADIUS) {
            if (ninja.moving || zenExecuting) {
                // Check if hit from front (can block) or back (dies)
                if (ninja.isInSwingArc(shuriken.x, shuriken.y, SHURIKEN_RADIUS)) {
                    // Blocked! Shuriken destroyed
                    score++;
                    updateScore();

                    if (shuriken.type === 'red') {
                        // Red shuriken explodes
                        explosions.push(new Explosion(shuriken.x, shuriken.y));
                    } else {
                        deadShurikens.push(new DeadShuriken(shuriken.x, shuriken.y, shuriken.type));
                    }
                    return false;
                } else if (ninja.isHitFromBehind(shuriken.x, shuriken.y)) {
                    // Hit from behind while moving
                    gameOver();
                    return true;
                }
            } else {
                // Not moving - any hit kills
                gameOver();
                return true;
            }
        }

        // Check if shuriken is in sword swing path (even without direct contact)
        if ((ninja.moving || zenExecuting) && ninja.isInSwingArc(shuriken.x, shuriken.y, SHURIKEN_RADIUS)) {
            if (dist < SWING_RADIUS + SHURIKEN_RADIUS) {
                score++;
                updateScore();

                if (shuriken.type === 'red') {
                    explosions.push(new Explosion(shuriken.x, shuriken.y));
                } else {
                    deadShurikens.push(new DeadShuriken(shuriken.x, shuriken.y, shuriken.type));
                }
                return false;
            }
        }

        return true;
    });
}

// Update score display
function updateScore() {
    document.getElementById('score').textContent = score;
}

// Update time display
function updateTime() {
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    document.getElementById('time').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Update power bar
function updatePowerBar() {
    for (let i = 1; i <= 3; i++) {
        const slot = document.getElementById(`sushi-${i}`);
        if (i <= sushiCount) {
            slot.classList.add('filled');
        } else {
            slot.classList.remove('filled');
        }
    }
}

// Game over
function gameOver() {
    if (gameState === 'gameover') return;
    gameState = 'gameover';
    document.getElementById('final-score').textContent = score;
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    document.getElementById('final-time').textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('game-over').classList.remove('hidden');
}

// Draw field of view overlay
function drawFOV() {
    // Only draw darkness if FOV is smaller than the maximum
    const maxFOV = CANVAS_WIDTH * 1.5;
    if (fieldOfView >= maxFOV) return;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';

    // Calculate the FOV radius
    const fovRadius = fieldOfView / 2;
    const edgeWidth = 40; // Width of the soft edge

    // Create darkness from edges creeping in
    // Use a radial gradient centered on ninja
    const innerRadius = Math.max(0, fovRadius - edgeWidth);
    const outerRadius = fovRadius + edgeWidth;

    const gradient = ctx.createRadialGradient(
        ninja.x, ninja.y, innerRadius,
        ninja.x, ninja.y, outerRadius
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.7)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)');

    // Fill the entire canvas with the gradient
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Add solid darkness outside the outer edge
    if (fovRadius < CANVAS_WIDTH) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
        ctx.beginPath();
        ctx.rect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.arc(ninja.x, ninja.y, outerRadius, 0, Math.PI * 2, true);
        ctx.fill();
    }

    ctx.restore();
}

// Draw zen mode point selection
function drawZenSelection() {
    ctx.save();

    // Dim the screen
    ctx.fillStyle = 'rgba(0, 0, 50, 0.3)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw selected points
    for (let i = 0; i < zenPoints.length; i++) {
        const p = zenPoints[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
        ctx.fill();
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((i + 1).toString(), p.x, p.y);
    }

    // Draw path preview
    if (zenPoints.length > 0) {
        ctx.beginPath();
        ctx.moveTo(ninja.x, ninja.y);
        for (const p of zenPoints) {
            ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.5)';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Timer display
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Select ${3 - zenPoints.length} more point(s) - ${zenTimer.toFixed(1)}s`, CANVAS_WIDTH / 2, 30);

    ctx.restore();
}

// Execute zen mode path
function executeZenPath() {
    if (zenPathIndex < zenPath.length) {
        const target = zenPath[zenPathIndex];
        ninja.moveTo(target.x, target.y, true); // ignoreRange = true for zen mode
        zenPathIndex++;
    } else {
        // Zen mode complete
        zenExecuting = false;
        zenMode = false;
        zenPath = [];
        zenPathIndex = 0;
        timeScale = 1;
        sushiCount = 0;
        ninja.glowing = false;
        updatePowerBar();
    }
}

// Draw dojo floor and outer area
function drawDojo() {
    // Draw outer area (light gray/white) - visible spawn zone
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw subtle grid pattern in outer area
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
    }

    // Draw dojo (wooden floor) in center
    ctx.fillStyle = '#5c3d2e';
    ctx.fillRect(DOJO_MARGIN, DOJO_MARGIN, DOJO_WIDTH, DOJO_HEIGHT);

    // Floor boards
    ctx.strokeStyle = '#4a3020';
    ctx.lineWidth = 1;
    const boardWidth = 40;
    for (let x = DOJO_MARGIN; x < DOJO_MARGIN + DOJO_WIDTH; x += boardWidth) {
        ctx.beginPath();
        ctx.moveTo(x, DOJO_MARGIN);
        ctx.lineTo(x, DOJO_MARGIN + DOJO_HEIGHT);
        ctx.stroke();
    }

    // Horizontal lines for wood grain
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    for (let y = DOJO_MARGIN; y < DOJO_MARGIN + DOJO_HEIGHT; y += 15) {
        ctx.beginPath();
        ctx.moveTo(DOJO_MARGIN, y);
        ctx.lineTo(DOJO_MARGIN + DOJO_WIDTH, y);
        ctx.stroke();
    }

    // Dojo border
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 4;
    ctx.strokeRect(DOJO_MARGIN, DOJO_MARGIN, DOJO_WIDTH, DOJO_HEIGHT);
}

// Main game loop
function gameLoop(currentTime) {
    requestAnimationFrame(gameLoop);

    if (gameState !== 'playing' && gameState !== 'zen-select') {
        return;
    }

    // Calculate delta time
    const dt = Math.min((currentTime - lastTime) / 1000, 0.1); // Cap at 100ms
    lastTime = currentTime;

    if (gameState === 'playing') {
        // Update game time
        gameTime += dt * timeScale;
        updateTime();

        // Spawn shurikens
        shurikenSpawnTimer -= dt * timeScale;
        if (shurikenSpawnTimer <= 0) {
            spawnShuriken();
            shurikenSpawnTimer = getSpawnInterval();
        }

        // Spawn sushi occasionally
        sushiSpawnTimer -= dt;
        if (sushiSpawnTimer <= 0 && sushis.length < 3) {
            spawnSushi();
            sushiSpawnTimer = 5 + Math.random() * 10;
        }

        // Update entities
        ninja.update(dt * timeScale);

        // Check if zen path movement complete
        if (zenExecuting && !ninja.moving) {
            executeZenPath();
        }

        for (const shuriken of shurikens) {
            shuriken.update(dt);
        }

        for (const sushi of sushis) {
            sushi.update(dt);
        }

        deadShurikens = deadShurikens.filter(ds => ds.update(dt));
        explosions = explosions.filter(e => e.update(dt));

        // Update field of view
        updateFieldOfView();

        // Check collisions
        checkCollisions();
    } else if (gameState === 'zen-select') {
        // Update zen timer
        zenTimer -= dt;
        if (zenTimer <= 0 || zenPoints.length >= 3) {
            // Start zen execution
            if (zenPoints.length > 0) {
                gameState = 'playing';
                zenExecuting = true;
                timeScale = 1; // Return to normal speed for fast execution
                zenPath = [...zenPoints];
                zenPoints = [];
                zenPathIndex = 0;
                executeZenPath();
            } else {
                // Cancelled - no points selected
                gameState = 'playing';
                timeScale = 1;
            }
        }
    }

    // Draw everything
    drawDojo();

    // Draw dead shurikens (under everything)
    for (const ds of deadShurikens) {
        ds.draw();
    }

    // Draw sushis
    for (const sushi of sushis) {
        sushi.draw();
    }

    // Draw shurikens
    for (const shuriken of shurikens) {
        shuriken.draw();
    }

    // Draw explosions
    for (const explosion of explosions) {
        explosion.draw();
    }

    // Draw ninja
    ninja.draw();

    // Draw FOV overlay
    drawFOV();

    // Draw zen selection UI
    if (gameState === 'zen-select') {
        drawZenSelection();
    }
}

// Handle input (click or touch)
function handleInput(clientX, clientY) {
    if (gameState !== 'playing' && gameState !== 'zen-select') return;

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (CANVAS_WIDTH / rect.width);
    const y = (clientY - rect.top) * (CANVAS_HEIGHT / rect.height);

    if (gameState === 'zen-select') {
        // Add point to zen path
        zenPoints.push({ x, y });
        if (zenPoints.length >= 3) {
            // Auto-trigger execution
        }
        return;
    }

    // Check if clicking on ninja (to activate zen mode)
    const dx = x - ninja.x;
    const dy = y - ninja.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < NINJA_RADIUS + 20 && sushiCount >= 3 && !zenExecuting) {
        // Activate zen mode (larger touch area on mobile)
        zenMode = true;
        gameState = 'zen-select';
        zenTimer = 4;
        zenPoints = [];
        timeScale = 0.1; // 90% slowdown
        return;
    }

    // Move ninja to clicked/tapped position
    if (!zenExecuting) {
        ninja.moveTo(x, y);
    }
}

// Mouse click handler
canvas.addEventListener('click', (e) => {
    handleInput(e.clientX, e.clientY);
});

// Touch handler for mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling and zooming
    if (e.touches.length > 0) {
        handleInput(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: false });

// Prevent default touch behaviors on canvas
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
}, { passive: false });

// Start/restart game
function startGame() {
    gameState = 'playing';
    gameTime = 0;
    score = 0;
    timeScale = 1;
    fieldOfView = CANVAS_WIDTH * 1.5;

    ninja = new Ninja(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    shurikens = [];
    deadShurikens = [];
    explosions = [];
    sushis = [];
    sushiCount = 0;

    zenMode = false;
    zenPoints = [];
    zenExecuting = false;
    zenPath = [];

    shurikenSpawnTimer = 1;
    sushiSpawnTimer = 3;

    blackShurikenTimers.clear();

    updateScore();
    updateTime();
    updatePowerBar();

    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');

    lastTime = performance.now();
}

// Event listeners
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

// Start the game loop
requestAnimationFrame(gameLoop);
