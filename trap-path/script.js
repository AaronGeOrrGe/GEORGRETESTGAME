// Trap Path - 2D browser platformer
// Vanilla JavaScript + HTML5 Canvas, no dependencies.

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = canvas.width;   // 960 logical px
const H = canvas.height;  // 540 logical px

const GRAVITY = 1200;
const MOVE_SPEED = 240;
const JUMP_SPEED = -460;
const PLAYER_W = 24;
const PLAYER_H = 34;

let lastTime = 0;
let gameTime = 0;
const TOTAL_LEVELS = 10;
const REFILL_MS = 120000;
let refillTimer = null;
let bgmInterval = null;
let bgmNote = 0;
let audioCtx = null;

const bgmNotes = [196.0, 246.94, 293.66, 392.0, 493.88, 392.0, 293.66, 246.94];

const game = {
  state: 'start',
  unlocked: 1,
  currentLevel: 1,
  lives: 3,
  totalCoins: 0,
  deaths: 0,
  camera: { x: 0, y: 0 },
  shake: 0,
  particles: [],
  level: null,
  player: null,
  checkpoint: null,
  overlayTimer: 0,
  pendingGameOver: false,
  livesRefillEnd: 0
};

const keys = {};
const keysPressed = {};

// Utility functions
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function circleRectOverlap(cx, cy, r, rx, ry, rw, rh) {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  return dx * dx + dy * dy <= r * r;
}
function drawRect(ctx, x, y, w, h, color, stroke) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h); }
}

// Audio
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}
function playTone(freq, type, duration, when, vol = 0.1) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, when);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  gain.gain.setValueAtTime(vol, when);
  gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
  osc.start(when);
  osc.stop(when + duration);
}
function playJump() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  playTone(220, 'square', 0.08, t, 0.05);
  playTone(440, 'square', 0.06, t + 0.04, 0.03);
}
function playCoin() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  playTone(880, 'sine', 0.08, t, 0.05);
  playTone(1320, 'sine', 0.1, t + 0.05, 0.04);
}
function playDeath() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  playTone(150, 'sawtooth', 0.3, t, 0.08);
  playTone(100, 'sawtooth', 0.25, t + 0.1, 0.08);
}
function playWin() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  playTone(523.25, 'square', 0.15, t, 0.05);
  playTone(659.25, 'square', 0.15, t + 0.1, 0.05);
  playTone(783.99, 'square', 0.3, t + 0.2, 0.05);
}
function startMusic() {
  if (bgmInterval) return;
  initAudio();
  if (!audioCtx) return;
  bgmInterval = setInterval(() => {
    playTone(bgmNotes[bgmNote % bgmNotes.length], 'sine', 0.4, audioCtx.currentTime, 0.03);
    bgmNote++;
  }, 600);
}
function stopMusic() {
  if (bgmInterval) { clearInterval(bgmInterval); bgmInterval = null; }
}

// Particles
class Particle {
  constructor(x, y, vx, vy, life, color, size) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.color = color; this.size = size;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }
  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.maxLife);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}
function spawnParticles(x, y, count, color, speed) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * speed * 40 + 40;
    const vx = Math.cos(a) * s;
    const vy = Math.sin(a) * s;
    const life = Math.random() * 0.4 + 0.3;
    const size = Math.random() * 3 + 2;
    game.particles.push(new Particle(x, y, vx, vy, life, color, size));
  }
}
function spawnJumpDust(x, y) { spawnParticles(x, y, 5, 'rgba(200,200,200,0.5)', 0.6); }
function spawnLandDust(x, y) { spawnParticles(x, y, 4, 'rgba(180,180,180,0.6)', 0.4); }
function spawnCoinSparkle(coin) { spawnParticles(coin.x, coin.y, 8, '#f1c40f', 1.2); }
function spawnDeathBurst(player) { spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 20, '#3498db', 2); }

// Input
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  keysPressed[e.code] = true;
  if (e.code === 'Escape') { e.preventDefault(); togglePause(); }
  if ((game.state === 'start' || game.state === 'gameover') && e.code === 'Space') {
    e.preventDefault();
    // Handled by buttons
  }
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  keysPressed[e.code] = false;
});

function togglePause() {
  if (game.state === 'playing') {
    game.state = 'paused';
    showScreen('pause-menu');
    hideScreen('mobile-controls');
    stopMusic();
  } else if (game.state === 'paused') {
    game.state = 'playing';
    hideScreen('pause-menu');
    showScreen('mobile-controls');
    startMusic();
  }
}

// UI helpers
function showScreen(id) { document.getElementById(id).classList.remove('hidden'); }
function hideScreen(id) { document.getElementById(id).classList.add('hidden'); }
function hideAllScreens() {
  ['start-screen', 'level-select', 'pause-menu', 'level-complete', 'game-over', 'victory-screen', 'level-start'].forEach(hideScreen);
  document.getElementById('level-start').classList.remove('active');
}

function updateHUD() {
  document.getElementById('hud-level').textContent = 'LEVEL: ' + game.currentLevel;
  document.getElementById('hud-coins').textContent = 'COINS: ' + game.totalCoins;
  const hearts = '❤️'.repeat(Math.max(0, game.lives));
  document.getElementById('hud-lives').innerHTML = 'LIVES: <span class="hearts">' + hearts + '</span>';
}

function showDied() { document.getElementById('died-message').classList.remove('hidden'); }
function hideDied() { document.getElementById('died-message').classList.add('hidden'); }

// Player
class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = PLAYER_W; this.h = PLAYER_H;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.climbing = false;
    this.dead = false;
    this.deadTimer = 0;
    this.facing = 1;
    this.riding = null;
    this.jumpCount = 0;
    this.maxJumps = 2;
  }

  reset(x, y) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.dead = false; this.deadTimer = 0; this.onGround = false; this.climbing = false; this.riding = null;
    this.jumpCount = 0;
  }

  update(dt) {
    if (this.dead) { this.deadTimer -= dt; return; }

    const left = keys['KeyA'] || keys['ArrowLeft'];
    const right = keys['KeyD'] || keys['ArrowRight'];
    const up = keys['KeyW'] || keys['ArrowUp'];
    const down = keys['KeyS'] || keys['ArrowDown'];
    const jump = keys['Space'];

    // Ladders
    let onLadder = false;
    if (game.level && game.level.ladders) {
      for (const l of game.level.ladders) {
        if (rectsOverlap(this, l)) { onLadder = true; break; }
      }
    }

    // Start climbing when pressing up/down on a ladder
    if (onLadder && (up || down)) {
      this.climbing = true;
      this.jumpCount = 0;
    }
    if (!onLadder) this.climbing = false;

    // Climb
    if (this.climbing) {
      if (keysPressed['Space']) {
        this.climbing = false;
        this.vy = JUMP_SPEED;
        this.onGround = false;
        this.jumpCount = 1;
        playJump();
        spawnJumpDust(this.x + this.w / 2, this.y + this.h);
        keysPressed['Space'] = false;
      } else {
        const h = (left ? -1 : 0) + (right ? 1 : 0);
        const v = (up ? -1 : 0) + (down ? 1 : 0);
        this.vx = h * MOVE_SPEED * 0.6;
        this.vy = v * MOVE_SPEED;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        if (h !== 0) this.facing = h;
        this.onGround = false;
        return;
      }
    }

    // Normal movement
    let move = 0;
    if (left) { move = -1; this.facing = -1; }
    if (right) { move = 1; this.facing = 1; }
    this.vx = move * MOVE_SPEED;

    if ((keysPressed['Space'] || keysPressed['ArrowUp'] || keysPressed['KeyW']) && this.jumpCount < this.maxJumps) {
      this.vy = JUMP_SPEED;
      this.onGround = false;
      this.riding = null;
      this.jumpCount++;
      playJump();
      spawnJumpDust(this.x + this.w / 2, this.y + this.h);
      keysPressed['Space'] = false;
      keysPressed['ArrowUp'] = false;
      keysPressed['KeyW'] = false;
    }

    this.vy += GRAVITY * dt;

    this.x += this.vx * dt;
    this.resolveX(game.level.platforms);
    this.y += this.vy * dt;
    const wasOnGround = this.onGround;
    this.onGround = false;
    this.riding = null;
    this.resolveY(game.level.platforms, dt);
    if (this.onGround && !wasOnGround) {
      spawnLandDust(this.x + this.w / 2, this.y + this.h);
    }

    if (this.riding) {
      this.x += this.riding.x - this.riding.lastX;
    }

    const levelHeight = game.level ? (game.level.height || H) : H;
    if (this.y > levelHeight + 80) killPlayer();
  }

  resolveX(platforms) {
    for (const p of platforms) {
      if (p.dead) continue;
      if (rectsOverlap(this, p)) {
        if (this.vx > 0) this.x = p.x - this.w;
        else if (this.vx < 0) this.x = p.x + p.w;
        this.vx = 0;
      }
    }
  }

  resolveY(platforms, dt) {
    for (const p of platforms) {
      if (p.dead) continue;
      if (rectsOverlap(this, p)) {
        const prevBottom = this.y + this.h - this.vy * dt;
        if (this.vy > 0 && prevBottom <= p.y + 4) {
          this.y = p.y - this.h;
          this.vy = 0;
          this.onGround = true;
          this.riding = p;
          this.jumpCount = 0;
        } else if (this.vy < 0) {
          this.y = p.y + p.h;
          this.vy = 0;
        }
      }
    }
  }

  draw(ctx) {
    const c = this.dead ? '#555' : '#3498db';
    const walking = Math.abs(this.vx) > 1;
    const swing = walking ? Math.sin(gameTime * 12) * 4 : 0;

    ctx.strokeStyle = c;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';

    // Head
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(this.x + this.w / 2, this.y + 7, 7, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = c;
    ctx.fillRect(this.x + 6, this.y + 15, this.w - 12, this.h - 24);

    // Arms
    ctx.beginPath();
    ctx.moveTo(this.x + 4, this.y + 18);
    ctx.lineTo(this.x + this.w - 4, this.y + 18);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(this.x + 8, this.y + this.h - 9);
    ctx.lineTo(this.x + 4 + swing, this.y + this.h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(this.x + this.w - 8, this.y + this.h - 9);
    ctx.lineTo(this.x + this.w - 4 - swing, this.y + this.h);
    ctx.stroke();
  }
}

// Platforms
class Platform {
  constructor(x, y, w, h, type = 'normal', opts = {}) {
    this.ox = x; this.oy = y;
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.type = type;
    this.lastX = x; this.lastY = y;

    // moving
    this.moveAxis = opts.axis || 'x';
    this.moveRange = opts.range || 0;
    this.moveSpeed = opts.speed || 0;
    this.movePhase = opts.phase || 0;

    // collapsing
    this.collapseTouched = false;
    this.collapseTimer = 0;
    this.shake = 0;
    this.falling = false;
    this.dead = false;

    // falling / fake
    this.triggered = false;
    this.open = false;
    this.openTimer = 0;

    this.color = opts.color || this.getColor();
  }

  getColor() {
    switch (this.type) {
      case 'collapsing': return '#8e44ad';
      case 'falling': return '#7f8c8d';
      case 'fake': return '#27ae60';
      case 'moving': return '#2980b9';
      default: return '#2c3e50';
    }
  }

  reset() {
    this.x = this.ox; this.y = this.oy;
    this.lastX = this.ox; this.lastY = this.oy;
    this.collapseTouched = false; this.collapseTimer = 0; this.shake = 0; this.falling = false; this.dead = false;
    this.triggered = false; this.open = false; this.openTimer = 0;
  }

  update(dt, player) {
    this.lastX = this.x; this.lastY = this.y;

    if (this.type === 'moving' && this.moveRange > 0) {
      this.movePhase += this.moveSpeed * dt;
      const off = Math.sin(this.movePhase) * this.moveRange;
      if (this.moveAxis === 'x') this.x = this.ox + off;
      else this.y = this.oy + off;
    }

    if (this.type === 'collapsing') {
      if (!this.collapseTouched && !this.falling && !this.dead &&
          player.x + player.w > this.x && player.x < this.x + this.w &&
          player.y + player.h >= this.y - 2 && player.y + player.h <= this.y + this.h) {
        this.collapseTouched = true;
      }
      if (this.collapseTouched && !this.falling) {
        this.collapseTimer += dt;
        this.shake = (Math.random() - 0.5) * 6;
        if (this.collapseTimer > 0.7) { this.falling = true; this.shake = 0; }
      }
      if (this.falling) {
        this.y += 300 * dt;
        if (this.y > H + 100) this.dead = true;
      }
    }

    if (this.type === 'falling' || this.type === 'fake') {
      if (!this.triggered && !this.open &&
          player.x + player.w > this.x && player.x < this.x + this.w &&
          player.y + player.h >= this.y - 2 && player.y + player.h <= this.y + this.h) {
        this.triggered = true;
      }
      if (this.triggered && !this.open) {
        this.openTimer += dt;
        if (this.openTimer > (this.type === 'fake' ? 0.35 : 0.55)) { this.open = true; this.dead = true; }
      }
    }
  }

  draw(ctx) {
    if (this.dead) return;
    let px = this.x + this.shake;
    if (this.type === 'fake' && this.triggered && !this.open) {
      drawRect(ctx, px, this.y, this.w, this.h, '#c0392b');
    } else {
      drawRect(ctx, px, this.y, this.w, this.h, this.color, '#1a252f');
      // slight hatch for collapsible/fake
      if (this.type === 'collapsing') {
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath(); ctx.moveTo(px, this.y); ctx.lineTo(px + this.w, this.y + this.h); ctx.stroke();
      }
    }
  }
}

// Spikes
class Spike {
  constructor(x, y, w, h, hidden, triggerRect) {
    this.ox = x; this.oy = y;
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.hidden = hidden;
    this.emerged = !hidden;
    this.emergeTimer = 0;
    this.triggerRect = triggerRect;
    this.revealed = false;
  }

  reset() {
    this.x = this.ox; this.y = this.oy;
    this.emerged = !this.hidden;
    this.emergeTimer = 0;
    this.revealed = false;
  }

  update(dt, player) {
    if (this.hidden && !this.emerged) {
      if (!this.revealed) {
        const t = this.triggerRect;
        if (player.x + player.w > t.x && player.x < t.x + t.w &&
            player.y + player.h > t.y && player.y < t.y + t.h) {
          this.revealed = true;
        }
      }
      if (this.revealed) {
        this.emergeTimer += dt;
        if (this.emergeTimer > 0.25) this.emerged = true;
      }
    }
  }

  draw(ctx) {
    if (!this.emerged) {
      // barely visible warning tip
      ctx.fillStyle = '#b71c1c';
      ctx.fillRect(this.x, this.oy + this.h - 4, this.w, 4);
      return;
    }
    const t = this.emergeTimer < 0.35 ? this.emergeTimer / 0.35 : 1;
    const h = this.h * t;
    const y = this.oy + this.h - h;
    ctx.fillStyle = '#922b21';
    ctx.beginPath();
    ctx.moveTo(this.x, y + h);
    ctx.lineTo(this.x + this.w / 2, y);
    ctx.lineTo(this.x + this.w, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(this.x + 3, y + h);
    ctx.lineTo(this.x + this.w / 2, y + 4);
    ctx.lineTo(this.x + this.w - 3, y + h);
    ctx.closePath();
    ctx.fill();
  }
}

// Swinging blades
class Blade {
  constructor(anchorX, anchorY, length, speed, phase = 0) {
    this.anchorX = anchorX; this.anchorY = anchorY;
    this.length = length;
    this.speed = speed;
    this.phase = phase;
    this.angle = 0;
    this.tipX = 0; this.tipY = 0;
    this.radius = 14;
  }

  reset() { this.phase = 0; }

  update(dt, player) {
    this.phase += this.speed * dt;
    this.angle = Math.sin(this.phase) * 0.7;
    // Swing left-right from vertical
    this.tipX = this.anchorX + Math.sin(this.angle) * this.length;
    this.tipY = this.anchorY + Math.cos(this.angle) * this.length;
    if (!player.dead && circleRectOverlap(this.tipX, this.tipY, this.radius, player.x, player.y, player.w, player.h)) {
      killPlayer();
    }
  }

  draw(ctx) {
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.anchorX, this.anchorY);
    ctx.lineTo(this.tipX, this.tipY);
    ctx.stroke();
    ctx.fillStyle = 'rgba(231, 76, 60, 0.35)';
    ctx.beginPath();
    ctx.arc(this.tipX, this.tipY, this.radius + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.arc(this.tipX, this.tipY, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(this.tipX, this.tipY, this.radius - 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Moving walls (deadly)
class MovingWall {
  constructor(x, y, w, h, axis, range, speed, phase = 0) {
    this.ox = x; this.oy = y;
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.axis = axis;
    this.range = range;
    this.speed = speed;
    this.phase = phase;
    this.startPhase = phase;
  }

  reset() { this.phase = this.startPhase; this.x = this.ox; this.y = this.oy; }

  update(dt, player) {
    this.phase += this.speed * dt;
    const off = Math.sin(this.phase) * this.range;
    if (this.axis === 'x') this.x = this.ox + off;
    else this.y = this.oy + off;
    if (!player.dead && rectsOverlap(this, player)) killPlayer();
  }

  draw(ctx) {
    const glow = Math.abs(Math.sin(gameTime * 4)) * 0.15 + 0.2;
    ctx.fillStyle = 'rgba(231, 76, 60, ' + glow + ')';
    ctx.fillRect(this.x - 3, this.y - 3, this.w + 6, this.h + 6);
    drawRect(ctx, this.x, this.y, this.w, this.h, '#e74c3c', '#922b21');
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < this.w; i += 12) { ctx.fillRect(this.x + i, this.y, 3, this.h); }
    ctx.fillStyle = '#f5b7b1';
    ctx.fillRect(this.x, this.y, 4, this.h);
  }
}

// Ground blade (emerges from a platform/floor when triggered)
class GroundBlade {
  constructor(x, y, w, h, triggerRect) {
    this.ox = x; this.oy = y;
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.triggerRect = triggerRect;
    this.active = false;
    this.extended = false;
    this.timer = 0;
  }

  reset() {
    this.x = this.ox; this.y = this.oy;
    this.active = false; this.extended = false; this.timer = 0;
  }

  update(dt, player) {
    if (!this.active) {
      const t = this.triggerRect;
      if (player.x + player.w > t.x && player.x < t.x + t.w &&
          player.y + player.h > t.y && player.y < t.y + t.h) {
        this.active = true;
      }
      return;
    }
    this.timer += dt;
    if (!this.extended) {
      if (this.timer > 0.35) this.extended = true;
    } else if (this.timer > 1.35) {
      this.active = false; this.extended = false; this.timer = 0;
    }
    const progress = this.extended ? 1 : Math.min(1, this.timer / 0.35);
    this.y = this.oy - this.h * progress;
    if (!player.dead && rectsOverlap(this, player)) killPlayer();
  }

  draw(ctx) {
    if (!this.active) return;
    const progress = this.extended ? 1 : Math.min(1, this.timer / 0.35);
    const h = this.h * progress;
    const y = this.oy - h;
    ctx.fillStyle = '#7b241c';
    ctx.beginPath();
    ctx.moveTo(this.x, this.oy);
    ctx.lineTo(this.x + this.w / 2, y);
    ctx.lineTo(this.x + this.w, this.oy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.moveTo(this.x + 3, this.oy);
    ctx.lineTo(this.x + this.w / 2, y + 4);
    ctx.lineTo(this.x + this.w - 3, this.oy);
    ctx.closePath();
    ctx.fill();
  }
}

// Boulder (rolls from right to left along the ground)
class Boulder {
  constructor(x, y, r, speed) {
    this.ox = x; this.oy = y;
    this.x = x; this.y = y; this.r = r;
    this.speed = speed;
    this.angle = 0;
  }

  reset() { this.x = this.ox; this.y = this.oy; this.angle = 0; }

  update(dt, player) {
    this.x -= this.speed * dt;
    this.angle += this.speed * dt / this.r;
    if (!player.dead && circleRectOverlap(this.x, this.y, this.r, player.x, player.y, player.w, player.h)) {
      killPlayer();
      game.shake = 14;
    }
  }

  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = '#6e6e6e';
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#808080';
    ctx.beginPath(); ctx.arc(-this.r * 0.3, -this.r * 0.3, this.r * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#444'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-this.r * 0.5, -this.r * 0.2); ctx.lineTo(this.r * 0.4, this.r * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(this.r * 0.2, -this.r * 0.5); ctx.lineTo(-this.r * 0.3, this.r * 0.4); ctx.stroke();
    ctx.restore();
  }
}

// Coin
class Coin {
  constructor(x, y) {
    this.x = x; this.y = y; this.r = 10;
    this.collected = false;
    this.bob = Math.random() * Math.PI * 2;
  }

  reset() { this.collected = false; }

  update(dt) { this.bob += dt * 4; }

  draw(ctx) {
    if (this.collected) return;
    const yOff = Math.sin(this.bob) * 3;
    const drawY = this.y + yOff;
    const glow = Math.sin(gameTime * 4 + this.bob) * 0.15 + 0.35;
    ctx.fillStyle = 'rgba(255, 215, 0, ' + glow + ')';
    ctx.beginPath();
    ctx.arc(this.x, drawY, this.r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(this.x, drawY, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f39c12';
    ctx.beginPath();
    ctx.arc(this.x, drawY, this.r - 3, 0, Math.PI * 2);
    ctx.fill();
  }

  collect(player) {
    if (this.collected) return false;
    if (circleRectOverlap(this.x, this.y + Math.sin(this.bob) * 3, this.r, player.x, player.y, player.w, player.h)) {
      this.collected = true;
      game.totalCoins++;
      playCoin();
      spawnCoinSparkle(this);
      updateHUD();
      return true;
    }
    return false;
  }
}

// Exit door
class Exit {
  constructor(x, y) { this.x = x; this.y = y; this.w = 30; this.h = 64; }
  draw(ctx) {
    const pulse = Math.sin(gameTime * 5) * 0.15 + 0.35;
    ctx.fillStyle = 'rgba(46, 204, 113, ' + pulse + ')';
    ctx.fillRect(this.x - 6, this.y - 6, this.w + 12, this.h + 12);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(this.x + 4, this.y + 4, this.w - 8, this.h - 8);
    ctx.fillStyle = '#a9dfbf';
    ctx.beginPath(); ctx.arc(this.x + this.w - 8, this.y + this.h / 2, 4, 0, Math.PI * 2); ctx.fill();
  }
  collides(player) { return rectsOverlap(this, player); }
}

// Checkpoint
class Checkpoint {
  constructor(x, y, w = 10, h = 40) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.active = false;
    this.respawnX = x; this.respawnY = y - PLAYER_H;
  }

  reset() { this.active = false; }

  update(player) {
    if (!this.active && player.x + player.w > this.x && player.x < this.x + this.w &&
        player.y + player.h >= this.y && player.y <= this.y + this.h) {
      this.active = true;
      game.checkpoint = { x: this.respawnX, y: this.respawnY };
    }
  }

  draw(ctx) {
    ctx.fillStyle = this.active ? '#f1c40f' : '#7f8c8d';
    ctx.fillRect(this.x, this.y - this.h, this.w, this.h);
    ctx.fillStyle = this.active ? '#fff' : '#e74c3c';
    if (this.active) {
      ctx.shadowColor = '#f1c40f';
      ctx.shadowBlur = 10;
    }
    ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y - this.h - 7, 6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

class Ladder {
  constructor(x, y, w, h) {
    this.x = x; this.y = y; this.w = w; this.h = h;
  }
  draw(ctx) {
    ctx.strokeStyle = '#7f8c8d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x, this.y + this.h);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(this.x + this.w, this.y);
    ctx.lineTo(this.x + this.w, this.y + this.h);
    ctx.stroke();
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 2;
    for (let ly = this.y + 10; ly < this.y + this.h; ly += 14) {
      ctx.beginPath();
      ctx.moveTo(this.x, ly);
      ctx.lineTo(this.x + this.w, ly);
      ctx.stroke();
    }
  }
}

// Level factories
function makeLevel1() {
  return {
    number: 1,
    start: { x: 40, y: 386 },
    width: 1200,
    platforms: [
      new Platform(0, 420, 300, 60),
      new Platform(420, 420, 360, 60),
      new Platform(900, 420, 240, 60)
    ],
    spikes: [
      new Spike(620, 420, 20, 30, true, { x: 520, y: 360, w: 200, h: 80 })
    ],
    blades: [],
    movingWalls: [],
    coins: [
      new Coin(120, 380), new Coin(250, 380), new Coin(520, 380),
      new Coin(680, 380), new Coin(960, 380)
    ],
    exit: new Exit(1080, 356),
    checkpoint: null
  };
}

function makeLevel2() {
  return {
    number: 2,
    start: { x: 40, y: 386 },
    width: 1300,
    platforms: [
      new Platform(0, 420, 240, 60),
      new Platform(300, 420, 140, 60, 'collapsing'),
      new Platform(520, 420, 360, 60),
      new Platform(980, 420, 260, 60)
    ],
    spikes: [
      new Spike(740, 420, 20, 30, true, { x: 650, y: 360, w: 160, h: 80 })
    ],
    blades: [],
    movingWalls: [],
    coins: [
      new Coin(120, 380), new Coin(360, 350), new Coin(650, 380),
      new Coin(850, 380), new Coin(1150, 380)
    ],
    exit: new Exit(1160, 356),
    checkpoint: new Checkpoint(600, 420)
  };
}

function makeLevel3() {
  return {
    number: 3,
    start: { x: 40, y: 386 },
    width: 1500,
    platforms: [
      new Platform(0, 420, 160, 60),
      new Platform(240, 360, 100, 20, 'moving', { axis: 'x', range: 80, speed: 1.5 }),
      new Platform(460, 420, 200, 60),
      new Platform(760, 420, 180, 60),
      new Platform(1080, 420, 120, 60),
      new Platform(1220, 420, 240, 60)
    ],
    spikes: [
      new Spike(570, 420, 20, 30, true, { x: 460, y: 360, w: 200, h: 80 })
    ],
    blades: [
      new Blade(700, 260, 140, 2.5)
    ],
    movingWalls: [
      new MovingWall(1000, 300, 30, 120, 'y', 120, 2, -Math.PI / 2)
    ],
    coins: [
      new Coin(80, 380), new Coin(300, 320), new Coin(540, 380),
      new Coin(850, 380), new Coin(1120, 380), new Coin(1300, 380)
    ],
    exit: new Exit(1400, 356),
    checkpoint: new Checkpoint(800, 420)
  };
}

function makeLevel4() {
  return {
    number: 4,
    start: { x: 40, y: 386 },
    width: 1600,
    platforms: [
      new Platform(0, 420, 200, 60),
      new Platform(260, 360, 120, 20, 'fake'),
      new Platform(460, 420, 140, 60),
      new Platform(700, 420, 120, 60, 'falling'),
      new Platform(900, 420, 180, 60),
      new Platform(1160, 420, 120, 60),
      new Platform(1300, 420, 260, 60)
    ],
    spikes: [
      new Spike(310, 390, 22, 32, true, { x: 260, y: 300, w: 120, h: 70 })
    ],
    blades: [],
    movingWalls: [
      new MovingWall(1100, 300, 40, 120, 'y', 120, 2, -Math.PI / 2)
    ],
    coins: [
      new Coin(120, 380), new Coin(320, 320), new Coin(540, 380),
      new Coin(800, 360), new Coin(1200, 380), new Coin(1400, 380)
    ],
    exit: new Exit(1500, 356),
    checkpoint: new Checkpoint(600, 420)
  };
}

function makeLevel5() {
  return {
    number: 5,
    start: { x: 40, y: 386 },
    width: 2000,
    platforms: [
      new Platform(0, 420, 120, 60),
      new Platform(280, 420, 100, 20, 'collapsing'),
      new Platform(440, 420, 120, 60),
      new Platform(600, 420, 100, 20, 'collapsing'),
      new Platform(760, 420, 120, 60),
      new Platform(1050, 360, 100, 20, 'fake'),
      new Platform(1200, 420, 120, 60, 'falling'),
      new Platform(1350, 420, 150, 60),
      new Platform(1480, 360, 90, 20, 'moving', { axis: 'x', range: 70, speed: 1.8 }),
      new Platform(1620, 420, 300, 60)
    ],
    spikes: [
      new Spike(190, 420, 20, 30, true, { x: 120, y: 360, w: 80, h: 80 }),
      new Spike(1090, 390, 22, 32, true, { x: 1050, y: 300, w: 100, h: 70 }),
      new Spike(980, 420, 20, 30, true, { x: 900, y: 360, w: 120, h: 80 })
    ],
    blades: [
      new Blade(900, 260, 140, 2.5)
    ],
    movingWalls: [
      new MovingWall(1400, 280, 40, 120, 'y', 120, 2.5, -Math.PI / 2)
    ],
    coins: [
      new Coin(60, 380), new Coin(300, 350), new Coin(620, 350),
      new Coin(820, 380), new Coin(980, 320), new Coin(1260, 360),
      new Coin(1540, 320), new Coin(1840, 380)
    ],
    exit: new Exit(1900, 356),
    checkpoint: new Checkpoint(820, 420)
  };
}

function makeLevel6() {
  return {
    number: 6,
    start: { x: 60, y: 1166 },
    width: 800,
    height: 1200,
    platforms: [
      new Platform(0, 1200, 800, 60),
      new Platform(0, 1000, 380, 40),
      new Platform(420, 850, 380, 40),
      new Platform(0, 700, 380, 40),
      new Platform(420, 550, 380, 40),
      new Platform(0, 400, 380, 40),
      new Platform(120, 220, 560, 40)
    ],
    ladders: [
      new Ladder(300, 966, 60, 234),
      new Ladder(470, 816, 60, 184),
      new Ladder(300, 666, 60, 184),
      new Ladder(470, 516, 60, 184),
      new Ladder(300, 366, 60, 184),
      new Ladder(470, 186, 60, 214)
    ],
    spikes: [
      new Spike(320, 1000, 20, 30, true, { x: 0, y: 940, w: 380, h: 80 }),
      new Spike(600, 850, 20, 30, true, { x: 420, y: 790, w: 380, h: 80 }),
      new Spike(320, 700, 20, 30, true, { x: 0, y: 640, w: 380, h: 80 })
    ],
    blades: [
      new Blade(650, 750, 120, 2.5)
    ],
    movingWalls: [
      new MovingWall(650, 730, 30, 120, 'y', 120, 2.5, -Math.PI / 2)
    ],
    coins: [
      new Coin(120, 960), new Coin(600, 810), new Coin(120, 660),
      new Coin(600, 510), new Coin(120, 360), new Coin(700, 180)
    ],
    exit: new Exit(700, 156),
    checkpoint: new Checkpoint(300, 400)
  };
}

function makeLevel7() {
  return {
    number: 7,
    start: { x: 60, y: 1566 },
    width: 1200,
    height: 1600,
    platforms: [
      new Platform(0, 1600, 400, 60),
      new Platform(400, 1450, 360, 40),
      new Platform(0, 1300, 360, 40),
      new Platform(400, 1150, 360, 40),
      new Platform(0, 1000, 360, 40),
      new Platform(400, 850, 360, 40),
      new Platform(0, 700, 360, 40),
      new Platform(400, 550, 360, 40),
      new Platform(200, 350, 800, 40)
    ],
    ladders: [
      new Ladder(300, 1416, 60, 184),
      new Ladder(700, 1266, 60, 184),
      new Ladder(300, 1116, 60, 184),
      new Ladder(700, 966, 60, 184),
      new Ladder(300, 816, 60, 184),
      new Ladder(700, 666, 60, 184),
      new Ladder(300, 516, 60, 184),
      new Ladder(700, 316, 60, 234)
    ],
    spikes: [
      new Spike(180, 1450, 20, 30, true, { x: 400, y: 1390, w: 360, h: 80 }),
      new Spike(580, 1300, 20, 30, true, { x: 0, y: 1240, w: 360, h: 80 }),
      new Spike(180, 1150, 20, 30, true, { x: 400, y: 1090, w: 360, h: 80 }),
      new Spike(580, 850, 20, 30, true, { x: 400, y: 790, w: 360, h: 80 })
    ],
    blades: [
      new Blade(650, 1100, 120, 2.5),
      new Blade(100, 600, 120, 2.5)
    ],
    movingWalls: [
      new MovingWall(600, 1360, 30, 120, 'y', 120, 2.5, -Math.PI / 2)
    ],
    coins: [
      new Coin(80, 1560), new Coin(600, 1410), new Coin(120, 1260),
      new Coin(600, 1110), new Coin(120, 960), new Coin(600, 810),
      new Coin(120, 660), new Coin(600, 510), new Coin(800, 310)
    ],
    exit: new Exit(900, 286),
    checkpoint: new Checkpoint(200, 550)
  };
}

function makeLevel8() {
  return {
    number: 8,
    start: { x: 60, y: 386 },
    width: 2400,
    platforms: [
      new Platform(0, 420, 180, 60),
      new Platform(240, 420, 120, 60, 'collapsing'),
      new Platform(420, 420, 140, 60),
      new Platform(620, 360, 120, 20, 'fake'),
      new Platform(780, 420, 200, 60),
      new Platform(1040, 420, 160, 60, 'falling'),
      new Platform(1260, 420, 120, 60),
      new Platform(1440, 360, 140, 20, 'moving', { axis: 'x', range: 80, speed: 1.8 }),
      new Platform(1660, 420, 200, 60),
      new Platform(1920, 420, 420, 60)
    ],
    spikes: [
      new Spike(490, 420, 22, 34, true, { x: 420, y: 360, w: 140, h: 80 }),
      new Spike(1000, 420, 22, 34, true, { x: 880, y: 360, w: 160, h: 80 }),
      new Spike(1500, 360, 22, 34, true, { x: 1440, y: 300, w: 140, h: 80 }),
      new Spike(1820, 420, 22, 34, true, { x: 1720, y: 360, w: 160, h: 80 })
    ],
    blades: [
      new Blade(940, 260, 140, 2.5),
      new Blade(1700, 260, 140, 2)
    ],
    movingWalls: [
      new MovingWall(1180, 300, 35, 110, 'y', 110, 2.2, -Math.PI / 2),
      new MovingWall(2060, 300, 35, 110, 'y', 110, 2.6, 0)
    ],
    groundBlades: [
      new GroundBlade(300, 420, 28, 40, { x: 220, y: 340, w: 120, h: 100 }),
      new GroundBlade(1330, 420, 28, 40, { x: 1280, y: 340, w: 100, h: 100 }),
      new GroundBlade(1820, 420, 28, 40, { x: 1760, y: 340, w: 140, h: 100 })
    ],
    boulders: [
      new Boulder(1100, 410, 22, 280),
      new Boulder(1700, 410, 24, 340),
      new Boulder(2300, 410, 24, 300)
    ],
    coins: [
      new Coin(80, 380), new Coin(300, 350), new Coin(500, 380),
      new Coin(700, 320), new Coin(1100, 380), new Coin(1320, 380),
      new Coin(1520, 320), new Coin(1780, 380), new Coin(2020, 380),
      new Coin(2240, 380)
    ],
    exit: new Exit(2280, 356),
    checkpoint: new Checkpoint(900, 420)
  };
}

function makeLevel9() {
  return {
    number: 9,
    start: { x: 60, y: 1966 },
    width: 1000,
    height: 2000,
    platforms: [
      new Platform(0, 2000, 320, 60),
      new Platform(360, 1850, 280, 40),
      new Platform(720, 1700, 280, 40),
      new Platform(0, 1550, 320, 40),
      new Platform(360, 1400, 280, 40),
      new Platform(720, 1250, 280, 40),
      new Platform(0, 1100, 320, 40),
      new Platform(360, 950, 280, 40),
      new Platform(720, 800, 280, 40),
      new Platform(0, 650, 320, 40),
      new Platform(360, 500, 640, 40)
    ],
    ladders: [
      new Ladder(130, 1816, 60, 184),
      new Ladder(470, 1666, 60, 184),
      new Ladder(820, 1366, 60, 184),
      new Ladder(470, 1216, 60, 184),
      new Ladder(130, 916, 60, 184),
      new Ladder(470, 766, 60, 184),
      new Ladder(820, 566, 60, 184),
      new Ladder(680, 500, 60, 100)
    ],
    spikes: [
      new Spike(180, 1850, 20, 30, true, { x: 360, y: 1790, w: 280, h: 80 }),
      new Spike(580, 1700, 20, 30, true, { x: 720, y: 1640, w: 280, h: 80 }),
      new Spike(180, 1100, 20, 30, true, { x: 0, y: 1040, w: 320, h: 80 }),
      new Spike(580, 800, 20, 30, true, { x: 720, y: 740, w: 280, h: 80 })
    ],
    blades: [
      new Blade(500, 1750, 120, 2.5),
      new Blade(500, 1100, 120, 2.2)
    ],
    movingWalls: [
      new MovingWall(250, 1800, 30, 120, 'y', 120, 2.4, -Math.PI / 2),
      new MovingWall(850, 1500, 30, 120, 'y', 120, 2.6, 0)
    ],
    groundBlades: [
      new GroundBlade(100, 2000, 26, 38, { x: 20, y: 1920, w: 120, h: 100 }),
      new GroundBlade(400, 1550, 26, 38, { x: 340, y: 1470, w: 120, h: 100 }),
      new GroundBlade(700, 650, 26, 38, { x: 660, y: 570, w: 120, h: 100 })
    ],
    boulders: [
      new Boulder(900, 1840, 22, 260),
      new Boulder(900, 1140, 22, 260),
      new Boulder(900, 440, 22, 280)
    ],
    coins: [
      new Coin(120, 1960), new Coin(500, 1810), new Coin(850, 1660),
      new Coin(200, 1510), new Coin(500, 1360), new Coin(850, 1210),
      new Coin(200, 1060), new Coin(500, 910), new Coin(850, 760),
      new Coin(700, 460)
    ],
    exit: new Exit(820, 436),
    checkpoint: new Checkpoint(360, 500)
  };
}

function makeLevel10() {
  return {
    number: 10,
    start: { x: 60, y: 386 },
    width: 3000,
    platforms: [
      new Platform(0, 420, 160, 60),
      new Platform(220, 420, 120, 20, 'collapsing'),
      new Platform(400, 420, 160, 60),
      new Platform(620, 360, 140, 20, 'fake'),
      new Platform(820, 420, 200, 60, 'falling'),
      new Platform(1080, 420, 140, 60),
      new Platform(1280, 360, 160, 20, 'moving', { axis: 'x', range: 90, speed: 2 }),
      new Platform(1520, 420, 120, 60),
      new Platform(1700, 360, 120, 20, 'fake'),
      new Platform(1900, 420, 200, 60),
      new Platform(2160, 420, 140, 60),
      new Platform(2360, 360, 160, 20, 'moving', { axis: 'x', range: 80, speed: 2.2 }),
      new Platform(2600, 420, 360, 60)
    ],
    spikes: [
      new Spike(480, 420, 22, 34, true, { x: 400, y: 360, w: 160, h: 80 }),
      new Spike(1160, 420, 22, 34, true, { x: 1080, y: 360, w: 140, h: 80 }),
      new Spike(1480, 360, 22, 34, true, { x: 1280, y: 300, w: 160, h: 80 }),
      new Spike(2060, 420, 22, 34, true, { x: 1900, y: 360, w: 160, h: 80 }),
      new Spike(2520, 360, 22, 34, true, { x: 2360, y: 300, w: 160, h: 80 })
    ],
    blades: [
      new Blade(760, 260, 140, 2.5),
      new Blade(1400, 260, 140, 2.2),
      new Blade(2100, 260, 140, 2.5)
    ],
    movingWalls: [
      new MovingWall(1000, 300, 35, 110, 'y', 110, 2.4, -Math.PI / 2),
      new MovingWall(1800, 300, 35, 110, 'y', 110, 2.6, 0),
      new MovingWall(2700, 300, 35, 110, 'y', 110, 2.8, Math.PI / 2)
    ],
    groundBlades: [
      new GroundBlade(140, 420, 28, 42, { x: 60, y: 340, w: 120, h: 100 }),
      new GroundBlade(1340, 420, 28, 42, { x: 1280, y: 340, w: 120, h: 100 }),
      new GroundBlade(1980, 420, 28, 42, { x: 1920, y: 340, w: 120, h: 100 }),
      new GroundBlade(2500, 420, 28, 42, { x: 2440, y: 340, w: 120, h: 100 })
    ],
    boulders: [
      new Boulder(1200, 410, 24, 320),
      new Boulder(1800, 410, 24, 360),
      new Boulder(2600, 410, 24, 320),
      new Boulder(2900, 410, 24, 300)
    ],
    coins: [
      new Coin(80, 380), new Coin(280, 350), new Coin(480, 380),
      new Coin(680, 320), new Coin(1160, 380), new Coin(1360, 320),
      new Coin(1600, 380), new Coin(2020, 380), new Coin(2220, 380),
      new Coin(2480, 320), new Coin(2780, 380)
    ],
    exit: new Exit(2860, 356),
    checkpoint: new Checkpoint(1100, 420)
  };
}

const LEVELS = [makeLevel1, makeLevel2, makeLevel3, makeLevel4, makeLevel5, makeLevel6, makeLevel7, makeLevel8, makeLevel9, makeLevel10];

// Game logic
function loadLevel(n) {
  game.currentLevel = n;
  game.level = LEVELS[n - 1]();
  game.player = new Player(game.level.start.x, game.level.start.y);
  game.lives = 3;
  game.livesRefillEnd = 0;
  game.checkpoint = null;
  game.camera.x = 0;
  game.camera.y = 0;
  game.shake = 0;
  game.particles = [];
  game.pendingGameOver = false;
  game.state = 'playing';
  hideAllScreens();
  showScreen('hud');
  showScreen('mobile-controls');
  saveProgress();
  updateHUD();
  initAudio();
  startMusic();
}

function resetGame() {
  game.unlocked = 1;
  game.totalCoins = 0;
  game.deaths = 0;
  game.currentLevel = 1;
  game.livesRefillEnd = 0;
  game.lives = 3;
  try { localStorage.removeItem('trapPath'); } catch (e) {}
}

function saveProgress() {
  try {
    localStorage.setItem('trapPath', JSON.stringify({
      currentLevel: game.currentLevel,
      unlocked: game.unlocked,
      lives: game.lives,
      totalCoins: game.totalCoins,
      deaths: game.deaths,
      livesRefillEnd: game.livesRefillEnd
    }));
  } catch (e) {}
}

function loadSave() {
  try {
    const data = localStorage.getItem('trapPath');
    if (!data) return;
    const save = JSON.parse(data);
    game.currentLevel = save.currentLevel || 1;
    game.unlocked = save.unlocked || 1;
    game.lives = save.lives ?? 3;
    game.totalCoins = save.totalCoins || 0;
    game.deaths = save.deaths || 0;
    game.livesRefillEnd = save.livesRefillEnd || 0;
    if (game.livesRefillEnd > Date.now()) {
      game.state = 'gameover';
      game.player = null;
      game.level = null;
      showGameOver();
      startLivesRefill();
    } else if (game.lives <= 0) {
      game.lives = 3;
      game.livesRefillEnd = 0;
      saveProgress();
    }
  } catch (e) {}
}

function showGameOver() {
  hideAllScreens();
  hideScreen('hud');
  hideScreen('mobile-controls');
  stopMusic();
  showScreen('game-over');
}

function startLivesRefill() {
  if (game.livesRefillEnd <= Date.now()) game.livesRefillEnd = Date.now() + REFILL_MS;
  const tryBtn = document.getElementById('btn-try-again');
  if (tryBtn) tryBtn.disabled = true;
  updateRefillText();
  if (refillTimer) clearInterval(refillTimer);
  refillTimer = setInterval(() => {
    updateRefillText();
    if (Date.now() >= game.livesRefillEnd) {
      clearInterval(refillTimer);
      refillTimer = null;
      game.lives = 3;
      game.livesRefillEnd = 0;
      saveProgress();
      if (tryBtn) tryBtn.disabled = false;
    }
  }, 1000);
}

function updateRefillText() {
  const remaining = Math.max(0, game.livesRefillEnd - Date.now());
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const text = `${mins}:${secs.toString().padStart(2, '0')}`;
  const timerText = document.getElementById('refill-timer');
  if (timerText) {
    if (remaining <= 0) {
      timerText.textContent = 'Lives refilled! Tap TRY AGAIN';
    } else {
      timerText.textContent = 'Lives refill in ' + text;
    }
  }
}

function killPlayer() {
  if (game.player.dead) return;
  game.player.dead = true;
  game.player.deadTimer = 0.7;
  game.overlayTimer = 0.6;
  game.deaths++;
  game.lives--;
  playDeath();
  spawnDeathBurst(game.player);
  game.shake = 12;
  updateHUD();
  showDied();
  if (game.lives <= 0) {
    game.pendingGameOver = true;
    game.livesRefillEnd = Date.now() + REFILL_MS;
    saveProgress();
  }
}

function respawn() {
  const pos = game.checkpoint || game.level.start;
  game.player.reset(pos.x, pos.y);
  game.level.platforms.forEach(p => p.reset());
  game.level.spikes.forEach(s => s.reset());
  game.level.blades.forEach(b => b.reset());
  game.level.movingWalls.forEach(m => m.reset());
  if (game.level.groundBlades) game.level.groundBlades.forEach(g => g.reset());
  if (game.level.boulders) game.level.boulders.forEach(b => b.reset());
  if (game.level.checkpoint) game.level.checkpoint.reset();
  if (game.checkpoint) game.level.checkpoint.active = true;
  hideDied();
}

function completeLevel() {
  playWin();
  stopMusic();
  if (game.currentLevel < TOTAL_LEVELS) {
    game.unlocked = Math.max(game.unlocked, game.currentLevel + 1);
    game.state = 'complete';
    hideAllScreens();
    hideScreen('mobile-controls');
    saveProgress();
    document.getElementById('level-coins').textContent = 'Coins: ' + game.totalCoins;
    document.getElementById('level-complete-number').textContent = 'Level ' + game.currentLevel + ' complete';
    showScreen('level-complete');
  } else {
    game.state = 'victory';
    hideAllScreens();
    hideScreen('mobile-controls');
    saveProgress();
    document.getElementById('victory-coins').textContent = 'Total coins: ' + game.totalCoins;
    document.getElementById('victory-deaths').textContent = 'Deaths: ' + game.deaths;
    showScreen('victory-screen');
  }
}

function update(dt) {
  if (game.state !== 'playing') return;

  gameTime += dt;

  if (game.player.dead) {
    game.player.deadTimer -= dt;
    game.overlayTimer -= dt;
    if (game.overlayTimer <= 0) hideDied();
    if (game.player.deadTimer <= 0) {
      if (game.pendingGameOver) {
        game.state = 'gameover';
        showGameOver();
        startLivesRefill();
      } else {
        respawn();
      }
    }
    return;
  }

  // Update platforms before player so we can carry
  game.level.platforms.forEach(p => p.update(dt, game.player));

  // Update player
  game.player.update(dt);

  // Update traps and extras
  game.level.spikes.forEach(s => s.update(dt, game.player));
  game.level.blades.forEach(b => b.update(dt, game.player));
  game.level.movingWalls.forEach(m => m.update(dt, game.player));
  if (game.level.groundBlades) game.level.groundBlades.forEach(g => g.update(dt, game.player));
  if (game.level.boulders) game.level.boulders.forEach(b => b.update(dt, game.player));
  game.level.checkpoint && game.level.checkpoint.update(game.player);
  game.level.coins.forEach(c => c.update(dt));
  game.level.coins.forEach(c => c.collect(game.player));

  // Check spike collision after they may have emerged
  game.level.spikes.forEach(s => {
    if (s.emerged && !game.player.dead && rectsOverlap(game.player, s)) killPlayer();
  });

  // Check falling into fake / collapsing pit
  const levelHeight = game.level.height || H;
  if (game.player.y > levelHeight + 80 && !game.player.dead) killPlayer();

  // Check exit
  if (game.level.exit.collides(game.player)) {
    completeLevel();
  }

  // Particles
  game.particles.forEach(p => p.update(dt));
  game.particles = game.particles.filter(p => p.life > 0);

  // Shake decay
  game.shake *= 0.85;

  // Camera (smooth follow)
  const targetX = game.player.x + game.player.w / 2 - W / 2;
  const maxCamX = Math.max(0, game.level.width - W);
  game.camera.x += (clamp(targetX, 0, maxCamX) - game.camera.x) * 0.08;
  const targetY = game.player.y + game.player.h / 2 - H / 2;
  game.camera.y += (clamp(targetY, 0, Math.max(0, levelHeight - H)) - game.camera.y) * 0.08;
}

function levelBackground(n) {
  const bgs = [
    ['#1a1a1a', '#050505'],   // 1 - steel grey
    ['#2a0a0a', '#080303'],   // 2 - red
    ['#0a2a0a', '#030803'],   // 3 - green
    ['#0a0a2a', '#030308'],   // 4 - blue
    ['#2a1a0a', '#080503'],   // 5 - orange/brown
    ['#1a0a2a', '#050308'],   // 6 - purple
    ['#0a1a2a', '#030508'],   // 7 - deep cyan
    ['#2a0a1a', '#080305'],   // 8 - magenta
    ['#0a2a2a', '#030808'],   // 9 - teal
    ['#2a0808', '#080202']    // 10 - blood red
  ];
  return bgs[(n - 1) % bgs.length] || ['#0d0d0d', '#0d0d0d'];
}

function draw() {
  if (!game.level || !game.player) {
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, W, H);
    return;
  }
  // Background
  const [top, bottom] = levelBackground(game.level.number);
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, top);
  bg.addColorStop(1, bottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  const shakeX = game.shake > 0.5 ? (Math.random() - 0.5) * game.shake : 0;
  const shakeY = game.shake > 0.5 ? (Math.random() - 0.5) * game.shake : 0;
  ctx.translate(-Math.floor(game.camera.x) + shakeX, -Math.floor(game.camera.y) + shakeY);

  // Draw level background grid for depth
  const levelH = game.level.height || H;
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= game.level.width; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, levelH); ctx.stroke();
  }
  for (let y = 0; y <= levelH; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(game.level.width, y); ctx.stroke();
  }

  // Entities
  game.level.platforms.forEach(p => p.draw(ctx));
  if (game.level.checkpoint) game.level.checkpoint.draw(ctx);
  game.level.coins.forEach(c => c.draw(ctx));
  game.level.spikes.forEach(s => s.draw(ctx));
  game.level.blades.forEach(b => b.draw(ctx));
  game.level.movingWalls.forEach(m => m.draw(ctx));
  if (game.level.groundBlades) game.level.groundBlades.forEach(g => g.draw(ctx));
  if (game.level.boulders) game.level.boulders.forEach(b => b.draw(ctx));
  if (game.level.ladders) game.level.ladders.forEach(l => l.draw(ctx));
  game.level.exit.draw(ctx);

  // Particles
  game.particles.forEach(p => p.draw(ctx));

  // Player
  if (!game.player.dead || Math.floor(gameTime * 10) % 2 === 0) {
    game.player.draw(ctx);
  }

  ctx.restore();
}

function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// UI wiring
function playIntro() {
  const runner = document.getElementById('runner');
  const credit = document.getElementById('intro-credit');
  if (!runner || !credit) return;
  runner.classList.remove('run');
  credit.classList.remove('show');
  void runner.offsetWidth;
  void credit.offsetWidth;
  runner.classList.add('run');
  credit.classList.add('show');
}

function showStart() {
  game.state = 'start';
  hideAllScreens();
  hideScreen('hud');
  hideScreen('mobile-controls');
  stopMusic();
  showScreen('start-screen');
  playIntro();
}

function showLevelSelect() {
  game.state = 'select';
  hideAllScreens();
  hideScreen('hud');
  hideScreen('mobile-controls');
  stopMusic();
  showScreen('level-select');
  const container = document.getElementById('level-buttons');
  container.innerHTML = '';
  for (let i = 1; i <= TOTAL_LEVELS; i++) {
    const btn = document.createElement('button');
    btn.textContent = 'LEVEL ' + i;
    btn.disabled = i > game.unlocked;
    btn.addEventListener('click', () => showLevelStart(i));
    container.appendChild(btn);
  }
}

function showLevelStart(n) {
  game.state = 'transition';
  hideAllScreens();
  hideScreen('hud');
  hideScreen('mobile-controls');
  stopMusic();
  const title = document.getElementById('level-start-title');
  const screen = document.getElementById('level-start');
  if (title) title.textContent = 'LEVEL ' + n;
  screen.classList.remove('active');
  void screen.offsetWidth;
  screen.classList.add('active');
  showScreen('level-start');
  setTimeout(() => {
    loadLevel(n);
  }, 1400);
}

document.getElementById('btn-start').addEventListener('click', showLevelSelect);
document.getElementById('btn-back').addEventListener('click', showStart);
document.getElementById('btn-resume').addEventListener('click', () => { game.state = 'playing'; hideScreen('pause-menu'); showScreen('mobile-controls'); });
document.getElementById('btn-restart').addEventListener('click', () => { loadLevel(game.currentLevel); hideScreen('pause-menu'); });
document.getElementById('btn-quit').addEventListener('click', showStart);
document.getElementById('btn-continue').addEventListener('click', () => { showLevelStart(game.currentLevel + 1); });
document.getElementById('btn-levels-complete').addEventListener('click', showLevelSelect);
document.getElementById('btn-try-again').addEventListener('click', () => {
  if (game.livesRefillEnd > Date.now()) return;
  loadLevel(game.currentLevel);
});
document.getElementById('btn-levels-gameover').addEventListener('click', showLevelSelect);
document.getElementById('btn-restart-game').addEventListener('click', () => { resetGame(); showStart(); });
document.getElementById('btn-levels-victory').addEventListener('click', showLevelSelect);
document.getElementById('btn-pause-levels').addEventListener('click', showLevelSelect);
const hudPause = document.getElementById('btn-pause-hud');
if (hudPause) hudPause.addEventListener('click', togglePause);

// Mobile touch controls
function setupMobileControls() {
  const left = document.getElementById('m-left');
  const right = document.getElementById('m-right');
  const jump = document.getElementById('m-jump');
  if (!left || !right || !jump) return;

  function bind(btn, code) {
    const onDown = (e) => { e.preventDefault(); keys[code] = true; keysPressed[code] = true; };
    const onUp = (e) => { e.preventDefault(); keys[code] = false; keysPressed[code] = false; };
    btn.addEventListener('touchstart', onDown, { passive: false });
    btn.addEventListener('touchend', onUp);
    btn.addEventListener('touchcancel', onUp);
    btn.addEventListener('mousedown', onDown);
    btn.addEventListener('mouseup', onUp);
    btn.addEventListener('mouseleave', onUp);
  }
  bind(left, 'ArrowLeft');
  bind(right, 'ArrowRight');
  bind(jump, 'Space');
}
setupMobileControls();

// Register service worker for PWA install
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// Init
loadSave();
if (game.state !== 'gameover') showStart();
requestAnimationFrame(loop);
