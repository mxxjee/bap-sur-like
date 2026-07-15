"use strict";

/** 게임 상태를 명시적으로 분리해 LEVEL_UP과 PAUSED가 서로 섞이지 않게 한다. */
const GAME_STATE = Object.freeze({
  MENU: "menu",
  PLAYING: "playing",
  LEVEL_UP: "level_up",
  PAUSED: "paused",
  VICTORY: "victory",
  GAME_OVER: "game_over"
});

const GAME_VERSION = "1.0.0";
const WORLD = Object.freeze({ width: 225, height: 400, duration: 180, maxEnemies: 100, maxFoods: 200, maxParticles: 360 });
const TAU = Math.PI * 2;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const formatTime = (seconds) => {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

/** 사용자 입력 뒤에만 Web Audio를 깨우고 짧은 8비트풍 효과음을 합성한다. */
class AudioManager {
  constructor() { this.context = null; this.enabled = false; }
  setEnabled(enabled) {
    this.enabled = enabled;
    if (enabled && !this.context) this.context = new (window.AudioContext || window.webkitAudioContext)();
    if (enabled) this.context?.resume();
  }
  tone(frequency, duration = 0.05, type = "square", volume = 0.025, slide = 0) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.linearRampToValueAtTime(Math.max(40, frequency + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now); oscillator.stop(now + duration);
  }
  play(name) {
    const sounds = {
      button: [420, .035, "square", .02, 40], shoot: [320, .025, "square", .012, -80], hit: [120, .03, "square", .012, -20],
      kill: [180, .07, "square", .018, 180], eat: [620, .04, "square", .018, 110], grow: [230, .16, "triangle", .025, 220],
      level: [440, .3, "square", .025, 440], upgrade: [660, .15, "triangle", .025, 220], digest: [520, .2, "sine", .03, -180],
      hurt: [90, .12, "sawtooth", .035, -30], victory: [520, .55, "square", .03, 520], defeat: [180, .5, "sawtooth", .03, -100], submit: [700, .22, "triangle", .025, 180]
    };
    if (sounds[name]) this.tone(...sounds[name]);
  }
}

/** 사각 픽셀만 사용해 플레이어·몬스터·투사체를 직접 그리는 스프라이트 렌더러. */
class SpriteRenderer {
  static rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  static player(ctx, x, y, scale, frame, hurt) {
    ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(scale, scale);
    const bob = frame ? -1 : 0;
    this.rect(ctx, -7, 7, 5, 2, "#0b0711aa"); this.rect(ctx, 2, 7, 5, 2, "#0b0711aa");
    this.rect(ctx, -5, 5 + (frame ? 1 : 0), 3, 3, "#51334c"); this.rect(ctx, 2, 5 + (frame ? 0 : 1), 3, 3, "#51334c");
    const skin = hurt ? "#ff6158" : "#f2bd83";
    this.rect(ctx, -6, -5 + bob, 12, 11, "#713d52"); this.rect(ctx, -5, -7 + bob, 10, 11, skin);
    this.rect(ctx, -4, -8 + bob, 8, 2, "#3b2337"); this.rect(ctx, -6, -6 + bob, 2, 5, "#3b2337");
    this.rect(ctx, -3, -3 + bob, 2, 2, "#2c1b31"); this.rect(ctx, 2, -3 + bob, 2, 2, "#2c1b31");
    this.rect(ctx, -2, 1 + bob, 4, 1, "#a75556"); this.rect(ctx, -7, 0 + bob, 2, 4, skin); this.rect(ctx, 5, 0 + bob, 2, 4, skin);
    ctx.restore();
  }

  static enemy(ctx, enemy, frame, flash) {
    ctx.save(); ctx.translate(Math.round(enemy.x), Math.round(enemy.y));
    if (flash) ctx.globalAlpha = .45;
    const b = frame ? -1 : 0, p = (x,y,w,h,c) => this.rect(ctx,x,y+b,w,h,flash ? "#fff4d6" : c);
    this.rect(ctx, -enemy.radius, enemy.radius - 1, enemy.radius * 2, 2, "#09060dcc");
    if (enemy.kind === "fries") {
      p(-6,-8,2,8,"#f2c84b"); p(-3,-10,2,10,"#ffda58"); p(0,-9,2,9,"#e9b83d"); p(3,-11,2,11,"#ffdc61");
      p(-7,-3,14,10,"#d94742"); p(-5,-1,10,2,"#f0644f"); p(-3,1,2,2,"#241728"); p(2,1,2,2,"#241728");
      p(-5,7,3,2,"#7a3439"); p(frame ? 3 : 2,7,3,2,"#7a3439");
    } else if (enemy.kind === "burger") {
      p(-8,-6,16,4,"#d9964a"); p(-6,-8,12,2,"#efb961"); p(-7,-2,14,2,"#63a34d"); p(-8,0,16,3,"#733d37");
      p(-7,3,14,2,"#f0c44f"); p(-7,5,14,3,"#c77a3c"); p(-4,-5,1,1,"#fff0b2"); p(3,-5,1,1,"#fff0b2");
      p(-4,0,2,2,"#211527"); p(3,0,2,2,"#211527"); p(-6,8+(frame?1:0),3,2,"#6d3437"); p(3,8+(frame?0:1),3,2,"#6d3437");
    } else if (enemy.kind === "donut") {
      p(-6,-7,12,2,"#d88950"); p(-8,-5,16,10,"#c87643"); p(-6,5,12,2,"#a85a3d"); p(-7,-5,14,4,"#ef729b");
      p(-2,-2,4,5,"#21152b"); p(-5,-3,2,2,"#241628"); p(4,-3,2,2,"#241628"); p(-7,7+(frame?1:0),3,2,"#773441"); p(4,7+(frame?0:1),3,2,"#773441");
      p(-4,-6,2,1,"#ffe06f"); p(2,-4,2,1,"#67d7c1"); p(4,-1,2,1,"#fff0a1");
    } else if (enemy.kind === "pizza") {
      p(-9,-8,18,3,"#b66c38"); p(-7,-5,14,3,"#f2c34f"); p(-6,-2,12,3,"#f6d05b"); p(-4,1,8,4,"#efbd47"); p(-2,5,4,3,"#d18a37");
      p(-4,-3,3,3,"#c94b43"); p(3,-1,3,3,"#c94b43"); p(-3,0,1,1,"#26172a"); p(2,0,1,1,"#26172a");
      p(-5,6+(frame?1:0),3,2,"#7b3f38"); p(3,6+(frame?0:1),3,2,"#7b3f38");
    } else {
      p(-8,-5,16,12,"#e9b0a0"); p(-8,-5,16,3,"#fff0d4"); p(-7,-8,14,3,"#e7738a"); p(-6,-10,12,2,"#fff0d4");
      p(-1,-14,2,4,"#f4d14f"); p(0,-16,1,2,frame?"#ff764f":"#ffd85c"); p(-4,-2,2,2,"#29182b"); p(3,-2,2,2,"#29182b");
      p(-6,7+(frame?1:0),3,2,"#77384a"); p(3,7+(frame?0:1),3,2,"#77384a");
    }
    ctx.restore();
  }

  static fork(ctx, projectile) {
    ctx.save(); ctx.translate(Math.round(projectile.x), Math.round(projectile.y)); ctx.rotate(projectile.angle);
    ctx.scale(projectile.scale, projectile.scale); this.rect(ctx,-4,-1,8,2,"#dae2e5"); this.rect(ctx,3,-3,1,2,"#f5ffff");
    this.rect(ctx,5,-3,1,3,"#d9e5e7"); this.rect(ctx,3,1,1,2,"#f5ffff"); this.rect(ctx,5,0,1,3,"#d9e5e7"); this.rect(ctx,-5,-1,2,2,"#8b5652"); ctx.restore();
  }
}

/** 수명이 짧은 도트 부스러기와 텍스트 이펙트. */
class Particle {
  constructor(x, y, color, options = {}) {
    this.x = x; this.y = y; this.color = color; this.vx = options.vx ?? (Math.random() - .5) * 55;
    this.vy = options.vy ?? (Math.random() - .5) * 55; this.life = options.life ?? .45; this.maxLife = this.life;
    this.size = options.size ?? (Math.random() < .6 ? 1 : 2); this.text = options.text || "";
  }
  update(dt) { this.x += this.vx * dt; this.y += this.vy * dt; this.vx *= .94; this.vy *= .94; this.life -= dt; }
  draw(ctx) {
    ctx.globalAlpha = clamp(this.life / this.maxLife, 0, 1); ctx.fillStyle = this.color;
    if (this.text) { ctx.font = "bold 6px monospace"; ctx.textAlign = "center"; ctx.fillText(this.text, Math.round(this.x), Math.round(this.y)); }
    else ctx.fillRect(Math.round(this.x), Math.round(this.y), this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

/** 포크 한 발의 이동, 수명, 충돌 여부를 담당한다. */
class Projectile {
  constructor(x, y, angle, player) {
    this.x = x; this.y = y; this.angle = angle; this.speed = player.projectileSpeed; this.damage = player.damage;
    this.scale = player.projectileScale; this.radius = 3 * this.scale; this.life = player.projectileLife; this.dead = false;
  }
  update(dt) { this.x += Math.cos(this.angle) * this.speed * dt; this.y += Math.sin(this.angle) * this.speed * dt; this.life -= dt; if (this.life <= 0 || this.x < -10 || this.x > WORLD.width + 10 || this.y < -10 || this.y > WORLD.height + 10) this.dead = true; }
  draw(ctx) { SpriteRenderer.fork(ctx, this); }
}

/** 처치 위치에 남아 플레이어가 가까이 왔을 때만 빨려 들어가는 경험치 음식 조각. */
class ExperienceFood {
  constructor(x, y, value = 1, style = Math.floor(Math.random() * 4)) { this.x=x; this.y=y; this.value=value; this.style=style; this.phase=Math.random()*TAU; this.dead=false; }
  update(dt, player) {
    this.phase += dt * 5; const d = distance(this, player);
    if (d <= player.magnetRange) { const pull = 65 + (player.magnetRange - d) * 4; this.x += (player.x-this.x)/(d||1)*pull*dt; this.y += (player.y-this.y)/(d||1)*pull*dt; }
    if (d < player.collisionRadius + 3) this.dead = true;
  }
  draw(ctx) {
    const colors = ["#f0c267","#d45d4f","#f5d75e","#df70a0"], y = Math.round(this.y + Math.sin(this.phase));
    ctx.fillStyle = "#fff1bb33"; ctx.fillRect(Math.round(this.x)-3,y-3,7,7); ctx.fillStyle=colors[this.style]; ctx.fillRect(Math.round(this.x)-2,y-2,4,4);
    ctx.fillStyle="#fff3bc"; ctx.fillRect(Math.round(this.x)-1,y-2,2,1);
  }
}

const ENEMY_DATA = Object.freeze({
  fries: { hp:15, speed:42, damage:5, drops:1, radius:7 },
  burger: { hp:35, speed:27, damage:10, drops:2, radius:9 },
  donut: { hp:25, speed:50, damage:8, drops:2, radius:8 },
  pizza: { hp:60, speed:21, damage:15, drops:4, radius:10 },
  cake: { hp:100, speed:15, damage:20, drops:6, radius:11 }
});

/** 시간대별 능력치를 받아 생성되고 플레이어를 추적하는 음식 몬스터. */
class Enemy {
  constructor(kind, x, y, difficulty) {
    const data=ENEMY_DATA[kind]; this.kind=kind; this.x=x; this.y=y; this.radius=data.radius; this.maxHp=Math.round(data.hp*difficulty.hp);
    this.hp=this.maxHp; this.speed=data.speed*difficulty.speed; this.damage=data.damage; this.drops=data.drops; this.dead=false; this.flash=0; this.age=Math.random()*2;
  }
  update(dt, player) {
    this.age += dt; this.flash=Math.max(0,this.flash-dt); let angle=Math.atan2(player.y-this.y,player.x-this.x);
    if(this.kind==="donut") angle += Math.sin(this.age*7)*.18;
    this.x += Math.cos(angle)*this.speed*dt; this.y += Math.sin(angle)*this.speed*dt;
  }
  draw(ctx, gameTime) { SpriteRenderer.enemy(ctx,this,Math.floor((gameTime+this.age)*5)%2,this.flash>0); }
}

const BODY_STAGES = Object.freeze([
  { name:"가벼움", min:0, scale:1, speed:1, message:"" },
  { name:"배부름", min:.25, scale:1.15, speed:.9, message:"배가 차오르기 시작합니다." },
  { name:"과식", min:.5, scale:1.35, speed:.78, message:"몸이 무거워집니다!" },
  { name:"초거대", min:.75, scale:1.6, speed:.65, message:"레벨업이 얼마 남지 않았습니다!" }
]);

/** 영구 능력치와 현재 레벨의 임시 몸집/속도 배율을 분리해 관리한다. */
class Player {
  constructor() { this.reset(); }
  reset() {
    this.x=WORLD.width/2; this.y=WORLD.height/2; this.maxHp=100; this.hp=100; this.baseSpeed=180; this.damage=10;
    this.attackInterval=.8; this.projectileCount=1; this.projectileSpeed=350; this.projectileScale=1; this.projectileLife=1.2;
    this.magnetRange=50; this.baseRadius=6; this.currentScale=1; this.targetScale=1; this.bodySpeedMultiplier=1; this.bodyStage=0; this.maxBodyStage=0;
    this.level=1; this.xp=0; this.bodyProgress=0; this.attackTimer=.35; this.invincible=0; this.walkTime=0; this.lastMoving=false; this.eatPulse=0;
    this.upgradeLevels={}; this.pendingLevels=0;
  }
  get requiredXp() { return Math.round(10*Math.pow(1.25,this.level-1)); }
  get collisionRadius() { return this.baseRadius*this.currentScale; }
  get moveSpeed() { return this.baseSpeed*this.bodySpeedMultiplier; }
  update(dt,input) {
    this.invincible=Math.max(0,this.invincible-dt); this.eatPulse=Math.max(0,this.eatPulse-dt*4);
    const length=Math.hypot(input.x,input.y); this.lastMoving=length>.05;
    if(this.lastMoving){const x=input.x/(length||1),y=input.y/(length||1);this.x+=x*this.moveSpeed*dt;this.y+=y*this.moveSpeed*dt;this.walkTime+=dt*(7/this.targetScale);}
    this.currentScale += (this.targetScale + this.eatPulse - this.currentScale)*Math.min(1,dt*9);
    const r=this.collisionRadius; this.x=clamp(this.x,r,WORLD.width-r); this.y=clamp(this.y,37+r,WORLD.height-12-r);
  }
  updateBodyStage(game) {
    const progress=clamp(this.bodyProgress/this.requiredXp,0,.999); let next=0;
    for(let i=BODY_STAGES.length-1;i>=0;i--) if(progress>=BODY_STAGES[i].min){next=i;break;}
    if(next!==this.bodyStage){this.bodyStage=next;this.maxBodyStage=Math.max(this.maxBodyStage,next);game.onBodyStageChanged(BODY_STAGES[next]);}
    const stage=BODY_STAGES[this.bodyStage]; this.targetScale=stage.scale; this.bodySpeedMultiplier=stage.speed;
  }
  digest() { this.bodyProgress=0; this.bodyStage=0; this.currentScale=1; this.targetScale=1; this.bodySpeedMultiplier=1; this.eatPulse=0; }
  draw(ctx) { const frame=this.lastMoving?Math.floor(this.walkTime)%2:0; const hurt=this.invincible>0&&Math.floor(this.invincible*18)%2===0; SpriteRenderer.player(ctx,this.x,this.y,this.currentScale,frame,hurt); }
}

const UPGRADES = Object.freeze([
  { id:"damage", name:"날카로운 포크", description:"공격력이 25% 증가합니다.", max:8, colors:["#dce8e8","#f5fafa"], apply:p=>p.damage*=1.25 },
  { id:"haste", name:"빠른 식사", description:"공격 간격이 15% 감소합니다.", max:8, colors:["#f0714f","#ffd05e"], apply:p=>p.attackInterval=Math.max(.2,p.attackInterval*.85) },
  { id:"count", name:"포크 한 개 더", description:"한 번에 발사하는 포크가 1개 늘어납니다.", max:4, colors:["#dce8e8","#9cc8d6"], apply:p=>p.projectileCount=Math.min(5,p.projectileCount+1) },
  { id:"size", name:"커다란 포크", description:"투사체 크기가 20% 증가합니다.", max:6, colors:["#e9ecdf","#b0a7dc"], apply:p=>p.projectileScale*=1.2 },
  { id:"stomach", name:"튼튼한 위장", description:"최대 체력과 현재 체력이 15 증가합니다.", max:8, colors:["#e96a70","#ffd45e"], apply:p=>{p.maxHp+=15;p.hp+=15;} },
  { id:"speed", name:"가벼운 발걸음", description:"기본 이동 속도가 8% 증가합니다.", max:8, colors:["#65d58b","#e8e0ae"], apply:p=>p.baseSpeed*=1.08 },
  { id:"heal", name:"급속 소화", description:"현재 체력을 30 회복합니다.", max:99, colors:["#73d69a","#fff1c7"], apply:p=>p.hp=Math.min(p.maxHp,p.hp+30) },
  { id:"magnet", name:"자석 식사", description:"음식 조각 흡수 범위가 25% 증가합니다.", max:6, colors:["#9a72db","#ef77a8"], apply:p=>p.magnetRange*=1.25 }
]);

/** 중복 없는 강화 후보와 최대 단계 예외 처리를 담당한다. */
class UpgradeManager {
  choices(player) {
    const available=UPGRADES.filter(item=>(player.upgradeLevels[item.id]||0)<item.max);
    for(let i=available.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[available[i],available[j]]=[available[j],available[i]];}
    return available.slice(0,Math.min(3,available.length));
  }
  apply(player,upgrade){upgrade.apply(player);player.upgradeLevels[upgrade.id]=(player.upgradeLevels[upgrade.id]||0)+1;}
}

/** Pointer ID 하나만 소유해 멀티터치가 이동 벡터를 덮어쓰지 않게 하는 가상 조이스틱. */
class VirtualJoystick {
  constructor(element,knob){this.element=element;this.knob=knob;this.pointerId=null;this.vector={x:0,y:0};this.bind();}
  bind(){
    this.element.addEventListener("pointerdown",e=>{if(this.pointerId!==null)return;this.pointerId=e.pointerId;this.element.setPointerCapture(e.pointerId);this.move(e);e.preventDefault();});
    this.element.addEventListener("pointermove",e=>{if(e.pointerId!==this.pointerId)return;this.move(e);e.preventDefault();});
    ["pointerup","pointercancel","lostpointercapture"].forEach(type=>this.element.addEventListener(type,e=>{if(e.pointerId===this.pointerId)this.reset();}));
  }
  move(e){const rect=this.element.getBoundingClientRect(),x=e.clientX-(rect.left+rect.width/2),y=e.clientY-(rect.top+rect.height/2),length=Math.hypot(x,y)||1,max=17,amount=Math.min(max,length);this.vector={x:x/length,y:y/length};this.knob.style.transform=`translate(${x/length*amount}px,${y/length*amount}px)`;}
  reset(){this.pointerId=null;this.vector={x:0,y:0};this.knob.style.transform="translate(0,0)";}
}

/** 게임 월드, 상태 전환, 충돌, UI를 한 requestAnimationFrame 루프에서 조율한다. */
class Game {
  constructor() {
    this.canvas=document.querySelector("#gameCanvas"); this.ctx=this.canvas.getContext("2d"); this.ctx.imageSmoothingEnabled=false;
    this.audio=new AudioManager(); this.upgrades=new UpgradeManager(); this.keys=new Set(); this.state=GAME_STATE.MENU; this.previousPlayableState=null;
    this.joystick=new VirtualJoystick(document.querySelector("#joystick"),document.querySelector("#joystickKnob")); this.cacheUI(); this.bindEvents(); this.resetWorld();
    this.feedback=new window.FeedbackManager({version:GAME_VERSION,getGameStats:()=>this.getFeedbackStats(),onOpen:()=>this.pauseForModal(),onClose:()=>this.resumeFromModal(),onSound:name=>this.audio.play(name)});
    this.lastTime=performance.now(); this.loop=this.loop.bind(this); requestAnimationFrame(this.loop); window.bapGame=this;
  }
  cacheUI(){
    const ids=["hud","menuScreen","controlsScreen","levelUpScreen","pauseScreen","resultScreen","upgradeCards","hpFill","hpText","levelText","timeText","killText","bodyStageText","xpFill","xpText","toast","joystick","soundToggle","pauseToggle"];
    this.ui={};ids.forEach(id=>this.ui[id]=document.getElementById(id));
  }
  bindEvents(){
    document.getElementById("startButton").addEventListener("click",()=>this.start());
    document.getElementById("controlsButton").addEventListener("click",()=>{this.audio.play("button");this.ui.controlsScreen.classList.remove("hidden");});
    document.querySelectorAll(".back-menu").forEach(button=>button.addEventListener("click",()=>this.toMenu()));
    document.getElementById("resumeButton").addEventListener("click",()=>this.resume());
    document.getElementById("restartPauseButton").addEventListener("click",()=>this.start());
    document.getElementById("restartResultButton").addEventListener("click",()=>this.start());
    this.ui.pauseToggle.addEventListener("click",()=>this.togglePause());
    this.ui.soundToggle.addEventListener("click",()=>{const enabled=this.ui.soundToggle.getAttribute("aria-pressed")!=="true";this.audio.setEnabled(enabled);this.ui.soundToggle.setAttribute("aria-pressed",String(enabled));this.ui.soundToggle.setAttribute("aria-label",enabled?"사운드 끄기":"사운드 켜기");this.audio.play("button");});
    window.addEventListener("keydown",e=>this.onKeyDown(e)); window.addEventListener("keyup",e=>this.keys.delete(e.key.toLowerCase()));
    document.addEventListener("contextmenu",e=>e.preventDefault());
  }
  onKeyDown(event){
    const key=event.key.toLowerCase(); if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(key))event.preventDefault(); this.keys.add(key);
    if((key==="escape"||key==="p")&&(this.state===GAME_STATE.PLAYING||this.state===GAME_STATE.PAUSED)){event.preventDefault();this.togglePause();}
    if(this.state===GAME_STATE.LEVEL_UP&&["1","2","3"].includes(key)){const card=this.ui.upgradeCards.children[Number(key)-1];card?.click();}
    if(key==="enter"&&this.state===GAME_STATE.MENU)this.start();
  }
  resetWorld(){
    this.player=new Player();this.enemies=[];this.projectiles=[];this.foods=[];this.particles=[];this.elapsed=0;this.kills=0;this.spawnTimer=.4;this.shake=0;this.toastTimer=0;this.levelChoiceLocked=false;this.lastResult="none";
  }
  start(){
    this.audio.play("button");this.resetWorld();this.state=GAME_STATE.PLAYING;this.hideScreens();this.ui.hud.classList.remove("hidden");this.ui.joystick.classList.remove("hidden");this.lastTime=performance.now();this.updateHUD();
  }
  toMenu(){
    this.audio.play("button");this.state=GAME_STATE.MENU;this.resetWorld();this.hideScreens();this.ui.menuScreen.classList.remove("hidden");this.ui.hud.classList.add("hidden");this.ui.joystick.classList.add("hidden");this.joystick.reset();this.feedback.refreshSummary();
  }
  hideScreens(){[this.ui.menuScreen,this.ui.controlsScreen,this.ui.levelUpScreen,this.ui.pauseScreen,this.ui.resultScreen].forEach(screen=>screen.classList.add("hidden"));}
  pause(){if(this.state!==GAME_STATE.PLAYING)return;this.state=GAME_STATE.PAUSED;this.ui.pauseScreen.classList.remove("hidden");this.joystick.reset();}
  resume(){if(this.state!==GAME_STATE.PAUSED)return;this.audio.play("button");this.state=GAME_STATE.PLAYING;this.ui.pauseScreen.classList.add("hidden");this.lastTime=performance.now();}
  togglePause(){if(this.state===GAME_STATE.PLAYING)this.pause();else if(this.state===GAME_STATE.PAUSED)this.resume();}
  pauseForModal(){if(this.state===GAME_STATE.PLAYING){this.previousPlayableState=GAME_STATE.PLAYING;this.state=GAME_STATE.PAUSED;}else this.previousPlayableState=null;}
  resumeFromModal(){if(this.previousPlayableState===GAME_STATE.PLAYING&&this.state===GAME_STATE.PAUSED){this.state=GAME_STATE.PLAYING;this.lastTime=performance.now();}this.previousPlayableState=null;}
  loop(now){const dt=Math.min(.033,Math.max(0,(now-this.lastTime)/1000));this.lastTime=now;if(this.state===GAME_STATE.PLAYING)this.update(dt);this.draw();requestAnimationFrame(this.loop);}
  inputVector(){return {x:(this.keys.has("d")||this.keys.has("arrowright")?1:0)-(this.keys.has("a")||this.keys.has("arrowleft")?1:0)+this.joystick.vector.x,y:(this.keys.has("s")||this.keys.has("arrowdown")?1:0)-(this.keys.has("w")||this.keys.has("arrowup")?1:0)+this.joystick.vector.y};}
  update(dt){
    this.elapsed+=dt;if(this.elapsed>=WORLD.duration){this.finish(true);return;}this.shake*=.86;if(this.toastTimer>0){this.toastTimer-=dt;if(this.toastTimer<=0)this.ui.toast.classList.add("hidden");}
    this.player.update(dt,this.inputVector());this.player.attackTimer-=dt;this.updateSpawning(dt);
    for(const enemy of this.enemies)enemy.update(dt,this.player);
    if(this.player.attackTimer<=0&&this.enemies.length){this.fireAtNearest();this.player.attackTimer=this.player.attackInterval;}
    for(const projectile of this.projectiles)projectile.update(dt);
    this.resolveProjectileHits();this.resolvePlayerHits();
    for(const food of this.foods){food.update(dt,this.player);if(food.dead){this.collectFood(food);if(this.state!==GAME_STATE.PLAYING)break;}}
    if(this.state!==GAME_STATE.PLAYING){this.foods=this.foods.filter(item=>!item.dead);this.updateHUD();return;}
    this.updateParticles(dt);this.enemies=this.enemies.filter(item=>!item.dead);this.projectiles=this.projectiles.filter(item=>!item.dead);this.foods=this.foods.filter(item=>!item.dead);this.updateHUD();
  }
  difficulty(){if(this.elapsed<60)return{hp:1,speed:1};if(this.elapsed<120)return{hp:1.1,speed:1};return{hp:1.22,speed:1.08};}
  availableEnemyKinds(){if(this.elapsed<30)return["fries","burger"];if(this.elapsed<60)return["fries","burger","donut"];if(this.elapsed<120)return["fries","burger","donut","pizza"];return["fries","burger","donut","pizza","cake"];}
  updateSpawning(dt){
    this.spawnTimer-=dt;if(this.spawnTimer>0||this.enemies.length>=WORLD.maxEnemies)return;
    const interval=this.elapsed<30?1.25:this.elapsed<60?.9:this.elapsed<120?.56:.34;const pack=this.elapsed<60?1:this.elapsed<120?(Math.random()<.25?2:1):(Math.random()<.55?2:1);
    for(let i=0;i<pack&&this.enemies.length<WORLD.maxEnemies;i++)this.spawnEnemy();this.spawnTimer=interval;
  }
  spawnEnemy(){
    const kinds=this.availableEnemyKinds(),kind=kinds[Math.floor(Math.random()*kinds.length)],edge=Math.floor(Math.random()*4),pad=14;let x,y;
    if(edge===0){x=Math.random()*WORLD.width;y=-pad;}else if(edge===1){x=WORLD.width+pad;y=35+Math.random()*(WORLD.height-35);}else if(edge===2){x=Math.random()*WORLD.width;y=WORLD.height+pad;}else{x=-pad;y=35+Math.random()*(WORLD.height-35);}
    this.enemies.push(new Enemy(kind,x,y,this.difficulty()));
  }
  fireAtNearest(){
    let nearest=null,best=Infinity;for(const enemy of this.enemies){const d=distance(this.player,enemy);if(d<best){best=d;nearest=enemy;}}
    if(!nearest)return;const base=Math.atan2(nearest.y-this.player.y,nearest.x-this.player.x),count=this.player.projectileCount;
    for(let i=0;i<count;i++){const angle=base+(i-(count-1)/2)*.11;this.projectiles.push(new Projectile(this.player.x,this.player.y,angle,this.player));}this.audio.play("shoot");
  }
  resolveProjectileHits(){
    for(const shot of this.projectiles){if(shot.dead)continue;for(const enemy of this.enemies){if(enemy.dead||distance(shot,enemy)>shot.radius+enemy.radius)continue;enemy.hp-=shot.damage;enemy.flash=.08;shot.dead=true;this.audio.play("hit");this.pixelBurst(shot.x,shot.y,"#fff0b3",3);if(enemy.hp<=0)this.killEnemy(enemy);break;}}
  }
  killEnemy(enemy){enemy.dead=true;this.kills++;this.shake=Math.max(this.shake,2);this.audio.play("kill");this.pixelBurst(enemy.x,enemy.y,this.enemyColor(enemy.kind),10);for(let i=0;i<enemy.drops;i++)this.dropFood(enemy.x+(Math.random()-.5)*8,enemy.y+(Math.random()-.5)*8);}
  enemyColor(kind){return({fries:"#e14b43",burger:"#c88743",donut:"#ed75a0",pizza:"#efc34f",cake:"#e8a7a0"})[kind];}
  dropFood(x,y){if(this.foods.length<WORLD.maxFoods){this.foods.push(new ExperienceFood(x,y));return;}let nearest=this.foods[0],best=Infinity;for(const food of this.foods){const d=Math.hypot(food.x-x,food.y-y);if(d<best){best=d;nearest=food;}}nearest.value+=1;}
  resolvePlayerHits(){
    for(const enemy of this.enemies){if(enemy.dead)continue;const d=distance(this.player,enemy),minimum=this.player.collisionRadius+enemy.radius;if(d>=minimum)continue;
      const nx=(enemy.x-this.player.x)/(d||1),ny=(enemy.y-this.player.y)/(d||1),overlap=minimum-d;enemy.x+=nx*overlap*.65;enemy.y+=ny*overlap*.65;this.player.x-=nx*overlap*.35;this.player.y-=ny*overlap*.35;
      if(this.player.invincible<=0){this.player.hp=Math.max(0,this.player.hp-enemy.damage);this.player.invincible=.5;this.shake=4;this.audio.play("hurt");this.pixelBurst(this.player.x,this.player.y,"#ff4d51",8);if(this.player.hp<=0){this.finish(false);return;}}
    }
  }
  collectFood(food){
    this.audio.play("eat");this.player.eatPulse=.14;this.pixelBurst(this.player.x,this.player.y,"#ffd45e",4);this.floatText(this.player.x,this.player.y-10,Math.random()<.5?"냠!":"+EXP","#fff1a8");
    this.player.xp+=food.value;this.player.bodyProgress+=food.value;while(this.player.xp>=this.player.requiredXp){this.player.xp-=this.player.requiredXp;this.player.level++;this.player.pendingLevels++;}
    if(this.player.pendingLevels>0)this.beginLevelUp();else this.player.updateBodyStage(this);
  }
  onBodyStageChanged(stage){if(this.player.bodyStage===0)return;this.showToast(stage.message,1.7);this.shake=2.5;this.audio.play("grow");}
  beginLevelUp(){
    if(this.state!==GAME_STATE.PLAYING)return;this.state=GAME_STATE.LEVEL_UP;this.levelChoiceLocked=false;this.joystick.reset();this.audio.play("level");this.shake=0;this.createLevelParticles();
    const choices=this.upgrades.choices(this.player);this.ui.upgradeCards.replaceChildren();
    if(!choices.length){this.completeUpgrade(null);return;}
    choices.forEach((upgrade,index)=>{const button=document.createElement("button");button.type="button";button.className="upgrade-card";button.dataset.upgrade=upgrade.id;
      const icon=this.makeUpgradeIcon(upgrade.colors);const info=document.createElement("span");info.className="upgrade-info";const name=document.createElement("strong");name.textContent=upgrade.name;const description=document.createElement("p");description.textContent=upgrade.description;const stage=document.createElement("small");stage.textContent=`현재 ${this.player.upgradeLevels[upgrade.id]||0}단계 / 최대 ${upgrade.max}단계`;info.append(name,description,stage);const key=document.createElement("span");key.className="upgrade-key";key.textContent=String(index+1);button.append(icon,info,key);button.addEventListener("click",()=>this.selectUpgrade(upgrade),{once:true});this.ui.upgradeCards.appendChild(button);});
    this.ui.levelUpScreen.classList.remove("hidden");
  }
  makeUpgradeIcon(colors){const icon=document.createElement("span");icon.className="upgrade-icon";for(let i=0;i<64;i++){const pixel=document.createElement("i"),x=i%8,y=Math.floor(i/8);if((x===3||x===4)||(y>=2&&y<=5&&x>=2&&x<=5)){pixel.style.background=(x+y)%2?colors[0]:colors[1];}icon.appendChild(pixel);}return icon;}
  selectUpgrade(upgrade){if(this.state!==GAME_STATE.LEVEL_UP||this.levelChoiceLocked)return;this.levelChoiceLocked=true;this.ui.upgradeCards.querySelectorAll("button").forEach(button=>button.disabled=true);this.upgrades.apply(this.player,upgrade);this.audio.play("upgrade");setTimeout(()=>this.completeUpgrade(upgrade),120);}
  completeUpgrade(){
    this.player.pendingLevels=Math.max(0,this.player.pendingLevels-1);this.player.digest();this.audio.play("digest");this.showToast("소화 완료!",1.3);this.ui.levelUpScreen.classList.add("hidden");
    if(this.player.pendingLevels>0){setTimeout(()=>this.beginNextQueuedLevel(),180);}else{this.state=GAME_STATE.PLAYING;this.player.updateBodyStage(this);this.lastTime=performance.now();}
  }
  beginNextQueuedLevel(){this.state=GAME_STATE.PLAYING;this.beginLevelUp();}
  finish(victory){
    this.state=victory?GAME_STATE.VICTORY:GAME_STATE.GAME_OVER;this.lastResult=victory?"victory":"defeat";this.ui.hud.classList.add("hidden");this.ui.joystick.classList.add("hidden");this.joystick.reset();
    this.ui.toast.classList.add("hidden");this.toastTimer=0;
    document.getElementById("resultKicker").textContent=victory?"VICTORY!":"GAME OVER";document.getElementById("resultTitle").textContent=victory?"무한리필에서 살아남았습니다!":"배가 터지기 전에 쓰러졌습니다!";
    document.getElementById("resultTime").textContent=formatTime(victory?WORLD.duration:this.elapsed);document.getElementById("resultKills").textContent=String(this.kills);document.getElementById("resultLevel").textContent=String(this.player.level);document.getElementById("resultBody").textContent=BODY_STAGES[this.player.maxBodyStage].name;
    const list=document.getElementById("resultUpgrades");list.replaceChildren();const selected=Object.entries(this.player.upgradeLevels);if(!selected.length){const empty=document.createElement("i");empty.textContent="선택한 강화 없음";list.appendChild(empty);}else selected.forEach(([id,level])=>{const tag=document.createElement("i"),upgrade=UPGRADES.find(item=>item.id===id);tag.textContent=`${upgrade.name} Lv.${level}`;list.appendChild(tag);});
    this.drawResultIcon(victory);this.ui.resultScreen.classList.remove("hidden");this.audio.play(victory?"victory":"defeat");
  }
  drawResultIcon(victory){const icon=document.getElementById("resultIcon");icon.replaceChildren();icon.style.background=victory?"linear-gradient(#ffd45e 0 20%,#e55949 20% 75%,#833245 75%)":"linear-gradient(#7c647f 0 25%,#4d3658 25% 75%,#24162d 75%)";icon.style.clipPath="polygon(20% 0,80% 0,100% 22%,100% 78%,80% 100%,20% 100%,0 78%,0 22%)";}
  pixelBurst(x,y,color,count){for(let i=0;i<count&&this.particles.length<WORLD.maxParticles;i++){const a=Math.random()*TAU,s=18+Math.random()*48;this.particles.push(new Particle(x,y,color,{vx:Math.cos(a)*s,vy:Math.sin(a)*s}));}}
  floatText(x,y,text,color){if(this.particles.length<WORLD.maxParticles)this.particles.push(new Particle(x,y,color,{text,vx:0,vy:-11,life:.65}));}
  createLevelParticles(){for(let i=0;i<24;i++){const a=i/24*TAU,s=15+Math.random()*10;this.particles.push(new Particle(this.player.x,this.player.y,"#ffd45e",{vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1.2}));}}
  updateParticles(dt){for(const particle of this.particles)particle.update(dt);this.particles=this.particles.filter(item=>item.life>0).slice(-WORLD.maxParticles);}
  showToast(message,duration=1.4){this.ui.toast.textContent=message;this.ui.toast.classList.remove("hidden");this.toastTimer=duration;}
  updateHUD(){const p=this.player,progress=clamp(p.xp/p.requiredXp,0,1);this.ui.hpFill.style.width=`${p.hp/p.maxHp*100}%`;this.ui.hpText.textContent=`${Math.ceil(p.hp)}/${p.maxHp}`;this.ui.levelText.textContent=p.level;this.ui.timeText.textContent=formatTime(WORLD.duration-this.elapsed);this.ui.killText.textContent=this.kills;this.ui.bodyStageText.textContent=BODY_STAGES[p.bodyStage].name;this.ui.xpFill.style.width=`${progress*100}%`;this.ui.xpFill.style.background=progress<.25?"#63d471":progress<.5?"#e5cc4f":progress<.75?"#ef8c42":"#d9484d";this.ui.xpText.textContent=`${p.xp} / ${p.requiredXp}`;
    // DOM 진단 값은 접근성/브라우저 테스트에서 Canvas 내부 상태를 확인하는 읽기 전용 표식이다.
    const viewport=document.getElementById("gameViewport");viewport.dataset.gameState=this.state;viewport.dataset.elapsed=this.elapsed.toFixed(3);viewport.dataset.playerX=this.player.x.toFixed(1);viewport.dataset.playerY=this.player.y.toFixed(1);viewport.dataset.moveSpeed=this.player.moveSpeed.toFixed(1);viewport.dataset.playerScale=this.player.currentScale.toFixed(2);viewport.dataset.enemies=String(this.enemies.length);viewport.dataset.projectiles=String(this.projectiles.length);viewport.dataset.foods=String(this.foods.length);
    let nearestFood=null,nearestFoodDistance=Infinity;for(const food of this.foods){const d=distance(this.player,food);if(d<nearestFoodDistance){nearestFoodDistance=d;nearestFood=food;}}viewport.dataset.nearestFood=nearestFood?`${nearestFood.x.toFixed(1)},${nearestFood.y.toFixed(1)}`:"";
  }
  getFeedbackStats(){return{result:this.lastResult,survival_time:Math.floor(this.elapsed),final_level:this.player.level,kill_count:this.kills,max_body_stage:BODY_STAGES[this.player.maxBodyStage].name};}
  draw(){
    const ctx=this.ctx;ctx.clearRect(0,0,WORLD.width,WORLD.height);this.drawFloor(ctx);ctx.save();if(this.shake>.2)ctx.translate(Math.round((Math.random()-.5)*this.shake),Math.round((Math.random()-.5)*this.shake));
    if(this.state!==GAME_STATE.MENU){for(const food of this.foods)food.draw(ctx);for(const projectile of this.projectiles)projectile.draw(ctx);for(const enemy of this.enemies)enemy.draw(ctx,this.elapsed);this.player.draw(ctx);for(const particle of this.particles)particle.draw(ctx);}else this.drawMenuFoods(ctx);ctx.restore();
  }
  drawFloor(ctx){ctx.fillStyle="#241831";ctx.fillRect(0,0,WORLD.width,WORLD.height);ctx.fillStyle="#2d1e3a";for(let y=0;y<WORLD.height;y+=24)for(let x=(y/24%2)*12;x<WORLD.width;x+=24)ctx.fillRect(x,y,12,12);ctx.fillStyle="#ffffff05";for(let x=0;x<WORLD.width;x+=12)ctx.fillRect(x,0,1,WORLD.height);for(let y=0;y<WORLD.height;y+=12)ctx.fillRect(0,y,WORLD.width,1);}
  drawMenuFoods(ctx){const samples=[new Enemy("fries",28,118,{hp:1,speed:1}),new Enemy("burger",198,160,{hp:1,speed:1}),new Enemy("donut",24,270,{hp:1,speed:1}),new Enemy("pizza",200,326,{hp:1,speed:1})];samples.forEach((enemy,i)=>{enemy.draw(ctx,performance.now()/1000+i);});}
}

window.addEventListener("DOMContentLoaded",()=>new Game(),{once:true});
