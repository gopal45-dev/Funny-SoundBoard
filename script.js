// SOUND FILES
const soundFiles = {
  dog:  "sounds/dog.mp3",
  clap: "sounds/clap.mp3",
  pop:  "sounds/pop.mp3",
  laugh:"sounds/laugh.mp3",
  bell: "sounds/bell.mp3",
  horn: "sounds/horn.mp3"
};

// store original Audio objects for waveform
const originalSounds = {};
for (let k in soundFiles) originalSounds[k] = new Audio(soundFiles[k]);

// DOM
const buttons = document.querySelectorAll(".btn");
const volumeSlider = document.getElementById("volume");
const muteBtn = document.getElementById("muteBtn");
const waveCanvas = document.getElementById("wave");
const ctx = waveCanvas.getContext("2d");
const currentEl = document.getElementById("current");
const durationEl = document.getElementById("duration");
const progressWrap = document.getElementById("progressWrap");
const progressBar = document.getElementById("progress");

let audioCtx = null;
let analyser = null;
let sourceNode = null;
let animationId = null;

let currentAudio = null;
let isMuted = false;

// resize canvas
function resizeCanvas() {
  waveCanvas.width = waveCanvas.clientWidth * devicePixelRatio;
  waveCanvas.height = waveCanvas.clientHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
}
resizeCanvas();
window.addEventListener("resize", () => {
  ctx.setTransform(1,0,0,1,0,0);
  resizeCanvas();
});

// stop visualizer
function cancelVisualizer() {
  if (animationId) cancelAnimationFrame(animationId);
  animationId = null;
  ctx.clearRect(0,0,waveCanvas.clientWidth,waveCanvas.clientHeight);
}

// setup analyser
function setupAnalyser(audioEl) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (sourceNode) sourceNode.disconnect();
  sourceNode = audioCtx.createMediaElementSource(audioEl);
  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  sourceNode.connect(analyser);
  analyser.connect(audioCtx.destination);
}

// draw waveform
function startVisualizer() {
  if (!analyser) return;
  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    animationId = requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);

    const w = waveCanvas.clientWidth;
    const h = waveCanvas.clientHeight;
    ctx.clearRect(0,0,w,h);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#a8e6ff";
    ctx.beginPath();

    const sliceWidth = w / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * h)/2;
      if(i===0) ctx.moveTo(x,y);
      else ctx.lineTo(x,y);
      x += sliceWidth;
    }
    ctx.lineTo(w,h/2);
    ctx.stroke();
  }
  draw();
}

// format time mm:ss
function fmtTime(t){
  if(!isFinite(t)) return "0:00";
  const s = Math.floor(t);
  return Math.floor(s/60) + ":" + (s%60<10?"0":"") + (s%60);
}

// update progress bar
function updateProgress(current,duration){
  currentEl.textContent = fmtTime(current);
  durationEl.textContent = fmtTime(duration);
  const pct = (duration>0)?(current/duration)*100:0;
  progressBar.style.width = pct + "%";
}

// play sound
buttons.forEach(btn => {
  btn.addEventListener("click", async function(){
    const name = btn.getAttribute("data-sound");

    // create a new Audio instance each time
    const audio = new Audio(soundFiles[name]);
    audio.volume = parseFloat(volumeSlider.value);
    audio.muted = isMuted;

    currentAudio = audio;

    if(audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
    setupAnalyser(audio);
    startVisualizer();

    audio.play();

    audio.addEventListener('loadedmetadata', ()=>{
      updateProgress(audio.currentTime, audio.duration);
    });

    audio.ontimeupdate = ()=>{
      updateProgress(audio.currentTime, audio.duration || 0);
    }

    audio.onended = ()=>{
      cancelVisualizer();
      updateProgress(0, audio.duration||0);
      currentAudio = null;
    };
  });
});

// volume
volumeSlider.addEventListener("input", ()=>{
  if(currentAudio) currentAudio.volume = parseFloat(volumeSlider.value);
});

// mute/unmute
muteBtn.addEventListener("click", ()=>{
  isMuted = !isMuted;
  if(currentAudio) currentAudio.muted = isMuted;
  muteBtn.textContent = isMuted ? "🔊" : "🔇";
});

// progress bar click
progressWrap.addEventListener("click", function(ev){
  if(!currentAudio) return;
  const rect = progressWrap.getBoundingClientRect();
  const pct = (ev.clientX - rect.left)/rect.width;
  if(isFinite(currentAudio.duration)) currentAudio.currentTime = currentAudio.duration * pct;
});

// keyboard shortcuts
const keyMap = { 'D':'dog','C':'clap','P':'pop','L':'laugh','B':'bell','H':'horn' };
window.addEventListener("keydown", async (e)=>{
  const k = e.key.toUpperCase();
  if(k===' '){ if(currentAudio){ currentAudio.paused?currentAudio.play():currentAudio.pause(); } e.preventDefault(); return; }
  if(keyMap[k]){
    const btn = document.querySelector(`.btn[data-sound="${keyMap[k]}"]`);
    if(btn) btn.click();
  }
});
