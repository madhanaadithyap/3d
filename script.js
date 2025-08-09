    document.addEventListener('DOMContentLoaded', function() {
        const elementToHide = document.getElementById('inst');

        setTimeout(function() {
            if (elementToHide) { // Check if the element exists
                elementToHide.style.display = 'none';
            }
        }, 8000); // 15000 milliseconds = 15 seconds
    });
/* ========== Game parameters ========== */
const LANES = [-2.2, 0, 2.2]; // x positions
let currentLane = 1; // index into LANES (start center)
let targetLane = currentLane;
let animating;
let laneTweenSpeed = 0.25;
let jumpVelocity = 0;
let isJumping = false;
const gravity = -0.02;
let gameRunning = false;
let mixer
let score = 0;
let lastColorChangeScore = 0;
let speed = 0.6; // obstacle forward speed
let spawnTimer = 0;
let spawnInterval = 100; // frames
let obstacles = [];
let coins = [];
let wave = 1;
let enemiesPerWave = 10;

/* ========== Three.js scene setup ========== */
let scene, camera, renderer;
let player; // will be GLTF or fallback mesh
let loaderGLTF = new THREE.GLTFLoader();
let clock = new THREE.Clock();

initScene();
loadPlayer();
animate();

/* ========== UI elements ========== */
const loaderEl = document.getElementById('loader');
const popup = document.getElementById('popup');
const startBtn = document.getElementById('start-btn');
const scoreEl = document.getElementById('score');
const overEl = document.getElementById('over');
const finalScoreEl = document.getElementById('final-score');
const restartLink = document.getElementById('restart');
const waveEl = document.getElementById('wave');
const bgMusic = document.getElementById('bg-music');
const musicToggle = document.getElementById('music-toggle');
let musicOn = true;


/* ========== Input handlers ========== */
window.addEventListener('keydown', (e) => {
  if (!gameRunning && e.code==='Space') startGame();
  if (!gameRunning) return;
  if (e.code === 'ArrowLeft') changeLane(-1);
  if (e.code === 'ArrowRight') changeLane(1);
  if (e.code === 'Space') tryJump();
});

let touchStartX = 0, touchStartY = 0;
window.addEventListener('touchstart', e => {
  if (e.touches && e.touches[0]) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }
});
window.addEventListener('touchend', e => {
  if (!gameRunning) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 30) changeLane(1);
    else if (dx < -30) changeLane(-1);
  } else {
    if (dy < -30) tryJump();
  }
});

/* ========== Start / Restart buttons ========== */
startBtn.addEventListener('click', () => startGame());
restartLink.addEventListener('click', (e) => {
  e.preventDefault();
  location.reload();
});



/* Music toggle */
musicToggle.addEventListener('click', () => {
  musicOn = !musicOn;
  if (musicOn) {
    bgMusic.play().catch(()=>{/* autoplay blocked */});
    musicToggle.innerText = '🔊 Music: ON';
  } else {
    bgMusic.pause();
    musicToggle.innerText = '🔇 Music: OFF';
  }
});

/* ========== Scene & helpers ========== */
function initScene(){
  animating=true;
  scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000005, 20, 200);
  camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 1000);
  camera.position.set(0, 4.2, 8);
  camera.lookAt(0,1,0);

  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
  document.body.appendChild(renderer.domElement);

  // Lights
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(5,10,5);
  scene.add(dir);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));

  // Ground plane strip for visual movement
  const groundGeo = new THREE.PlaneGeometry(10, 2000, 1, 1);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x111111, });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // Decorative lanes lines
  for (let i=-1; i<=1; i++){
    const lineGeo = new THREE.BoxGeometry(0.12, 0.01, 2000);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x2222ff });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.x = LANES[i+1];
    line.position.y = 0.01;
    line.position.z = -900;
    scene.add(line);
  }

  // star sky
  const stars = new THREE.BufferGeometry();
  const pts = [];
  for (let i=0;i<1000;i++){
    pts.push((Math.random()-0.5)*600, Math.random()*50+5, (Math.random()-0.5)*600);
  }
  stars.setAttribute('position', new THREE.Float32BufferAttribute(pts,3));
  const starMat = new THREE.PointsMaterial({ size:1.2 });
  scene.add(new THREE.Points(stars, starMat));

  window.addEventListener('resize', ()=> {
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

function loadPlayer() {
  // attempt to load Ghost.glb; fallback to simple ship/box
  loaderGLTF.load(
    './man_running.glb',
    (gltf) => {
      player = gltf.scene;
      player.scale.set(0.5,0.5,0.5);
      player.rotation.y=Math.PI;
      player.position.set(LANES[currentLane], 0, 0);
      scene.add(player);
       mixer = new THREE.AnimationMixer( player );
       gltf.animations.forEach( ( clip ) => {
            const action = mixer.clipAction( clip );
            action.loop = THREE.LoopRepeat; // Or THREE.LoopOnce, THREE.LoopPingPong
            action.play();
        });
      afterLoad();
    },
    undefined,
    (err) => {
      console.warn('GLTF load failed, using fallback mesh', err);
      const geom = new THREE.ConeGeometry(0.7,1.8,8);
      const mat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive:0x003333, metalness:0.3, roughness:0.2 });
      player = new THREE.Mesh(geom, mat);
      player.rotation.x = Math.PI;
      player.position.set(LANES[currentLane], 1, 0);
      scene.add(player);
      afterLoad();
    }
  );
}

function afterLoad(){
  loaderEl.style.display = 'none';
  popup.style.display = 'flex';
  // place a simple camera follow anchor
  camera.position.set(0,4.2,8);
  camera.lookAt(player.position.x, player.position.y+1, player.position.z-5);
}

/* ========== Game control functions ========== */
function startGame(){
  popup.style.display = 'none';
  gameRunning = true;
  score = 0;
  speed = 0.6;
  spawnInterval = 30;
  wave = 1;
  obstacles.length = 0;
  coins.length = 0;
  if (musicOn) bgMusic.play().catch(()=>{});
  // start the render loop if not already
  if (!animating) { animating = true; animate(); }
}

function endGame(){
  gameRunning = false;
  overEl.style.height = '100vh';
   overEl.style.opacity = '1';
  finalScoreEl.innerText = `Final Score: ${Math.round(score)}`;
  bgMusic.pause();
}

/* Change lane: dir = -1 left, +1 right */
function changeLane(dir){
  targetLane = Math.max(0, Math.min(LANES.length-1, targetLane + dir));
}

/* Jump */
function tryJump(){
  if (!isJumping){
    isJumping = true;
    jumpVelocity = 0.45;
  }
}

/* ========== Spawning obstacles & coins ========== */
function spawnObstacle() {
  const laneIndex = Math.floor(Math.random()*LANES.length);
  const x = LANES[laneIndex];
  const z = -220; // far ahead
  const size = Math.random()*0.8 + 0.6;
  const g = new THREE.SphereGeometry(size/4, 64, 64).toNonIndexed().applyMatrix4(new THREE.Matrix4().makeScale(1,1,1)); g.attributes.position.array.forEach((v,i,a)=>a[i]+= (a[i]/Math.abs(a[i]) || 1)* (0.2 + Math.random()*0.4)); g.computeVertexNormals();

  const m = new THREE.MeshStandardMaterial({ color: 0xffccff });
  const obs = new THREE.Mesh(g, m);
  obs.position.set(x, size/2, z);
  obs.userData = { type:'obstacle', lane:laneIndex };
  scene.add(obs);
  obstacles.push(obs);
}

function spawnCoin() {
  const laneIndex = Math.floor(Math.random()*LANES.length);
  const x = LANES[laneIndex];
  const z = -200 - Math.random()*60;
  const g = new THREE.TorusGeometry(0.25, 0.08, 8, 12);
  const m = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive:0x222200 });
  const coin = new THREE.Mesh(g,m);
  coin.rotation.x = Math.PI;
  coin.position.set(x, 1.1, z);
  coin.userData = { type:'coin' };
  scene.add(coin);
  coins.push(coin);
}

/* ========== Collision helpers ========== */
function checkCollisions(){
  // simple distance checks
  const px = player.position.x;
  const py = player.position.y;
  const pz = player.position.z;
  // obstacles
  for (let i=obstacles.length-1;i>=0;i--){
    const o = obstacles[i];
    const dx = Math.abs(o.position.x - px);
    const dz = Math.abs(o.position.z - pz);
    const dy = Math.abs((o.position.y||0) - py);
    if (dz < 1.2 && dx < 0.9 && py < (o.position.y + 0.9)) {
      // hit
      // small flash
      endGame();
      return;
    }
  }
  // coins
  for (let i=coins.length-1;i>=0;i--){
    const c = coins[i];
    if (c.position.distanceTo(player.position) < 1.0) {
      // collect
      scene.remove(c);
      coins.splice(i,1);
      score += 50;
      updateScore();
      // small boost when collecting
      speed += 0.01;
    }
  }
}

/* ========== Score update ========== */
function updateScore(){
  scoreEl.innerText = `Score: ${Math.floor(score)}`;
}

/* ========== Animation loop ========== */

function animate() {
  if (!animating) return;
  requestAnimationFrame(animate);

  // delta / per-frame logic
  const delta = clock.getDelta();

  // Player lateral smoothing (lerp to target lane)
  if (player) {
    const desiredX = LANES[targetLane];
    player.position.x += (desiredX - player.position.x) * laneTweenSpeed;
    // Jump physics
    if (isJumping) {
      player.position.y += jumpVelocity;
      jumpVelocity += gravity;
      if (player.position.y <= 1) {
        player.position.y = 1;
        isJumping = false;
        jumpVelocity = 0;
      }
    }
    // subtle bobbing when running
    player.rotation.z = Math.sin(performance.now()/400) * 0.02;
  }

  // spawn logic only if running
  if (gameRunning) {
    spawnTimer++;
    if (spawnTimer % Math.max(10, Math.floor(spawnInterval / (speed+0.2))) === 0) {
      // spawn some obstacles and coins
      if (Math.random() < 0.7) spawnObstacle();
      if (Math.random() < 0.4) spawnCoin();
    }

    // Move obstacles/coins towards player (increase z)
    for (let i=obstacles.length-1;i>=0;i--){
      const o = obstacles[i];
      o.position.z += speed * 2 * delta * 50; // normalized
      // remove if passed
      if (o.position.z > 10) {
        scene.remove(o);
        obstacles.splice(i,1);
        // small score for dodging
        score += 2;
        updateScore();
      }
    }
    for (let i=coins.length-1;i>=0;i--){
      const c = coins[i];
      c.position.z += speed * 2 * delta * 50;
      c.rotation.z += 0.12;
      if (c.position.z > 10) {
        scene.remove(c);
        coins.splice(i,1);
      }
    }

    // incremental score over time (distance)
    score += 0.02 * (speed); // per frame small increment
    updateScore();

    // Check collisions
    checkCollisions();

    // Wave progression: every X score bump speed + increase wave
    if (score > wave * (500 + wave*50)) {
      wave++;
      enemiesPerWave += 5;
      speed += 0.08;
      spawnInterval = Math.max(30, spawnInterval - 6);
      waveEl.innerText = `Wave ${wave}`;
    }
  }

  // camera follow smoothing
  if (player) {
    const camTarget = new THREE.Vector3(player.position.x, player.position.y+2.5, player.position.z + 8);
    camera.position.lerp(camTarget, 0.08);
    camera.lookAt(player.position.x, player.position.y+1, player.position.z - 4);
  }
if ( mixer ) {
            mixer.update( delta );
        }
  renderer.render(scene, camera);
}

/* ========== Utility: show loader hide after assets attempt ========== */
setTimeout(()=> {
  // if player hasn't loaded, hide loader after a short wait (we have fallback)
  loaderEl.style.display = 'none';
}, 2500);
