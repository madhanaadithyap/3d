const coinSound = document.getElementById('coin-sound');
const overSound=document.getElementById('over-sound');
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
let mixer;
let stars;

let starSizes = [];
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
let growAmount = 1.0;
let growDirection = 1;
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
  if (e.code === 'ArrowLeft') changeLane(-1);
  if (e.code === 'ArrowRight') changeLane(1);
  if (e.code === 'Space') tryJump();
});
window.onload=tryJump()


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
  scene.fog = new THREE.Fog(0xffffff, 0.05, 2000);
  scene.background = new THREE.Color(0x38b6ff); // sky blue color

  camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 1000);
  camera.position.set(0, 4.2, 8);
  camera.lookAt(0,1,0);

  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
  renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // optional for smoother shadows

  document.body.appendChild(renderer.domElement);

  // Lights
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(5,10,5);
  dir.castShadow = true;

dir.shadow.camera.near = 0;
dir.shadow.camera.far = 10000;   // Increase to cover farther distance

dir.shadow.camera.left = -100;   // widen shadow camera left bound
dir.shadow.camera.right = 100;   // widen right bound
dir.shadow.camera.top = 100;     // widen top bound
dir.shadow.camera.bottom = -100; // widen bott
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
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x948ACC });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.x = LANES[i+1];
    line.position.y = 0;
    line.position.z = -900;
    scene.add(line);
  }
for (let j=-5; j<=5; j++){
    const lineGeo = new THREE.BoxGeometry(0.12, 0.01, 2000);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x948ACC });
    const line2 = new THREE.Mesh(lineGeo, lineMat);
    line2.position.x = [-5.5,0,5.5][j];
    line2.position.y = 10;
    line2.position.z = -900;
    scene.add(line2);
  }

  // star sky
   const starCount = 1000;
  const starsGeometry = new THREE.BufferGeometry();
  const positions = [];
  starSizes = [];

  for (let i = 0; i < starCount; i++) {
    positions.push(
      (Math.random() - 0.5) * 600,
      Math.random() * 50 + 5,
      (Math.random() - 0.5) * 600
    );
    starSizes.push(Math.random() * 1.5 + 0.5); // initial size per star
  }

  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  starsGeometry.setAttribute('size', new THREE.Float32BufferAttribute(starSizes, 1));

  const starMaterial = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0xffffff) },
      time: { value: 0 }
    },
    vertexShader: `
      attribute float size;
      uniform float time;
      varying float vSize;
      void main() {
        // Animate size with a sine wave + random offset (using position.x as phase)
        float animSize = size + 0.5 * sin(time + position.x * 10.0);
        vSize = animSize;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = animSize * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying float vSize;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if(dist > 0.5) discard;
        gl_FragColor = vec4(vec3(1.0), 1.0);
      }
    `,
    transparent: true
  });

  stars = new THREE.Points(starsGeometry, starMaterial);
  scene.add(stars);

  window.addEventListener('resize', ()=> {
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
}

function loadPlayer() {
  // attempt to load Ghost.glb; fallback to simple ship/box
  loaderGLTF.load(
    './runn.glb',
    (gltf) => {
      player = gltf.scene;
      player.scale.set(2,2,2);
      player.castShadow = true;
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
 setTimeout(()=> {
  // if player hasn't loaded, hide loader after a short wait (we have fallback)
  loaderEl.style.height = '0vh';
  loaderEl.style.top='-250%'
}, 1000);

  
  // place a simple camera follow anchor
  camera.position.set(0,4,8);
  camera.lookAt(player.position.x, player.position.y+1, player.position.z-5);
}

/* ========== Game control functions ========== */
function startGame(){
  popup.style.top = '-1000%';
startBtn.style.display='none'

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
  if (overSound) {
      overSound.currentTime = 0; // rewind to start
      overSound.play().catch(() => {/* ignore play errors */});
    }
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
  const laneIndex = Math.floor(Math.random() * LANES.length);
  const x = LANES[laneIndex];
  const z = -220; // far ahead

  // Randomly pick a geometry type
  const geometryTypes = [
    () => new THREE.BoxGeometry(0.5, 0.5, 0.5),
    () => new THREE.SphereGeometry(0.3, 16, 16),
    () => new THREE.ConeGeometry(0.4, 0.8, 8),
    () => new THREE.CylinderGeometry(0.3, 0.3, 0.6, 12),
  ];

  const geometry = geometryTypes[Math.floor(Math.random() * geometryTypes.length)]();

  // Random scale multiplier
  const scale = 0.5 + Math.random() * 1.0;
  geometry.scale(2.5, 2.5, 2.5);

  // Random pastel color
  const colorHue = Math.random();
  const color = new THREE.Color().setHSL(colorHue, 1, 0.5);

  const material = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.6 });

  const obstacle = new THREE.Mesh(geometry, material);
  obstacle.position.set(x, 0.5, z);
  obstacle.userData = { type: 'obstacle', lane: laneIndex };
obstacle.castShadow = true;
obstacle.receiveShadow = true; 
  scene.add(obstacle);
  obstacles.push(obstacle);
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
  coin.castShadow = true;
coin.receiveShadow = true;
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
      if (coinSound) {
      coinSound.currentTime = 0; // rewind to start
      coinSound.play().catch(() => {/* ignore play errors */});
    }
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


  if (stars) {
    stars.material.uniforms.time.value = performance.now() * 0.0002;
    stars.rotation.y += 0.00005;
  }
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
  loaderEl.style.height = '0vh';
}, 4500);
