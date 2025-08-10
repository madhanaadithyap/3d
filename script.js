const coinSound = document.getElementById('coin-sound');
const overSound=document.getElementById('over-sound');

const LANES = [-2.2, 0, 2.2]; 
let currentLane = 1; 
let targetLane = currentLane;
let animating;
let laneTweenSpeed = 0.25;
let jumpVelocity = 0;
let isJumping = false;
const gravity = -0.04;
let gameRunning = false;
let mixer;
let stars;
let camTransition = 0; 
let camTransSpeed = 0.5; 
let camSwitching = true; 
let camGameOver = false;
let starSizes = [];
let score = 0;
let lastColorChangeScore = 0;
let speed = 0.6; 
let spawnTimer = 0;
let spawnInterval = 100;
let obstacles = [];
let coins = [];

let scene, camera, renderer;
let player;
let loaderGLTF = new THREE.GLTFLoader();
let clock = new THREE.Clock();
let isPaused = false;

document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') {
    isPaused = !isPaused;
    if (mixer) mixer.timeScale = isPaused ? 0 : 1; 
  }
});

initScene();


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
  scene.background = new THREE.Color(0x38b6ff); 

  camera = new THREE.PerspectiveCamera(60, innerWidth/innerHeight, 0.1, 1000);
  camera.position.set(0, 4.2, 8);
  camera.lookAt(0,1,0);

  renderer = new THREE.WebGLRenderer({ antialias:true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
  renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 

  document.body.appendChild(renderer.domElement);

  
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(5,10,5);
  dir.castShadow = true;

dir.shadow.camera.near = 0;
dir.shadow.camera.far = 10000;   

dir.shadow.camera.left = -100;   
dir.shadow.camera.right = 100;   
dir.shadow.camera.top = 100;     
dir.shadow.camera.bottom = -100; 
  scene.add(dir);
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));

  
  const groundGeo = new THREE.PlaneGeometry(10, 2000, 1, 1);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x111111, });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.position.y = 1;
  ground.receiveShadow = true;
  scene.add(ground);

  
  for (let i=-1; i<=1; i++){
    const lineGeo = new THREE.BoxGeometry(0.12, 0.01, 2000);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x948ACC });
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.position.x = LANES[i+1];
    line.position.y = 1;
    line.position.z = -900;
    scene.add(line);
  }
for (let j=-5; j<=5; j++){
    const lineGeo = new THREE.BoxGeometry(0.12, 0.01, 2000);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xFF8138 });
    const line2 = new THREE.Mesh(lineGeo, lineMat);
    line2.position.x = [-5.5,0,5.5][j];
    line2.position.y = 10;
    line2.position.z = -900;
    scene.add(line2);
  }

  
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
    starSizes.push(Math.random() * 1.5 + 0.5); 
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
let selectedCharacter = './naruto.glb'; // default character

// Get character select dropdown
const characterSelect = document.getElementById('character-select');
characterSelect.addEventListener('change', (e) => {
  selectedCharacter = e.target.value;
});

// Modify loadPlayer to use selectedCharacter
function loadPlayer() {
  loaderGLTF.load(
    selectedCharacter,
    (gltf) => {
      player = gltf.scene;
      if( selectedCharacter ==="./runn.glb"){
player.scale.set(2.25, 2.25, 2.25);
      }
      if( selectedCharacter ==="./naruto.glb"){
player.scale.set(0.75, 0.75, 0.75);
      }
      if( selectedCharacter ==="./Tom.glb"){
player.scale.set(0.75, 0.75, 0.75);
      }
      
      player.castShadow = true;
      player.rotation.y = Math.PI;
      player.position.set(LANES[currentLane], -100, 0);
      scene.add(player);
      mixer = new THREE.AnimationMixer(player);
      gltf.animations.forEach((clip) => {
        const action = mixer.clipAction(clip);
        action.loop = THREE.LoopRepeat;
        action.play();
      });
      afterLoad();
    },
    undefined,
    (err) => {
      console.warn('GLTF load failed, using fallback mesh', err);
      const geom = new THREE.ConeGeometry(0.7, 1.8, 8);
      const mat = new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x003333, metalness: 0.3, roughness: 0.2 });
      player = new THREE.Mesh(geom, mat);
      player.rotation.x = Math.PI;
      player.position.set(LANES[currentLane], 1, 0);
      scene.add(player);
      afterLoad();
    }
  );
}function transitionPlayerColorToRed(duration = 1000) {
  if (!player) return;

  const startColor = new THREE.Color();
  const endColor = new THREE.Color(0xff0000);

  
  player.traverse((child) => {
    if (child.isMesh && child.material) {
      startColor.copy(child.material.color);
    }
  });

  const startTime = performance.now();

  function animateColor() {
    const elapsed = performance.now() - startTime;
    const t = Math.min(elapsed / duration, 1); 

    player.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.color.copy(startColor).lerp(endColor, t);
      }
    });

    if (t < 1) requestAnimationFrame(animateColor);
  }

  animateColor();
}

function afterLoad(){
 setTimeout(()=> {
  
  loaderEl.style.height = '0vh';
  loaderEl.style.top='-300%'
}, 1000);


  
  
  camera.position.set(0,4,8);
  camera.lookAt(player.position.x, player.position.y+1, player.position.z-5);
}
function startGame() {
  popup.style.top = '-1000%';
  startBtn.style.display = 'none';
  camTransition = 0;
  camSwitching = true;
  gameRunning = true;
  score = 0;
  speed = 0.6;
  spawnInterval = 30;
  wave = 1;
  obstacles.length = 0;
  coins.length = 0;
  if (musicOn) bgMusic.play().catch(() => {});
  
  loadPlayer(); // load chosen character

  if (!animating) { animating = true; animate(); }
}
function endGame(){
  setTimeout(() => {
    transitionPlayerColorToRed(1000); 
  }, 500); 
camGameOver = true; 
  gameRunning = false;
   setTimeout(() => {
  overEl.style.height = '100vh';
   overEl.style.opacity = '1';
  finalScoreEl.innerText = `Final Score: ${Math.round(score)}`;},2500);
  bgMusic.pause();
  if (overSound) {
      overSound.currentTime = 0; 
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
  const z = -220; 

  
  const geometryTypes = [
    () => new THREE.BoxGeometry(0.5, 0.5, 0.5),
    () => new THREE.SphereGeometry(0.3, 16, 16),
    () => new THREE.ConeGeometry(0.4, 0.8, 8),
    () => new THREE.CylinderGeometry(0.3, 0.3, 0.6, 12),
  ];

  const geometry = geometryTypes[Math.floor(Math.random() * geometryTypes.length)]();

  
  const scale = 0.5 + Math.random() * 1.0;
  geometry.scale(2.5, 2.5, 2.5);

  
  const colorHue = Math.random();
  const color = new THREE.Color().setHSL(colorHue, 1, 0.5);

  const material = new THREE.MeshStandardMaterial({ color, metalness: 0.4, roughness: 0.6 });

  const obstacle = new THREE.Mesh(geometry, material);
  obstacle.position.set(x, 1.5, z);
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
  coin.position.set(x, 1.5, z);
  coin.userData = { type:'coin' };
  coin.castShadow = true;
coin.receiveShadow = true;
  scene.add(coin);
  coins.push(coin);
}

/* ========== Collision helpers ========== */
function checkCollisions(){
  
  const px = player.position.x;
  const py = player.position.y;
  const pz = player.position.z;
  
  for (let i=obstacles.length-1;i>=0;i--){
    const o = obstacles[i];
    const dx = Math.abs(o.position.x - px);
    const dz = Math.abs(o.position.z - pz);
    const dy = Math.abs((o.position.y||0) - py);
    if (dz < 1.2 && dx < 0.9 && py < (o.position.y + 0.9)) {
      
      
      endGame();
      return;
    }
  }
  
  for (let i=coins.length-1;i>=0;i--){
    const c = coins[i];
    if (c.position.distanceTo(player.position) < 1.0) {
      
      scene.remove(c);
      coins.splice(i,1);

      score += 50;
      updateScore();
      
      speed += 0.01;
      if (coinSound) {
      coinSound.currentTime = 0; 
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

  
  const delta = clock.getDelta();


  if (stars) {
    stars.material.uniforms.time.value = performance.now() * 0.0002;
    stars.rotation.y += 0.00005;
  }
  
  if (player) {
    const desiredX = LANES[targetLane];
    player.position.x += (desiredX - player.position.x) * laneTweenSpeed;
    
    if (isJumping) {
      player.position.y += jumpVelocity;
      jumpVelocity += gravity;
      if (player.position.y <= 1) {
        player.position.y = 1;
        isJumping = false;
        jumpVelocity = 0;
      }
    }
    
    player.rotation.z = Math.sin(performance.now()/400) * 0.02;
  }
  
  if (gameRunning) {
    spawnTimer++;
    if (spawnTimer % Math.max(10, Math.floor(spawnInterval / (speed+0.2))) === 0) {
      
      if (Math.random() < 0.7) spawnObstacle();
      if (Math.random() < 0.4) spawnCoin();
    }

    
    for (let i=obstacles.length-1;i>=0;i--){
      const o = obstacles[i];
      o.position.z += speed * 2 * delta * 50; 
      
      if (o.position.z > 10) {
        scene.remove(o);
        obstacles.splice(i,1);
        
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

    
    score += 0.02 * (speed); 
    updateScore();

    
    checkCollisions();

    
    if (score > wave * (500 + wave*50)) {
      wave++;
      enemiesPerWave += 5;
      speed += 0.08;
      spawnInterval = Math.max(30, spawnInterval - 6);
      waveEl.innerText = `Wave ${wave}`;
    }
  }

  
  if (player) {
  if (camGameOver) {
    
    const closeOffset = new THREE.Vector3(5, 0, -5); 
    const desiredPos = player.position.clone().add(closeOffset);
    camera.position.lerp(desiredPos, 0.005);
    camera.lookAt(player.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
  } else {
    
    if (camSwitching) {
      camTransition += camTransSpeed * delta;
      if (camTransition >= 1) {
        camTransition = 1;
        camSwitching = false;
      }
    }
    const frontOffset = new THREE.Vector3(5, 3, -8);
    const thirdOffset = new THREE.Vector3(0, 3, 8);
    const offset = new THREE.Vector3().lerpVectors(frontOffset, thirdOffset, camTransition);
    const desiredPos = player.position.clone().add(offset);
    camera.position.lerp(desiredPos, 0.1);
    camera.lookAt(player.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
  }
}

if ( mixer &&gameRunning ) {
            mixer.update( delta );
        }
  renderer.render(scene, camera);
}

/* ========== Utility: show loader hide after assets attempt ========== */
setTimeout(()=> {
  
  loaderEl.style.height = '0vh';
  loaderEl.style.top="-300%"
}, 2000);
