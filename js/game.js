/* ═══════════════════════════════════════════════════════════════
   JUNGLE RUN — game.js
   Complete 2D Endless Runner | Vanilla JS + Canvas
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 1. CANVAS SETUP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const canvas = document.getElementById('gc');
const ctx    = canvas.getContext('2d');
canvas.width  = 800;
canvas.height = 400;

const W = 800, H = 400;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2. CONSTANTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const GY    = 318;   // Ground Y (player stands here)
const PX    = 130;   // Player fixed X
const PW    = 36;    // Player bounding width
const PH    = 60;    // Player standing height
const SH    = 28;    // Player sliding height

const GRAV  = 0.68;
const JF    = -16.0; // Jump force
const JF2   = -12.5; // Double-jump force
const SF    = -7.5;  // Swim jump force

const BASE_SPD = 4.2;
const MAX_SPD  = 12.5;
const SPD_INC  = 0.0009; // Speed increase per frame

// Vine obstacle clearance: vine bottom must be below this for player to slide under
const VINE_BOTTOM = GY - SH - 6;   // ≈284 — sliding player top is GY-SH=290, so clears vine at 284

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 3. CHARACTER DEFINITIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CHARS = [
  { name:'GRONK', skin:'#C8956B', hair:'#2D1200', cloth:'#8B5E15', detail:'#5C3D0A', acc:'#F0C030' },
  { name:'ZARA',  skin:'#CE8255', hair:'#100400', cloth:'#9B1C1C', detail:'#6B0505', acc:'#F0A020' },
  { name:'MIKO',  skin:'#B2C89A', hair:'#F2ECC2', cloth:'#1F5C08', detail:'#0A3D00', acc:'#80FF40' },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 4. GAME STATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let gState   = 'start';  // start | select | play | over
let selChar  = -1;
let score    = 0;
let hiScore  = parseInt(localStorage.getItem('jr_hi') || '0', 10);
let gSpeed   = BASE_SPD;
let gFrame   = 0;
let shakeT   = 0;
let shakeAmp = 0;
let nextWater = 999999; // disabled

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 5. PLAYER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const P = {
  x: PX, y: GY - PH,
  vy: 0,
  onGnd: true,
  sliding: false,
  slideT: 0,
  jumps: 0,
  dead: false,
  flashT: 0,
  af: 0,   // animation frame index
  at: 0,   // animation tick counter

  reset() {
    this.y = GY - PH; this.vy = 0; this.onGnd = true;
    this.sliding = false; this.slideT = 0; this.jumps = 0;
    this.dead = false; this.flashT = 0; this.af = 0; this.at = 0;
  },

  jump() {
    if (this.dead) return;
    if (this.onGnd) {
      this.vy = JF; this.onGnd = false; this.sliding = false;
      this.jumps = 1; spawnPfx(PX + PW / 2, GY, 'dust'); return;
    }
    if (this.jumps < 2) {
      this.vy = JF2; this.jumps = 2;
      spawnPfx(PX + PW / 2, this.y + PH / 2, 'puff');
    }
  },

  slide() {
    if (this.dead || this.sliding || !this.onGnd) return;
    this.sliding = true; this.slideT = 38;
  },

  update() {
    if (this.dead) { this.flashT = Math.max(0, this.flashT - 1); return; }

    // Gravity
    if (!this.onGnd) this.vy += GRAV;

    this.y += this.vy;

    const groundTop = GY - (this.sliding ? SH : PH);
    if (this.y >= groundTop) {
      if (!this.onGnd) spawnPfx(PX + PW / 2, GY, 'dust');
      this.y = groundTop; this.vy = 0; this.onGnd = true; this.jumps = 0;
    }
    // Snap y up when slide starts while on ground (y was at GY-PH, must move to GY-SH)
    if (this.sliding && this.onGnd) this.y = GY - SH;

    // Slide timer
    if (this.sliding) { this.slideT--; if (!this.slideT) this.sliding = false; }

    // Advance animation
    this.at++;
    const spd = this.sliding ? 10 : (this.onGnd ? 7 : 9);
    if (this.at >= spd) {
      this.at = 0;
      const maxF = this.sliding ? 2 : (this.onGnd ? 6 : 3);
      this.af = (this.af + 1) % maxF;
    }
  },

  state() {
    if (this.sliding) return 'slide';
    if (!this.onGnd)  return this.vy < 0 ? 'jump' : 'fall';
    return 'run';
  },

  hbox() {
    const h = this.sliding ? SH : PH;
    return { x: this.x + 6, y: this.y, w: PW - 12, h };
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6. OBSTACLE POOL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/*
  Obstacle types:
    stump  — tall tree stump, ground, jump over
    rock   — rock pile, ground, jump over
    box    — ancient wooden crate, ground, jump over
    vine   — hanging vine curtain, aerial, slide under
    dstump — double stump, ground, jump over (harder)
    log    — floating log, water only, jump over
*/
const ODEFS = {
  stump:  { w:34, h:28, aerial:false  },
  rock:   { w:44, h:26, aerial:false  },
  box:    { w:34, h:32, aerial:false  },
  branch: { w:48, h:80, aerial:'low' },
  vine:   { w:32, h:0,  aerial:true  },
  dstump: { w:76, h:28, aerial:false  },
};

const pool   = [];   // recycled obstacle objects
const active = [];   // currently active obstacles

let spawnT    = 0;
let spawnGap  = 90;  // dynamic, decreases with speed

function getOb() { return pool.pop() || {}; }
function retOb(o) { active.splice(active.indexOf(o), 1); pool.push(o); }

function spawnObstacle() {
  const groundTypes = ['stump', 'rock', 'box', 'vine', 'branch'];
  if (gSpeed > 7.0) groundTypes.push('dstump');
  if (gSpeed > 5.5) { groundTypes.push('branch'); groundTypes.push('vine'); }

  const avail = groundTypes;
  const key   = avail[Math.floor(Math.random() * avail.length)];
  const def   = ODEFS[key];

  const o = getOb();
  o.key = key; o.w = def.w; o.h = def.h;
  o.x = W + 60;

  if (def.aerial === true) {
    o.y = 0; // vine: from top of screen
  } else if (def.aerial === 'low') {
    o.y = GY - def.h; // branch: canopy hangs, trunk at ground
  } else {
    o.y = GY - def.h;
  }

  active.push(o);
}

function updateObstacles() {
  spawnT++;
  // Spawn interval shrinks as speed rises
  spawnGap = Math.max(42, Math.round(105 - gSpeed * 5));

  if (spawnT >= spawnGap) {
    spawnT = 0;
    spawnObstacle();
  }

  for (let i = active.length - 1; i >= 0; i--) {
    const o = active[i];
    o.x -= gSpeed;
    if (o.x + o.w < -20) {
      score += 8;  // passed obstacle bonus
      retOb(o);
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 8. PARTICLE SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const parts = [];

function spawnPfx(x, y, type) {
  const n = type === 'hit' ? 14 : type === 'puff' ? 8 : 7;
  for (let i = 0; i < n; i++) {
    const a = (Math.random() * Math.PI * 2);
    const s = 0.8 + Math.random() * 3.5;
    parts.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s * 0.8 - (type === 'dust' || type === 'puff' ? 2.5 : 0),
      life: 1.0,
      dec: 0.035 + Math.random() * 0.025,
      r: 2 + Math.random() * 4,
      col: type === 'hit'    ? '#FF5020'
         : type === 'puff'   ? '#E0C890'
         :                     '#B89060',
    });
  }
}

function updateParts() {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.life -= p.dec;
    if (p.life <= 0) parts.splice(i, 1);
  }
}

function drawParts() {
  for (const p of parts) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.col;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 9. PARALLAX BACKGROUND RENDERER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Each layer has its own scroll offset
const bgOff = [0, 0, 0, 0, 0]; // 5 parallax layers
const bgSpd = [0, 0.10, 0.22, 0.42, 0.72]; // speed multipliers

// Deterministic mountain/tree shapes (seeded arrays)
const MTN_PTS = [0,200,70,138,150,178,240,105,330,158,420,85,510,140,600,168,690,98,760,155,800,195];
const TREE_XS = [0,80,170,255,340,430,515,605,695,780];
const TREE_HS = [128,148,118,162,138,152,125,158,140,135];

function updateBg() {
  for (let i = 1; i < 5; i++) {
    bgOff[i] = (bgOff[i] + gSpeed * bgSpd[i]) % W;
  }
}

function drawBg() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#1A3A2A');
  sky.addColorStop(0.65, '#2E6B3E');
  sky.addColorStop(1, '#4A8B5A');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  drawSun();
  drawMountains(bgOff[1]);
  drawMidForest(bgOff[2]);
  drawNearTrees(bgOff[3]);
  drawGround(bgOff[4]);
}

function drawSun() {
  const sx = 690, sy = 58;
  ctx.save();
  // Glow
  const glow = ctx.createRadialGradient(sx, sy, 4, sx, sy, 70);
  glow.addColorStop(0, 'rgba(255,240,140,0.85)');
  glow.addColorStop(0.35, 'rgba(255,200,60,0.30)');
  glow.addColorStop(1,   'rgba(255,150,20,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(sx - 70, sy - 70, 140, 140);
  // Disc
  ctx.fillStyle = '#FFF0A8';
  ctx.beginPath(); ctx.arc(sx, sy, 20, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawMountains(off) {
  for (let t = 0; t < 2; t++) {
    const ox = -off + t * W;
    ctx.fillStyle = '#182A18';
    ctx.beginPath();
    ctx.moveTo(ox + MTN_PTS[0], MTN_PTS[1]);
    for (let i = 2; i < MTN_PTS.length; i += 2) {
      ctx.lineTo(ox + MTN_PTS[i], MTN_PTS[i + 1]);
    }
    ctx.lineTo(ox + W, H); ctx.lineTo(ox, H); ctx.closePath();
    ctx.fill();
  }
}

function drawMidForest(off) {
  for (let t = 0; t < 2; t++) {
    const ox = -off + t * W;
    ctx.fillStyle = '#0E2810';
    ctx.beginPath();
    ctx.moveTo(ox, H);
    // Blobby canopy line
    const pts = [0,260, 50,238, 100,252, 150,228, 200,246, 250,222,
                 300,250, 350,232, 400,244, 450,220, 500,248, 550,230,
                 600,255, 650,238, 700,250, 750,228, 800,256];
    ctx.moveTo(ox, H);
    for (let i = 0; i < pts.length; i += 2) {
      const nx = pts[i], ny = pts[i + 1];
      if (i === 0) ctx.moveTo(ox + nx, ny);
      else ctx.lineTo(ox + nx, ny);
    }
    ctx.lineTo(ox + W, H); ctx.closePath(); ctx.fill();
  }
}

function drawNearTrees(off) {
  for (let t = 0; t < 2; t++) {
    const ox = -off + t * W;
    const treeCol  = '#143E0A';
    const trunkCol = '#0C2806';

    for (let i = 0; i < TREE_XS.length; i++) {
      const tx = ox + TREE_XS[i];
      if (tx < -60 || tx > W + 60) continue;
      const th = TREE_HS[i];
      const ty = GY - th;

      // Trunk
      ctx.fillStyle = trunkCol;
      ctx.fillRect(tx + 14, ty + th - 28, 10, 28);

      // Three layered canopy blobs
      ctx.fillStyle = treeCol;
      ctx.beginPath(); ctx.arc(tx + 19, ty + th - 40, 28, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(tx + 19, ty + th - 64, 20, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(tx + 19, ty + th - 82, 13, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawGround(off) {
  const dg = ctx.createLinearGradient(0, GY, 0, H);
  dg.addColorStop(0, '#907050'); dg.addColorStop(0.12, '#6B4E28'); dg.addColorStop(1, '#3A2210');
  ctx.fillStyle = dg; ctx.fillRect(0, GY, W, H - GY);
  ctx.fillStyle = '#4AAA28'; ctx.fillRect(0, GY, W, 5);
  ctx.fillStyle = '#3A8A18'; ctx.fillRect(0, GY + 5, W, 3);
  for (let t = 0; t < 2; t++) {
    const ox = -off + t * W;
    for (const dx of [22,95,175,258,340,415,495,575,655,730]) {
      const rx = ox + dx;
      if (rx < -15 || rx > W + 15) continue;
      ctx.fillStyle = '#786040';
      ctx.beginPath(); ctx.ellipse(rx, GY+4, 4, 2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#5ABB30'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      for (let g = 0; g < 3; g++) {
        ctx.beginPath();
        ctx.moveTo(rx+18+g*4, GY+2);
        ctx.lineTo(rx+17+g*4+(g%2?1:-1), GY-6-g);
        ctx.stroke();
      }
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 10. OBSTACLE RENDERER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function drawObstacles() {
  for (const o of active) {
    ctx.save();
    switch (o.key) {
      case 'stump':  _drawStump(o.x, o.y, o.w, o.h); break;
      case 'dstump': _drawDStump(o.x, o.y, o.w, o.h); break;
      case 'rock':   _drawRock(o.x, o.y, o.w, o.h);  break;
      case 'box':    _drawBox(o.x, o.y, o.w, o.h);   break;
      case 'branch': _drawBranch(o.x, o.y, o.w, o.h); break;
      case 'vine':   _drawVine(o.x);                   break;
    }
    ctx.restore();
  }
}

function _drawStump(x, y, w, h) {
  // Trunk gradient
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0, '#7B4E1A'); g.addColorStop(0.55, '#5C3D11'); g.addColorStop(1, '#3A2008');
  ctx.fillStyle = g; ctx.fillRect(x + 4, y + 14, w - 8, h - 14);
  // Bark lines
  ctx.strokeStyle = '#3A2008'; ctx.lineWidth = 1;
  for (let ly = y + 22; ly < y + h - 4; ly += 10) {
    ctx.beginPath(); ctx.moveTo(x + 4, ly); ctx.lineTo(x + w - 4, ly); ctx.stroke();
  }
  // Cross-section top
  ctx.fillStyle = '#C87830';
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + 14, (w - 8) / 2, 9, 0, 0, Math.PI * 2); ctx.fill();
  // Annual rings
  ctx.strokeStyle = '#A06020'; ctx.lineWidth = 1;
  for (let r = 4; r < (w - 8) / 2 - 2; r += 5) {
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + 14, r, r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // Center dot
  ctx.fillStyle = '#804A10';
  ctx.beginPath(); ctx.arc(x + w / 2, y + 14, 3, 0, Math.PI * 2); ctx.fill();
}

function _drawDStump(x, y, w, h) {
  const hw = Math.floor(w / 2) - 3;
  _drawStump(x, y, hw, h);
  _drawStump(x + hw + 6, y + 6, hw, h - 6);
}

// Tall jungle tree: canopy blocks standing player, GAP at bottom lets slider through
function _drawBranch(x, y, w, h) {
  const trunkX  = x + w / 2 - 7;
  const gapTop  = GY - SH - 14;  // gap top: just above slide clearance (≈276)
  const gapBot  = GY;             // gap bottom: ground level

  // ── Trunk (full height, decorative — no hitbox) ──
  const tg = ctx.createLinearGradient(trunkX, y + h, trunkX + 14, y + h);
  tg.addColorStop(0, '#7B4E1A'); tg.addColorStop(1, '#4A2E08');
  ctx.fillStyle = tg;
  ctx.fillRect(trunkX, y + 48, 14, h - 48); // trunk below canopy
  // bark lines
  ctx.strokeStyle = '#3A2008'; ctx.lineWidth = 1;
  for (let ly = y + 55; ly < GY - 2; ly += 10) {
    ctx.beginPath(); ctx.moveTo(trunkX, ly); ctx.lineTo(trunkX + 14, ly); ctx.stroke();
  }

  // ── GAP indicator (bright line so player sees the slide gap) ──
  ctx.strokeStyle = 'rgba(80,220,80,0.35)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x, gapTop); ctx.lineTo(x + w, gapTop); ctx.stroke();

  // ── Canopy (3 layered blobs — THIS is the hitbox zone) ──
  const canopyColors = ['#1A5C08', '#2A7A10', '#1A6008', '#22720E'];
  // Shadow blob
  ctx.fillStyle = '#0E3804';
  ctx.beginPath(); ctx.ellipse(x + w/2 + 3, y + 30, w/2 - 2, 28, 0, 0, Math.PI*2); ctx.fill();
  // Main canopy layers
  ctx.fillStyle = canopyColors[0];
  ctx.beginPath(); ctx.ellipse(x + w/2, y + 24, w/2 + 2, 26, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = canopyColors[1];
  ctx.beginPath(); ctx.ellipse(x + w/2 - 4, y + 16, w/2 - 4, 18, 0, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = canopyColors[2];
  ctx.beginPath(); ctx.ellipse(x + w/2 + 3, y + 8,  w/2 - 6, 12, 0, 0, Math.PI*2); ctx.fill();
  // Highlight
  ctx.fillStyle = '#3AAA18';
  ctx.beginPath(); ctx.ellipse(x + w/2 - 6, y + 12, 10, 7, -0.3, 0, Math.PI*2); ctx.fill();

  // ── "SLIDE" hint arrow at gap ──
  ctx.fillStyle = 'rgba(255,255,100,0.55)';
  ctx.beginPath();
  ctx.moveTo(x + w/2, gapTop + 4);
  ctx.lineTo(x + w/2 - 8, gapTop - 6);
  ctx.lineTo(x + w/2 + 8, gapTop - 6);
  ctx.closePath(); ctx.fill();
}

function _drawRock(x, y, w, h) {
  // Main rock body (irregular polygon)
  ctx.fillStyle = '#888';
  ctx.beginPath();
  ctx.moveTo(x + 7,     y + h);
  ctx.lineTo(x + 2,     y + h * 0.55);
  ctx.lineTo(x + 5,     y + h * 0.18);
  ctx.lineTo(x + w*0.35,y);
  ctx.lineTo(x + w*0.68,y + h * 0.10);
  ctx.lineTo(x + w - 2, y + h * 0.32);
  ctx.lineTo(x + w,     y + h * 0.72);
  ctx.lineTo(x + w - 4, y + h);
  ctx.closePath(); ctx.fill();
  // Highlight
  ctx.fillStyle = '#B4B4B4';
  ctx.beginPath(); ctx.ellipse(x + w * 0.34, y + h * 0.22, 9, 5.5, -0.4, 0, Math.PI * 2); ctx.fill();
  // Shadow crack
  ctx.strokeStyle = '#606060'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + w * 0.58, y + h * 0.25); ctx.lineTo(x + w * 0.7, y + h * 0.65); ctx.stroke();
}

function _drawBox(x, y, w, h) {
  // Outer frame
  ctx.fillStyle = '#9A7018'; ctx.fillRect(x, y, w, h);
  // Inner wood
  ctx.fillStyle = '#C89828'; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  // Plank lines
  ctx.strokeStyle = '#9A7018'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + 3, y + h * 0.35); ctx.lineTo(x + w - 3, y + h * 0.35); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 3, y + h * 0.68); ctx.lineTo(x + w - 3, y + h * 0.68); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w / 2, y + 3); ctx.lineTo(x + w / 2, y + h - 3); ctx.stroke();
  // X brace
  ctx.strokeStyle = '#786008'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + w - 4, y + h - 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w - 4, y + 4); ctx.lineTo(x + 4, y + h - 4); ctx.stroke();
  // Metal corner brackets
  ctx.fillStyle = '#708090';
  [[x, y],[x + w - 7, y],[x, y + h - 7],[x + w - 7, y + h - 7]].forEach(([cx, cy]) => {
    ctx.fillRect(cx, cy, 7, 7);
  });
}

function _drawVine(x) {
  // Branch attachment
  ctx.strokeStyle = '#4A8A1A'; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 22, 52); ctx.lineTo(x + 54, 48); ctx.stroke();

  const bottom = VINE_BOTTOM;
  const cols   = ['#3A6812', '#52A020', '#2C5008', '#62B030', '#468018'];

  // 5 vine strands with leaves
  for (let s = 0; s < 5; s++) {
    const sx   = x + s * 7;
    const wave = Math.sin(gFrame * 0.025 + s * 1.1) * 3.5;

    ctx.strokeStyle = cols[s % cols.length]; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let vy = 52; vy < bottom; vy += 10) {
      const vx = sx + Math.sin(vy * 0.12 + wave) * 4.5;
      vy === 52 ? ctx.moveTo(vx, vy) : ctx.lineTo(vx, vy);
    }
    ctx.lineTo(sx + wave, bottom); ctx.stroke();

    // Leaves every ~35px
    for (let lv = 75; lv < bottom - 15; lv += 35 + (s % 3) * 10) {
      const lx = sx + Math.sin(lv * 0.12 + wave) * 4.5;
      ctx.fillStyle = s % 2 === 0 ? '#3A8820' : '#50A830';
      ctx.save(); ctx.translate(lx, lv); ctx.rotate(s % 2 === 0 ? 0.5 : -0.5);
      ctx.beginPath(); ctx.ellipse(9, 0, 11, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = s % 2 === 0 ? '#4A9830' : '#3A8020';
      ctx.save(); ctx.translate(lx, lv + 12); ctx.rotate(s % 2 === 0 ? -0.6 : 0.6);
      ctx.beginPath(); ctx.ellipse(-9, 0, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 11. CHARACTER RENDERER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
/*
  All character drawing uses foot-center as origin (0, 0).
  Negative Y goes up. Total height: 60px (0 to -60).
  Foot:     y=0
  Hip:      y=-28
  Shoulder: y=-44
  Head:     y=-52
*/

// Draw the active player on the game canvas
function drawPlayer() {
  // Flash on death
  if (P.dead && Math.floor(P.flashT / 5) % 2 === 0) return;
  ctx.save();
  ctx.translate(P.x + PW / 2, P.y + (P.sliding ? SH : PH));
  drawChar(ctx, CHARS[selChar], P.state(), P.af);
  ctx.restore();
}

// Draw character into any given canvas context (used for previews too)
function drawChar(c, cd, state, frame) {
  c.save();
  switch (state) {
    case 'run':   _charRun(c, cd, frame);   break;
    case 'jump':  _charJump(c, cd);         break;
    case 'fall':  _charFall(c, cd);         break;
    case 'slide': _charSlide(c, cd, frame); break;
    case 'swim':
    default:      _charRun(c, cd, 0);       break;
  }
  c.restore();
}

// ── Shared helpers ─────────────────────

// Draw a limb as a thick rounded line between two points
function _limb(c, x1, y1, x2, y2, lw, col) {
  c.strokeStyle = col; c.lineWidth = lw; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
}

// Draw head at (hx, hy) center
function _head(c, cd, hx, hy) {
  // Outline
  c.fillStyle = '#000';
  c.beginPath(); c.arc(hx, hy, 11.5, 0, Math.PI * 2); c.fill();
  // Skin
  c.fillStyle = cd.skin;
  c.beginPath(); c.arc(hx, hy, 10, 0, Math.PI * 2); c.fill();
  // Eyes
  c.fillStyle = '#080300';
  c.beginPath(); c.arc(hx - 3.5, hy - 0.5, 2.2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(hx + 3.5, hy - 0.5, 2.2, 0, Math.PI * 2); c.fill();
  // Eye gleam
  c.fillStyle = 'rgba(255,255,255,0.65)';
  c.beginPath(); c.arc(hx - 2.8, hy - 1, 0.9, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(hx + 4.2, hy - 1, 0.9, 0, Math.PI * 2); c.fill();
}

function _hair(c, cd, hx, hy) {
  c.fillStyle = cd.hair;
  if (cd.name === 'GRONK') {
    // Messy spiked caveman hair
    c.beginPath(); c.ellipse(hx, hy - 4, 11, 7, 0, Math.PI, 0); c.fill();
    c.fillStyle = cd.hair;
    for (let i = -2; i <= 2; i++) {
      c.beginPath();
      c.moveTo(hx + i * 5 - 2, hy - 10);
      c.lineTo(hx + i * 5,     hy - 18);
      c.lineTo(hx + i * 5 + 2, hy - 10);
      c.fill();
    }
  } else if (cd.name === 'ZARA') {
    // Long flowing warrior hair
    c.beginPath(); c.ellipse(hx, hy - 4, 12, 8, 0, Math.PI, 0); c.fill();
    c.strokeStyle = cd.hair; c.lineWidth = 3.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hx - 9, hy + 3); c.quadraticCurveTo(hx - 14, hy + 14, hx - 12, hy + 22); c.stroke();
    c.beginPath(); c.moveTo(hx + 9, hy + 3); c.quadraticCurveTo(hx + 14, hy + 14, hx + 12, hy + 22); c.stroke();
    // Headband
    c.strokeStyle = cd.acc; c.lineWidth = 2.5;
    c.beginPath(); c.arc(hx, hy, 10.5, Math.PI * 0.85, Math.PI * 0.15); c.stroke();
  } else {
    // Miko: wild white shaman hair
    c.fillStyle = '#F2ECC2';
    c.beginPath(); c.ellipse(hx, hy - 5, 12, 8, 0, Math.PI, 0); c.fill();
    c.strokeStyle = '#E8E0AA'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hx - 10, hy - 6); c.quadraticCurveTo(hx - 18, hy - 16, hx - 16, hy - 22); c.stroke();
    c.beginPath(); c.moveTo(hx + 10, hy - 6); c.quadraticCurveTo(hx + 18, hy - 16, hx + 16, hy - 22); c.stroke();
  }
}

function _accent(c, cd, hx, hy) {
  if (cd.name === 'GRONK') {
    // Bone pin through hair
    c.strokeStyle = '#F0D888'; c.lineWidth = 3.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(hx - 9, hy - 12); c.lineTo(hx + 9, hy - 12); c.stroke();
    c.fillStyle = '#F0D888';
    c.beginPath(); c.arc(hx - 9, hy - 12, 3.5, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(hx + 9, hy - 12, 3.5, 0, Math.PI * 2); c.fill();
  } else if (cd.name === 'ZARA') {
    // Tribal face markings
    c.strokeStyle = cd.acc; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(hx - 8, hy + 1); c.lineTo(hx - 4, hy + 4); c.stroke();
    c.beginPath(); c.moveTo(hx + 8, hy + 1); c.lineTo(hx + 4, hy + 4); c.stroke();
    // Earring
    c.fillStyle = cd.acc;
    c.beginPath(); c.arc(hx - 11.5, hy + 1, 2.2, 0, Math.PI * 2); c.fill();
  } else {
    // Miko glowing rune
    c.save();
    c.shadowColor = cd.acc; c.shadowBlur = 12;
    c.fillStyle = cd.acc;
    c.beginPath(); c.arc(hx, hy - 3, 3, 0, Math.PI * 2); c.fill();
    c.shadowBlur = 0; c.restore();
    // Small vertical rune line
    c.strokeStyle = cd.acc; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(hx, hy - 8); c.lineTo(hx, hy + 2); c.stroke();
    c.beginPath(); c.moveTo(hx - 3, hy - 2); c.lineTo(hx + 3, hy - 2); c.stroke();
  }
}

function _weapon(c, cd, wx, wy) {
  if (cd.name === 'GRONK') {
    // Bone club
    c.strokeStyle = '#C89060'; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(wx - 3, wy); c.lineTo(wx + 4, wy - 15); c.stroke();
    c.fillStyle = '#E0A870';
    c.beginPath(); c.ellipse(wx + 7, wy - 20, 7, 5, 0.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#E8B880';
    c.beginPath(); c.ellipse(wx + 5, wy - 18, 3, 2, 0.5, 0, Math.PI * 2); c.fill();
  } else if (cd.name === 'ZARA') {
    // Spear
    c.strokeStyle = '#B87820'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(wx - 3, wy + 4); c.lineTo(wx + 4, wy - 20); c.stroke();
    // Tip
    c.fillStyle = '#909098';
    c.beginPath();
    c.moveTo(wx + 2,  wy - 20);
    c.lineTo(wx + 6,  wy - 30);
    c.lineTo(wx + 9,  wy - 20);
    c.closePath(); c.fill();
    // Binding wrap
    c.strokeStyle = '#D09030'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(wx, wy - 8); c.lineTo(wx + 5, wy - 8); c.stroke();
    c.beginPath(); c.moveTo(wx, wy - 11); c.lineTo(wx + 5, wy - 11); c.stroke();
  } else {
    // Miko glow staff
    c.strokeStyle = '#4A6820'; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(wx - 2, wy + 4); c.lineTo(wx + 2, wy - 22); c.stroke();
    c.save();
    c.shadowColor = cd.acc; c.shadowBlur = 14;
    c.fillStyle = cd.acc;
    c.beginPath();
    c.moveTo(wx + 2,  wy - 30);
    c.lineTo(wx + 7,  wy - 23);
    c.lineTo(wx + 2,  wy - 22);
    c.lineTo(wx - 3,  wy - 23);
    c.closePath(); c.fill();
    c.shadowBlur = 0; c.restore();
  }
}

// ── Per-state pose functions ────────────

function _charRun(c, cd, f) {
  const t    = (f / 6) * Math.PI * 2;
  const ls   = Math.sin(t) * 17;       // leg swing
  const as   = Math.sin(t + Math.PI) * 13; // arm swing (opposite)
  const bob  = Math.abs(Math.sin(t)) * 2.5; // vertical body bob

  const by = -44 + bob; // body top Y (shoulder level)
  const hy = -52 + bob; // head center Y
  const ky = -18;       // knee Y
  const ay = -42 + bob; // arm attachment Y

  // Back leg (opposite phase)
  _limb(c, -4, -28 + bob, -4 - ls * 0.6, ky, 9, cd.skin);
  _limb(c, -4 - ls * 0.6, ky, -4 - ls, 0, 9, cd.skin);

  // Front leg
  _limb(c,  4, -28 + bob,  4 + ls * 0.6, ky, 9, cd.skin);
  _limb(c,  4 + ls * 0.6, ky,  4 + ls, 0, 9, cd.skin);

  // Feet
  c.fillStyle = cd.detail;
  c.beginPath(); c.ellipse(-4 - ls, -2, 7, 3, ls > 0 ? -0.2 : 0.2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse( 4 + ls, -2, 7, 3, ls < 0 ? -0.2 : 0.2, 0, Math.PI * 2); c.fill();

  // Torso
  c.fillStyle = cd.cloth;
  c.beginPath(); c.roundRect(-12, by, 24, 18, 4); c.fill();
  // Belt/stripe detail
  c.fillStyle = cd.detail;
  c.fillRect(-12, by + 12, 24, 3);

  // Back arm (behind torso — drawn before front arm)
  _limb(c, -10, ay + 2, -16 - as, ay + 18, 7, cd.skin);
  // Front arm
  _limb(c,  10, ay + 2,  16 + as, ay + 18, 7, cd.skin);
  _weapon(c, cd, 16 + as, ay + 18);

  _head(c, cd, 0, hy);
  _hair(c, cd, 0, hy);
  _accent(c, cd, 0, hy);
}

function _charJump(c, cd) {
  const hy = -52, by = -44, ay = -42;

  // Legs tucked up and back
  _limb(c, -5, -28, -14, -14, 9, cd.skin);
  _limb(c, -14, -14, -10,  -4, 9, cd.skin);
  _limb(c,  5, -28,  14, -14, 9, cd.skin);
  _limb(c,  14, -14,  10,  -4, 9, cd.skin);

  // Torso
  c.fillStyle = cd.cloth;
  c.beginPath(); c.roundRect(-12, by, 24, 18, 4); c.fill();
  c.fillStyle = cd.detail; c.fillRect(-12, by + 12, 24, 3);

  // Arms raised (jump gesture)
  _limb(c, -10, ay + 2, -22, ay - 10, 7, cd.skin);
  _limb(c,  10, ay + 2,  22, ay - 10, 7, cd.skin);
  _weapon(c, cd, 22, ay - 10);

  _head(c, cd, 0, hy);
  _hair(c, cd, 0, hy);
  _accent(c, cd, 0, hy);
}

function _charFall(c, cd) {
  const hy = -52, by = -44, ay = -42;

  // Legs spread out (falling pose)
  _limb(c, -5, -28, -12, -10, 9, cd.skin);
  _limb(c, -12, -10, -8,   0, 9, cd.skin);
  _limb(c,  5, -28,  12, -10, 9, cd.skin);
  _limb(c,  12, -10,  8,   0, 9, cd.skin);

  c.fillStyle = cd.cloth;
  c.beginPath(); c.roundRect(-12, by, 24, 18, 4); c.fill();
  c.fillStyle = cd.detail; c.fillRect(-12, by + 12, 24, 3);

  // Arms wide (flailing)
  _limb(c, -10, ay + 2, -24, ay + 18, 7, cd.skin);
  _limb(c,  10, ay + 2,  24, ay + 18, 7, cd.skin);
  _weapon(c, cd, 24, ay + 18);

  _head(c, cd, 0, hy);
  _hair(c, cd, 0, hy);
  _accent(c, cd, 0, hy);
}

function _charSlide(c, cd, f) {
  // Slide: translate upward so feet still at y=0 despite shorter height
  c.save();
  c.translate(0, PH - SH);

  const t   = (f / 2) * Math.PI;
  const ls  = Math.sin(t) * 8;
  const hy  = -SH + 8, by = -SH + 14;

  // Legs out to sides (crouching)
  _limb(c,  -4, -12,  -18 + ls,  0, 9, cd.skin);
  _limb(c,   4, -12,   16 - ls,  0, 9, cd.skin);

  // Crouched torso (shorter)
  c.fillStyle = cd.cloth;
  c.beginPath(); c.roundRect(-13, by, 26, 14, 4); c.fill();
  c.fillStyle = cd.detail; c.fillRect(-13, by + 9, 26, 3);

  // Arms (one forward, one back)
  _limb(c, -10, by + 4, -22, by + 10, 7, cd.skin);
  _limb(c,  10, by + 4,  20, by + 4,  7, cd.skin);
  _weapon(c, cd, 20, by + 4);

  // Head forward
  _head(c, cd, 8, hy);
  _hair(c, cd, 8, hy);
  _accent(c, cd, 8, hy);

  c.restore();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 12. COLLISION DETECTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function checkCollisions() {
  if (P.dead) return;
  const pb = P.hbox();

  for (const o of active) {
    let ox, oy, ow, oh;

    if (o.key === 'vine') {
      // Vine: danger zone above sliding clearance only
      const clearance = VINE_BOTTOM - 55;
      ox = o.x + 5; oy = clearance; ow = o.w - 10; oh = VINE_BOTTOM - clearance;
    } else if (o.key === 'branch') {
      // Tall tree: only CANOPY hits (upper 48px). Sliding player (top=GY-SH=290)
      // clears because canopy bottom = GY-80+48 = GY-32 = 286 < 290. Must SLIDE.
      ox = o.x + 4;
      oy = o.y + 2;          // canopy top  ≈ GY-80 = 238
      ow = o.w - 8;
      oh = 48;               // canopy bottom ≈ 238+48 = 286 — below sliding top (290) ✓
    } else {
      // Ground obstacles: tight hitbox around the solid part only
      ox = o.x + 6;
      oy = o.y + 4;
      ow = o.w - 12;
      oh = o.h - 6;
    }

    // AABB intersection test
    if (pb.x < ox + ow &&
        pb.x + pb.w > ox &&
        pb.y < oy + oh &&
        pb.y + pb.h > oy) {
      _killPlayer();
      return;
    }
  }
}

function _killPlayer() {
  P.dead = true;
  P.flashT = 55;
  shakeT = 28; shakeAmp = 8;
  spawnPfx(P.x + PW / 2, P.y + PH / 2, 'hit');

  setTimeout(() => {
    if (score > hiScore) {
      hiScore = Math.floor(score);
      localStorage.setItem('jr_hi', hiScore);
    }
    showScr('over');
  }, 800);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 13. INPUT MANAGER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let touchStartY = 0, touchStartX = 0;

window.addEventListener('keydown', e => {
  if (['Space','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
  if (gState !== 'play') return;
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.key === 'w' || e.key === 'W') P.jump();
  if (e.code === 'ArrowDown' || e.key === 's' || e.key === 'S') P.slide();
});

// Swipe on document so HUD overlay never blocks touch
document.addEventListener('touchstart', e => {
  if (gState !== 'play') return;
  touchStartY = e.touches[0].clientY;
  touchStartX = e.touches[0].clientX;
}, { passive: true });

document.addEventListener('touchend', e => {
  if (gState !== 'play') return;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dy) > Math.abs(dx)) {
    if (dy < -20) P.jump();
    else if (dy > 20) P.slide();
  } else if (Math.abs(dx) < 30) {
    P.jump();
  }
}, { passive: true });

// Mobile buttons
const mbJump  = document.getElementById('mb-jump');
const mbSlide = document.getElementById('mb-slide');
mbJump.addEventListener('touchstart',  e => { e.stopPropagation(); if (gState === 'play') P.jump();  }, { passive: true });
mbSlide.addEventListener('touchstart', e => { e.stopPropagation(); if (gState === 'play') P.slide(); }, { passive: true });
mbJump.addEventListener('mousedown',   () => { if (gState === 'play') P.jump();  });
mbSlide.addEventListener('mousedown',  () => { if (gState === 'play') P.slide(); });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 14. UI / SCREEN MANAGER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function showScr(name) {
  gState = name;
  // Hide all screens
  ['scr-start', 'scr-select', 'scr-over'].forEach(id => {
    document.getElementById(id).classList.remove('active');
  });
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('mob-btns').classList.add('hidden');

  if (name === 'start') {
    document.getElementById('scr-start').classList.add('active');
  } else if (name === 'select') {
    document.getElementById('scr-select').classList.add('active');
    _renderPreviews();
  } else if (name === 'play') {
    document.getElementById('hud').classList.remove('hidden');
    if (_isMobile()) document.getElementById('mob-btns').classList.remove('hidden');
    _startGame();
  } else if (name === 'over') {
    document.getElementById('scr-over').classList.add('active');
    document.getElementById('ov-score').textContent = Math.floor(score);
    document.getElementById('ov-best').textContent  = hiScore;
  }
}

function _isMobile() {
  return /Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent) || ('ontouchstart' in window);
}

function _startGame() {
  // Reset everything
  P.reset();
  active.length = 0;
  pool.length   = 0;
  parts.length  = 0;
  score    = 0;
  gSpeed   = BASE_SPD;
  gFrame   = 0;
  shakeT   = 0;
  spawnT   = 0;
  spawnGap = 90;
  nextWater = 999999;
  bgOff.fill(0);
}

// Update HUD elements
function _updateHUD() {
  document.getElementById('v-score').textContent = Math.floor(score);
  document.getElementById('v-speed').textContent = (gSpeed / BASE_SPD).toFixed(1);
}

// Render character preview canvases on select screen
function _renderPreviews() {
  for (let i = 0; i < 3; i++) {
    const el  = document.getElementById('prev' + i);
    if (!el) continue;
    const pc  = el.getContext('2d');
    const pw  = el.width, ph = el.height;

    pc.clearRect(0, 0, pw, ph);
    // Mini bg
    const g = pc.createLinearGradient(0, 0, 0, ph);
    g.addColorStop(0, '#182A18'); g.addColorStop(1, '#080E08');
    pc.fillStyle = g; pc.fillRect(0, 0, pw, ph);
    // Mini ground
    pc.fillStyle = '#4AAA28'; pc.fillRect(0, ph - 12, pw, 4);
    pc.fillStyle = '#3D2210'; pc.fillRect(0, ph - 8,  pw, 8);

    // Draw character slightly smaller for preview
    pc.save();
    pc.translate(pw / 2, ph - 11);
    pc.scale(0.82, 0.82);
    drawChar(pc, CHARS[i], 'run', 2);
    pc.restore();
  }
}

// Character card selection
document.querySelectorAll('.ccard').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.ccard').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selChar = parseInt(card.dataset.id, 10);
    const btn = document.getElementById('btn-play');
    btn.disabled = false;
    btn.textContent = `▶  PLAY AS ${CHARS[selChar].name}`;
    btn.classList.remove('btn-ghost');
    btn.classList.add('btn-gold');
  });
});

// Button wiring
document.getElementById('btn-start').addEventListener('click', () => showScr('select'));
document.getElementById('btn-back').addEventListener('click',  () => showScr('start'));
document.getElementById('btn-play').addEventListener('click',  () => { if (selChar >= 0) showScr('play'); });
document.getElementById('btn-restart').addEventListener('click', () => showScr('play'));
document.getElementById('btn-menu').addEventListener('click',    () => showScr('start'));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 15. SPEED LINES (visual flair at high speed)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Pre-computed line positions
const SPEED_LINES = Array.from({ length: 20 }, (_, i) => ({
  y: 40 + i * 15, len: 20 + (i % 3) * 15, x: Math.random() * W
}));

function drawSpeedLines() {
  const intensity = Math.min(1, (gSpeed - 7) / 5);
  if (intensity <= 0) return;
  ctx.save();
  ctx.globalAlpha = intensity * 0.18;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1;
  for (const sl of SPEED_LINES) {
    sl.x = (sl.x - gSpeed * 2 + W) % W;
    ctx.beginPath();
    ctx.moveTo(sl.x, sl.y);
    ctx.lineTo(sl.x + sl.len, sl.y);
    ctx.stroke();
  }
  ctx.restore();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 16. MAIN GAME LOOP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function loop() {
  requestAnimationFrame(loop);

  if (gState !== 'play') {
    // On non-play screens, draw a gentle animated background
    _drawIdleBg();
    return;
  }

  gFrame++;
  score += gSpeed * 0.04;

  // Speed ramp
  if (gSpeed < MAX_SPD) gSpeed = Math.min(MAX_SPD, gSpeed + SPD_INC);

  // Update systems
  updateBg();
  P.update();
  updateObstacles();
  updateParts();
  checkCollisions();
  _updateHUD();

  // ── RENDER ──
  // Screen shake
  ctx.save();
  if (shakeT > 0) {
    shakeT--;
    const sx = (Math.random() - 0.5) * shakeAmp;
    const sy = (Math.random() - 0.5) * shakeAmp;
    shakeAmp = Math.max(0, shakeAmp - 0.25);
    ctx.translate(sx, sy);
  }

  ctx.clearRect(-10, -10, W + 20, H + 20);

  drawBg();
  drawSpeedLines();
  drawObstacles();
  drawPlayer();
  drawParts();

  ctx.restore();
}

// Draw a slowly-animated background for menu screens
let idleOff = 0;
function _drawIdleBg() {
  idleOff = (idleOff + 0.8) % W;

  // Temporarily use idle speed for background animation
  const savedSpeed = gSpeed;
  gSpeed = 2.5;
  bgOff[1] = (bgOff[1] + gSpeed * bgSpd[1]) % W;
  bgOff[2] = (bgOff[2] + gSpeed * bgSpd[2]) % W;
  bgOff[3] = (bgOff[3] + gSpeed * bgSpd[3]) % W;
  bgOff[4] = (bgOff[4] + gSpeed * bgSpd[4]) % W;
  gSpeed = savedSpeed;

  ctx.clearRect(0, 0, W, H);
  drawBg();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 17. INIT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Scale canvas to fit window while preserving 2:1 aspect ratio
function resize() {
  const wrap = document.getElementById('wrapper');
  const ww   = window.innerWidth;
  const wh   = window.innerHeight;
  const ar   = 800 / 400;

  let cw = ww;
  let ch = cw / ar;
  if (ch > wh) { ch = wh; cw = ch * ar; }

  canvas.style.width  = cw + 'px';
  canvas.style.height = ch + 'px';
}

window.addEventListener('resize', resize);
resize();

// Show start screen and kick off render loop
showScr('start');
loop();
