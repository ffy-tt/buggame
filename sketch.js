const video = document.getElementById('video');
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const winModal = document.getElementById('winModal');
const loseModal = document.getElementById('loseModal');
const loseReasonEl = document.getElementById('loseReason');

const CANVAS_W = 800;
const CANVAS_H = 550;
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;

let score = 0;
const targetScore = 30;
let gameRunning = true;
let fingerX = CANVAS_W / 2;
let fingerY = CANVAS_H / 2;

const totalTime = 300;
let remainTime = totalTime;
let timerInterval = null;

// 帧锁：防止sendFrame堆积
let isFrameSending = false;
let gameLoopId = null;

class Bug {
  constructor() {
    this.reset();
  }
  reset() {
    this.isPest = Math.random() > 0.4;
    this.x = Math.random() * (CANVAS_W - 60) + 30;
    this.y = Math.random() * (CANVAS_H - 120) + 60;
    this.size = 36;
    this.speedX = (Math.random() * 1.8 + 0.6) * (Math.random()>0.5 ? 1 : -1);
    this.speedY = (Math.random() - 0.5)*0.6;
    this.alive = true;
  }
  update() {
    if (!this.alive) return;
    this.x += this.speedX;
    this.y += this.speedY;
    if(this.x < 0 || this.x > CANVAS_W - this.size){
      this.speedX *= -1;
    }
    if(this.y < 40 || this.y > CANVAS_H - this.size){
      this.speedY *= -1;
    }
  }
  draw() {
    if (!this.alive) return;
    ctx.save();
    if(this.isPest){
      ctx.fillStyle="#ff4444";
    }else{
      ctx.fillStyle="#44ddaa";
    }
    ctx.beginPath();
    ctx.ellipse(this.x+this.size/2, this.y+this.size/2, this.size/2, this.size/3, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle="#222";
    ctx.fillRect(this.x+6, this.y+8, 6,6);
    ctx.fillRect(this.x+this.size-12, this.y+8,6,6);
    ctx.fillRect(this.x+2, this.y+this.size/2, 4,10);
    ctx.fillRect(this.x+this.size-6, this.y+this.size/2,4,10);
    ctx.fillRect(this.x+8, this.y+this.size/2,4,10);
    ctx.fillRect(this.x+this.size-12, this.y+this.size/2,4,10);
    ctx.restore();
  }
  checkHit(px, py){
    if(!this.alive) return false;
    const dx = px - (this.x + this.size/2);
    const dy = py - (this.y + this.size/2);
    const dist = Math.sqrt(dx*dx + dy*dy);
    if(dist < this.size/2){
      this.alive = false;
      return true;
    }
    return false;
  }
}

let bugs = [];
function initBugs(){
  bugs = [];
  for(let i=0;i<10;i++){
    bugs.push(new Bug());
  }
}

const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});
hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.6,
  minTrackingConfidence: 0.6
});
hands.onResults(onHandResult);

async function startCamera(){
  try{
    const stream = await navigator.mediaDevices.getUserMedia({
      video:{width:CANVAS_W, height:CANVAS_H, facingMode:"user"}
    });
    video.srcObject = stream;
    video.onloadedmetadata = async ()=>{
      await video.play();
      startFrameLoop();
      startTimer();
      initBugs();
      runGameLoop();
    }
  }catch(err){
    alert("摄像头打开失败！\n确认：\n1.点Go Live打开网页\n2.浏览器允许摄像头权限\n"+err.message);
    console.error(err);
  }
}

// 只启动一次手势帧循环，加锁防堆积
async function startFrameLoop(){
  if(isFrameSending) return;
  isFrameSending = true;
  async function sendFrame(){
    await hands.send({image: video});
    requestAnimationFrame(sendFrame);
  }
  sendFrame();
}

function onHandResult(results){
  if(!gameRunning) return;
  if(results.multiHandLandmarks.length > 0){
    const hand = results.multiHandLandmarks[0];
    const indexTip = hand[8];
    fingerX = (1 - indexTip.x) * CANVAS_W;
    fingerY = indexTip.y * CANVAS_H;
  }
}

function startTimer(){
  clearInterval(timerInterval);
  timerInterval = setInterval(()=>{
    if(!gameRunning) return;
    remainTime -= 1;
    timerEl.innerText = remainTime;
    if(remainTime <= 60){
      timerEl.classList.add("time-warning");
    }else{
      timerEl.classList.remove("time-warning");
    }
    if(remainTime <= 0){
      gameRunning = false;
      clearInterval(timerInterval);
      loseReasonEl.innerText = "时间到！没能在5分钟内完成目标";
      loseModal.style.display="flex";
    }
  },1000);
}

function runGameLoop(){
  if(gameLoopId) cancelAnimationFrame(gameLoopId);
  function loop(){
    if(!gameRunning) return;
    ctx.clearRect(0,0,CANVAS_W,CANVAS_H);

    for(let b of bugs){
      b.update();
      b.draw();
      if(b.checkHit(fingerX, fingerY)){
        if(b.isPest){
          score += 1;
        }else{
          score -= 1;
        }
        scoreEl.innerText = score;
        bugs.push(new Bug());

        if(score >= targetScore){
          gameRunning = false;
          clearInterval(timerInterval);
          winModal.style.display="flex";
          return;
        }else if(score < 0){
          gameRunning = false;
          clearInterval(timerInterval);
          loseReasonEl.innerText = "分数低于0，游戏结束！";
          loseModal.style.display="flex";
          return;
        }
      }
    }

    ctx.save();
    ctx.strokeStyle="#fff";
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(fingerX, fingerY, 12, 0, Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fingerX-18, fingerY);
    ctx.lineTo(fingerX+18, fingerY);
    ctx.moveTo(fingerX, fingerY-18);
    ctx.lineTo(fingerX, fingerY+18);
    ctx.stroke();
    ctx.restore();

    gameLoopId = requestAnimationFrame(loop);
  }
  loop();
}

window.restartGame = function(){
  score = 0;
  scoreEl.innerText = score;
  remainTime = totalTime;
  timerEl.innerText = remainTime;
  timerEl.classList.remove("time-warning");
  gameRunning = true;
  initBugs();
  winModal.style.display="none";
  loseModal.style.display="none";
  startTimer();
  runGameLoop();
}

window.closeGame = function(){
  gameRunning = false;
  clearInterval(timerInterval);
  if(gameLoopId) cancelAnimationFrame(gameLoopId);
  winModal.style.display="none";
  loseModal.style.display="none";
}

startCamera();
