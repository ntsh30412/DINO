const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const canvasWrap = document.getElementById('canvas-wrap');
const scoreEl = document.getElementById('score');
const highScoreEl = document.getElementById('high-score');
const speedLabel = document.getElementById('speed-label');
const startOverlay = document.getElementById('start-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const finalScoreEl = document.getElementById('final-score');
const startButton = document.getElementById('start-button');
const restartButton = document.getElementById('restart-button');
const attackButton = document.getElementById('attack-button');
const jumpButton = document.getElementById('jump-button');
const leftButton = document.getElementById('left-button');
const rightButton = document.getElementById('right-button');
const runnerSprite = new Image();
runnerSprite.src = 'pikachu-running-sprite.png';

const world = { width: 1200, height: 500, ground: 386 };
let highScore = Number(localStorage.getItem('night-runner-high-score') || 0);
let state = 'ready';
let score = 0;
let distance = 0;
let speed = 6;
let lastTime = 0;
let spawnTimer = 0;
let nextSpawn = 930;
let enemyTimer = 0;
let nextEnemy = 1450;
let attackCooldown = 0;
let animationId;
let obstacles = [];
let enemies = [];
let projectiles = [];
let dust = [];
const keys = { left: false, right: false };

const runner = { x: 145, y: world.ground - 70, width: 96, height: 70, velocityY: 0, grounded: true, jumps: 0, lane: 0, legPhase: 0 };
const runnerAnimation = { frame: 0, startedAt: null, frameDuration: 70, frameCount: 4, frameWidth: 200, frameHeight: 146 };
const camera = { x: 0, y: 0 };
const stars = Array.from({ length: 62 }, (_, index) => ({
  x: (index * 173) % world.width,
  y: 35 + ((index * 83) % 230),
  size: index % 5 === 0 ? 2 : 1,
  alpha: 0.25 + ((index * 7) % 60) / 100
}));

function formatScore(value) { return String(Math.floor(value)).padStart(5, '0'); }
function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  canvas.width = world.width * ratio;
  canvas.height = world.height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}
function resetGame() {
  score = 0; distance = 0; speed = 6; spawnTimer = 0; nextSpawn = 930; enemyTimer = 0; nextEnemy = 1450; attackCooldown = 0;
  obstacles = []; enemies = []; projectiles = []; dust = [];
  runner.y = world.ground - runner.height; runner.velocityY = 0; runner.grounded = true; runner.jumps = 0; runner.lane = 0; camera.x = 0; camera.y = 0;
  runnerAnimation.frame = 0; runnerAnimation.startedAt = null;
  scoreEl.textContent = formatScore(0); speedLabel.textContent = '1.0x';
}
function startGame() {
  resetGame(); state = 'running'; lastTime = performance.now();
  startOverlay.classList.add('hidden'); gameOverOverlay.classList.add('hidden');
  cancelAnimationFrame(animationId); animationId = requestAnimationFrame(loop);
}
function endGame() {
  state = 'over';
  highScore = Math.max(highScore, Math.floor(score));
  localStorage.setItem('night-runner-high-score', highScore);
  highScoreEl.textContent = formatScore(highScore); finalScoreEl.textContent = formatScore(score);
  gameOverOverlay.classList.remove('hidden');
}
function jump() {
  if (state === 'ready' || state === 'over') { startGame(); return; }
  if (runner.jumps < 2) {
    runner.velocityY = -15.8; runner.grounded = false; runner.jumps++;
    for (let i = 0; i < 5; i++) dust.push({ x: runner.x + 6, y: world.ground - 3, vx: -Math.random() * 1.8, vy: -Math.random() * 1.4, life: 1 });
  }
}
function attack() {
  if (state === 'ready' || state === 'over') { startGame(); return; }
  if (attackCooldown <= 0) { projectiles.push({ x: runner.x + runner.width - 2, y: runner.y + 27, width: 22, height: 7, life: 1 }); attackCooldown = 260; }
}
function createObstacle() {
  const tall = Math.random() > .46;
  const width = tall ? 25 + Math.random() * 12 : 38 + Math.random() * 20;
  const height = tall ? 56 + Math.random() * 27 : 27 + Math.random() * 20;
  obstacles.push({ x: world.width + 25, y: world.ground - height, width, height, lane: Math.random() > .5 ? 1 : -1, tall, glow: Math.random() > .4 });
}
function createEnemy() {
  const flying = Math.random() > .42;
  const height = flying ? 92 + Math.random() * 80 : 48;
  enemies.push({ x: world.width + 32, y: flying ? height : world.ground - height, width: flying ? 48 : 42, height, lane: Math.random() > .5 ? 1 : -1, flying, phase: Math.random() * Math.PI * 2 });
}
function update(delta) {
  const frame = delta / 16.667;
  speed = Math.min(13.5, speed + delta * .00018);
  distance += speed * frame * .105; score = distance;
  scoreEl.textContent = formatScore(score); speedLabel.textContent = `${(speed / 6).toFixed(1)}x`;
  runner.velocityY += .76 * frame; runner.y += runner.velocityY * frame;
  if (runner.y >= world.ground - runner.height) { runner.y = world.ground - runner.height; runner.velocityY = 0; runner.grounded = true; runner.jumps = 0; }
  if (keys.left) runner.lane -= .028 * frame;
  if (keys.right) runner.lane += .028 * frame;
  runner.lane = Math.max(-1, Math.min(1, runner.lane));
  const targetCameraX = runner.lane * 115;
  const targetCameraY = Math.max(0, (world.ground - runner.y) * .48);
  camera.x += (targetCameraX - camera.x) * .12 * frame;
  camera.y += (targetCameraY - camera.y) * .12 * frame;
  runner.legPhase += frame * (speed / 2.5);
  spawnTimer += delta;
  if (spawnTimer > nextSpawn) { createObstacle(); spawnTimer = 0; nextSpawn = 650 + Math.random() * 900 - speed * 18; }
  enemyTimer += delta;
  if (enemyTimer > nextEnemy) { createEnemy(); enemyTimer = 0; nextEnemy = 1200 + Math.random() * 1500; }
  obstacles.forEach(obstacle => { obstacle.x -= speed * frame; });
  enemies.forEach(enemy => { enemy.x -= (speed + 1.5) * frame; enemy.phase += .08 * frame; if (enemy.flying) enemy.y += Math.sin(enemy.phase) * .45 * frame; });
  projectiles.forEach(projectile => { projectile.x += 13 * frame; projectile.life -= .018 * frame; });
  obstacles = obstacles.filter(obstacle => obstacle.x + obstacle.width > -30);
  enemies = enemies.filter(enemy => enemy.x + enemy.width > -30 && !enemy.defeated);
  projectiles = projectiles.filter(projectile => projectile.x < world.width + 30 && projectile.life > 0);
  dust.forEach(particle => { particle.x += particle.vx * frame; particle.y += particle.vy * frame; particle.vy += .08 * frame; particle.life -= .035 * frame; });
  dust = dust.filter(particle => particle.life > 0);
  const runnerBox = { x: runner.x + 14, y: runner.y + 8, width: 68, height: 58 };
  if (obstacles.some(obstacle => runnerBox.x < obstacle.x + obstacle.width - 4 && runnerBox.x + runnerBox.width > obstacle.x + 4 && runnerBox.y < obstacle.y + obstacle.height && runnerBox.y + runnerBox.height > obstacle.y + 4)) endGame();
  enemies.forEach(enemy => {
    const enemyBox = { x: enemy.x + 4, y: enemy.y + 4, width: enemy.width - 8, height: enemy.flying ? 34 : enemy.height - 4 };
    projectiles.forEach(projectile => {
      if (projectile.x < enemyBox.x + enemyBox.width && projectile.x + projectile.width > enemyBox.x && projectile.y < enemyBox.y + enemyBox.height && projectile.y + projectile.height > enemyBox.y) { enemy.defeated = true; projectile.life = 0; score += 35; }
    });
    if (!enemy.defeated && runnerBox.x < enemyBox.x + enemyBox.width && runnerBox.x + runnerBox.width > enemyBox.x && runnerBox.y < enemyBox.y + enemyBox.height && runnerBox.y + runnerBox.height > enemyBox.y) endGame();
  });
  attackCooldown = Math.max(0, attackCooldown - delta);
}
function drawBackground() {
  ctx.clearRect(0, 0, world.width, world.height);
  const sky = ctx.createLinearGradient(0, 0, 0, world.height);
  sky.addColorStop(0, '#111e35'); sky.addColorStop(.56, '#111a2d'); sky.addColorStop(1, '#0a1221');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, world.width, world.height);
  ctx.fillStyle = 'rgba(114, 228, 219, .06)'; ctx.beginPath(); ctx.arc(935, 112, 86, 0, Math.PI * 2); ctx.fill();
  stars.forEach(star => { ctx.globalAlpha = star.alpha; ctx.fillStyle = star.size === 2 ? '#72e4db' : '#c3d6e8'; ctx.fillRect(star.x, star.y, star.size, star.size); }); ctx.globalAlpha = 1;
  ctx.fillStyle = '#0d1728';
  for (let x = -40; x < world.width + 80; x += 70) { const height = 36 + ((x * 13) % 76); ctx.fillRect(x, world.ground - height, 52, height); }
  ctx.strokeStyle = 'rgba(114, 228, 219, .09)'; ctx.lineWidth = 1;
  for (let x = -distance * 10 % 90; x < world.width; x += 90) { ctx.beginPath(); ctx.moveTo(x, world.ground); ctx.lineTo(x + 160, world.ground - 90); ctx.stroke(); }
  ctx.fillStyle = '#18273b'; ctx.fillRect(0, world.ground, world.width, world.height - world.ground);
  ctx.strokeStyle = '#72e4db'; ctx.globalAlpha = .72; ctx.beginPath(); ctx.moveTo(0, world.ground); ctx.lineTo(world.width, world.ground); ctx.stroke(); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(164, 185, 204, .16)'; ctx.setLineDash([28, 22]); ctx.lineDashOffset = -distance * 18; ctx.beginPath(); ctx.moveTo(0, world.ground + 28); ctx.lineTo(world.width, world.ground + 28); ctx.stroke(); ctx.setLineDash([]);
}
function drawRunner() {
  const bounce = runner.grounded ? Math.sin(runner.legPhase) * 1.8 : 0;
  const x = runner.x + runner.lane * 65; const y = runner.y + bounce - camera.y * .18;
  ctx.save(); ctx.translate(x, y); ctx.shadowBlur = 16; ctx.shadowColor = '#72e4db';
  if (runnerSprite.complete && runnerSprite.naturalWidth > 0) {
    ctx.drawImage(runnerSprite, runnerAnimation.frame * runnerAnimation.frameWidth, 0, runnerAnimation.frameWidth, runnerAnimation.frameHeight, 0, 0, runner.width, runner.height);
  }
  ctx.restore();
}
function drawEnemies() {
  enemies.forEach(enemy => {
    ctx.save(); ctx.translate(enemy.x + enemy.lane * 65, enemy.y - camera.y * .18); ctx.shadowBlur = 15; ctx.shadowColor = enemy.flying ? '#ffad5c' : '#e679a7'; ctx.fillStyle = enemy.flying ? '#f0a357' : '#bd5b85';
    if (enemy.flying) {
      ctx.beginPath(); ctx.moveTo(0, 20); ctx.lineTo(14, 5); ctx.lineTo(35, 8); ctx.lineTo(48, 22); ctx.lineTo(34, 35); ctx.lineTo(12, 34); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#101d30'; ctx.fillRect(14, 16, 5, 5); ctx.fillRect(29, 16, 5, 5); ctx.strokeStyle = '#ffddb0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(7, 28); ctx.lineTo(-8, 37); ctx.moveTo(40, 28); ctx.lineTo(54, 37); ctx.stroke();
    } else {
      ctx.fillRect(3, 12, 36, 32); ctx.fillRect(0, 4, 12, 13); ctx.fillRect(30, 4, 12, 13); ctx.fillStyle = '#101d30'; ctx.fillRect(10, 20, 6, 6); ctx.fillRect(26, 20, 6, 6); ctx.fillStyle = '#ffb0c9'; ctx.fillRect(17, 32, 8, 3);
    }
    ctx.restore();
  });
}
function drawProjectiles() {
  projectiles.forEach(projectile => { ctx.save(); ctx.shadowBlur = 18; ctx.shadowColor = '#72e4db'; ctx.fillStyle = '#b9fff5'; ctx.fillRect(projectile.x + runner.lane * 65, projectile.y - camera.y * .18, projectile.width, projectile.height); ctx.restore(); });
}
function drawObstacles() {
  obstacles.forEach(obstacle => {
    ctx.save(); ctx.translate(obstacle.lane * 65, -camera.y * .18); ctx.shadowBlur = obstacle.glow ? 14 : 0; ctx.shadowColor = '#e679a7'; ctx.fillStyle = obstacle.tall ? '#d86c9c' : '#c95782';
    if (obstacle.tall) { ctx.fillRect(obstacle.x + 7, obstacle.y, obstacle.width - 7, obstacle.height); ctx.fillRect(obstacle.x, obstacle.y + 14, obstacle.width, 8); ctx.fillRect(obstacle.x + 5, obstacle.y + 29, obstacle.width - 5, 6); }
    else { ctx.fillRect(obstacle.x, obstacle.y + 8, obstacle.width, obstacle.height - 8); ctx.fillRect(obstacle.x + 8, obstacle.y, obstacle.width - 16, 12); }
    ctx.fillStyle = '#ffb0c9'; ctx.globalAlpha = .8; ctx.fillRect(obstacle.x + 4, obstacle.y + 5, 3, 3); ctx.restore();
  });
}
function drawDust() { dust.forEach(particle => { ctx.globalAlpha = particle.life; ctx.fillStyle = '#72e4db'; ctx.fillRect(particle.x, particle.y, 3, 3); }); ctx.globalAlpha = 1; }
function render() { drawBackground(); drawDust(); drawObstacles(); drawEnemies(); drawProjectiles(); drawRunner(); }
function updateRunnerAnimation(timestamp) {
  if (runnerAnimation.startedAt === null) runnerAnimation.startedAt = timestamp;
  const elapsed = timestamp - runnerAnimation.startedAt;
  runnerAnimation.frame = Math.floor(elapsed / runnerAnimation.frameDuration) % runnerAnimation.frameCount;
}
function loop(timestamp) {
  const delta = Math.min(32, timestamp - lastTime); lastTime = timestamp;
  updateRunnerAnimation(timestamp);
  if (state !== 'running') { render(); animationId = requestAnimationFrame(loop); return; }
  update(delta); render(); animationId = requestAnimationFrame(loop);
}
function handleInput(event) {
  if (event.type !== 'keydown') return;
  if (event.code === 'Space' || event.code === 'ArrowUp') { event.preventDefault(); jump(); }
  if (event.code === 'KeyX' || event.code === 'KeyZ') { event.preventDefault(); attack(); }
}
function handleKeyState(event, pressed) { if (event.code === 'ArrowLeft') keys.left = pressed; if (event.code === 'ArrowRight') keys.right = pressed; }
function bindMoveButton(button, key) { button.addEventListener('pointerdown', event => { event.preventDefault(); keys[key] = true; }); button.addEventListener('pointerup', () => { keys[key] = false; }); button.addEventListener('pointerleave', () => { keys[key] = false; }); }
startButton.addEventListener('click', jump); restartButton.addEventListener('click', jump); attackButton.addEventListener('click', attack); jumpButton.addEventListener('click', jump); bindMoveButton(leftButton, 'left'); bindMoveButton(rightButton, 'right'); canvasWrap.addEventListener('pointerdown', event => { if (event.target.tagName !== 'BUTTON') jump(); }); window.addEventListener('keydown', handleInput); window.addEventListener('keydown', event => handleKeyState(event, true)); window.addEventListener('keyup', event => handleKeyState(event, false)); window.addEventListener('blur', () => { Object.keys(keys).forEach(key => { keys[key] = false; }); }); window.addEventListener('resize', resizeCanvas);
highScoreEl.textContent = formatScore(highScore); resizeCanvas(); render(); animationId = requestAnimationFrame(loop);
