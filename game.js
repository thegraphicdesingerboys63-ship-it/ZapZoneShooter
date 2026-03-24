const socket = io();
// ── Theme ─────────────────────────────────────────────────────────────────────
const C={bg:'#040c18',primary:'#3a8cc8',primaryBrt:'#5aaae0',primaryDim:'#1e3d5c',silver:'#a8c8e8',white:'#e8f0f8',danger:'#e04060',success:'#40c880',gold:'#e8c040',dark:'#0a1828',panel:'rgba(4,12,24,0.92)',panelBorder:'rgba(58,140,200,0.3)'};
// ── State ─────────────────────────────────────────────────────────────────────
let myId=null,gameState='menu',gameMode='ffa';
let players={},bullets=[],pickups=[],traps=[];
let walls=[],mapW=2400,mapH=1800,killsToWin=20,P_RADIUS=18;
let WEAPONS_DATA={},ABILITIES_DATA={},SKINS_DATA={},MODES_DATA={};
let MAP_JUMP_PADS=[],MAP_TELEPORTERS=[],MAP_HAZARDS=[],MAP_POIS=[];
let myX=0,myY=0,myHp=100,myShield=50,myHeat=0,myWeapon='pulse_rifle',myTeam=-1;
let myAngle=0,myKills=0,myDeaths=0,myAlive=true,teamScores=[0,0],riftData=null;
let myAb=[{key:'dash_burst',cdLeft:0},{key:'energy_dome',cdLeft:0}];
let countdown=3,respawnTimer=0,winner=null,finalScores=[];
let killFeed=[],notifications=[];
let explosions=[],particles=[],beams=[],meleeEffects=[],chainEffects=[],shockwaves=[],hazardPulses=[];
let overheated=false,overloadReady=false;
let myCoins=500,myTotalKills=0,myTotalDeaths=0,myWins=0;
let unlockedWeapons=['pulse_rifle','shock_blaster'],unlockedSkins=['default'];
// Panel toggles
let shopOpen=false,shopTab='weapons',friendsOpen=false,partyOpen=false,settingsOpen=false;
// Friends state
let friendsList=[],pendingRequests=[];
let friendInput='';
// Party state
let myPartyCode=null,myPartyData=null;
// Settings
let settings={sensitivity:1.0,sfx_vol:0.8,crosshair:'dynamic',show_fps:false,show_dmg_nums:true};
let fpsFrames=[],fpsCurrent=0;
let mouseX=0,mouseY=0;
const canvas=document.getElementById('game-canvas');
const ctx=canvas.getContext('2d');
function resize(){canvas.width=window.innerWidth;canvas.height=window.innerHeight;}
window.addEventListener('resize',resize);resize();
canvas.addEventListener('mousemove',e=>{mouseX=e.clientX;mouseY=e.clientY;});
canvas.addEventListener('mousedown',e=>{if(e.button===0)keys['_shoot']=true;});
canvas.addEventListener('mouseup',  e=>{if(e.button===0)keys['_shoot']=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('click',()=>{if(gameState==='playing'&&!anyPanelOpen())canvas.requestPointerLock();});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas){mouseX=Math.max(0,Math.min(canvas.width,mouseX+e.movementX));mouseY=Math.max(0,Math.min(canvas.height,mouseY+e.movementY));}});
const keys={};
document.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();keys[k]=true;
  if(k==='b')  shopOpen=!shopOpen;
  if(k==='f')  friendsOpen=!friendsOpen;
  if(k==='p')  partyOpen=!partyOpen;
  if(k==='o')  settingsOpen=!settingsOpen;
  if(k==='escape'){shopOpen=false;friendsOpen=false;partyOpen=false;settingsOpen=false;}
});
document.addEventListener('keyup',e=>keys[e.key.toLowerCase()]=false);
function anyPanelOpen(){return shopOpen||friendsOpen||partyOpen||settingsOpen;}

// ── Mobile / Touch ─────────────────────────────────────────────────────────────
const isMobile=('ontouchstart' in window)||(navigator.maxTouchPoints>0);
let touchMove={active:false,startX:0,startY:0,dx:0,dy:0,id:null};
let touchAim= {active:false,startX:0,startY:0,dx:0,dy:0,id:null};
let touchShoot=false,touchAb0=false,touchAb1=false;
const _vbtns={};
function _inRect(t,r){return t.clientX>=r.x&&t.clientX<=r.x+r.w&&t.clientY>=r.y&&t.clientY<=r.y+r.h;}
canvas.addEventListener('touchstart',e=>{
  e.preventDefault();
  for(const t of e.changedTouches){
    const half=canvas.width/2;
    if(t.clientX<half){
      if(!touchMove.active) touchMove={active:true,startX:t.clientX,startY:t.clientY,dx:0,dy:0,id:t.identifier};
    } else {
      if(_vbtns.shoot&&_inRect(t,_vbtns.shoot)){touchShoot=true;continue;}
      if(_vbtns.ab0  &&_inRect(t,_vbtns.ab0))  {keys['q']=true;touchAb0=true;continue;}
      if(_vbtns.ab1  &&_inRect(t,_vbtns.ab1))  {keys['e']=true;touchAb1=true;continue;}
      if(_vbtns.shop &&_inRect(t,_vbtns.shop)) {shopOpen=!shopOpen;continue;}
      if(_vbtns.friends&&_inRect(t,_vbtns.friends)){friendsOpen=!friendsOpen;continue;}
      if(_vbtns.party&&_inRect(t,_vbtns.party)){partyOpen=!partyOpen;continue;}
      if(_vbtns.settings&&_inRect(t,_vbtns.settings)){settingsOpen=!settingsOpen;continue;}
      if(!touchAim.active) touchAim={active:true,startX:t.clientX,startY:t.clientY,dx:0,dy:0,id:t.identifier};
    }
  }
},{passive:false});
canvas.addEventListener('touchmove',e=>{
  e.preventDefault();
  for(const t of e.changedTouches){
    if(touchMove.active&&t.identifier===touchMove.id){touchMove.dx=t.clientX-touchMove.startX;touchMove.dy=t.clientY-touchMove.startY;}
    if(touchAim.active &&t.identifier===touchAim.id) {touchAim.dx =t.clientX-touchAim.startX; touchAim.dy =t.clientY-touchAim.startY;}
  }
},{passive:false});
canvas.addEventListener('touchend',e=>{
  e.preventDefault();
  for(const t of e.changedTouches){
    if(touchMove.active&&t.identifier===touchMove.id){touchMove={active:false,dx:0,dy:0,id:null};keys['w']=false;keys['a']=false;keys['s']=false;keys['d']=false;}
    if(touchAim.active &&t.identifier===touchAim.id) touchAim={active:false,dx:0,dy:0,id:null};
    if(_vbtns.shoot&&_inRect(t,_vbtns.shoot)) touchShoot=false;
    if(_vbtns.ab0  &&_inRect(t,_vbtns.ab0))  {keys['q']=false;touchAb0=false;}
    if(_vbtns.ab1  &&_inRect(t,_vbtns.ab1))  {keys['e']=false;touchAb1=false;}
  }
},{passive:false});

// ── Gamepad ────────────────────────────────────────────────────────────────────
let _gpIndex=-1;
const _gpPrev={};
window.addEventListener('gamepadconnected',e=>{_gpIndex=e.gamepad.index;addNotif('Controller connected!',C.success);});
window.addEventListener('gamepaddisconnected',e=>{if(e.gamepad.index===_gpIndex)_gpIndex=-1;addNotif('Controller disconnected',C.silver);});
function _gpEdge(gp,idx,fn){const cur=gp.buttons[idx]?.pressed;if(cur&&!_gpPrev[idx])fn();_gpPrev[idx]=cur;}
function pollGamepad(){
  if(_gpIndex<0) return;
  const gp=navigator.getGamepads()[_gpIndex];
  if(!gp) return;
  const D=0.18;
  // Left stick → movement
  const lx=Math.abs(gp.axes[0])>D?gp.axes[0]:0,ly=Math.abs(gp.axes[1])>D?gp.axes[1]:0;
  keys['a']=lx<-D;keys['d']=lx>D;keys['w']=ly<-D;keys['s']=ly>D;
  // Right stick → aim angle
  const rx=gp.axes[2]??0,ry=gp.axes[3]??0;
  if(Math.abs(rx)>D||Math.abs(ry)>D){
    myAngle=Math.atan2(ry,rx);
    mouseX=canvas.width/2+Math.cos(myAngle)*120;
    mouseY=canvas.height/2+Math.sin(myAngle)*120;
  }
  // RT (button 7) or R2 = shoot
  keys['_shoot']=!!(gp.buttons[7]?.value>0.5||gp.buttons[5]?.pressed);
  // Face buttons: A/Cross=Q, B/Circle=E, X/Square=shop, Y/Triangle=party
  keys['q']=!!(gp.buttons[0]?.pressed);
  keys['e']=!!(gp.buttons[1]?.pressed);
  // Bumpers / back buttons → panel toggles (edge only)
  _gpEdge(gp,4,()=>{shopOpen=!shopOpen;});        // LB / L1
  _gpEdge(gp,6,()=>{friendsOpen=!friendsOpen;}); // LT / L2
  _gpEdge(gp,8,()=>{settingsOpen=!settingsOpen;});// Select / Share
  _gpEdge(gp,9,()=>{partyOpen=!partyOpen;});      // Start / Options
  _gpEdge(gp,2,()=>{if(anyPanelOpen()){shopOpen=false;friendsOpen=false;partyOpen=false;settingsOpen=false;}}); // X/Square = close panels
}

// ── Socket ────────────────────────────────────────────────────────────────────
socket.on('joined',data=>{
  myId=data.playerId;walls=data.walls;mapW=data.mapW;mapH=data.mapH;
  killsToWin=data.killsToWin;P_RADIUS=data.playerRadius;
  WEAPONS_DATA=data.weapons||{};ABILITIES_DATA=data.abilities||{};SKINS_DATA=data.skins||{};MODES_DATA=data.modes||{};
  gameMode=data.mode||'ffa';
  if(data.mapFeatures){MAP_JUMP_PADS=data.mapFeatures.jumpPads||[];MAP_TELEPORTERS=data.mapFeatures.teleporters||[];MAP_HAZARDS=data.mapFeatures.hazardZones||[];MAP_POIS=data.mapFeatures.poiZones||[];}
  const p=data.player;
  myX=p.x;myY=p.y;myHp=p.hp;myShield=p.shield;myHeat=p.heat||0;myWeapon=p.weapon;myAlive=p.alive;myTeam=p.team;
  myAb=p.ab||myAb;
  if(data.dbData){myCoins=data.dbData.coins||500;myTotalKills=data.dbData.total_kills||0;myTotalDeaths=data.dbData.total_deaths||0;myWins=data.dbData.wins||0;unlockedWeapons=data.dbData.unlocked_weapons||['pulse_rifle','shock_blaster'];unlockedSkins=data.dbData.unlocked_skins||['default'];}
  if(data.settings) settings={...settings,...data.settings};
  gameState='lobby';mouseX=canvas.width/2;mouseY=canvas.height/2;
  if(window.onPlayerJoined)window.onPlayerJoined(data.dbData||{});
  if(window._pendingLoadout){const L=window._pendingLoadout;myAb=[{key:L.ab1,cdLeft:0},{key:L.ab2,cdLeft:0}];socket.emit('save_loadout',{ab1:L.ab1,ab2:L.ab2,spawnWeapon:L.spawnWeapon,unlockedWeapons});window._pendingLoadout=null;}
  socket.emit('get_friends');
});
socket.on('state_change',d=>{gameState=d.state;if(d.state==='countdown')countdown=d.countdown||3;if(d.state==='lobby'){winner=null;killFeed=[];}});
socket.on('game_state',data=>{
  const pm={};for(const p of data.players)pm[p.id]=p;
  if(pm[myId]){const me=pm[myId];myX=me.x;myY=me.y;myHp=me.hp;myShield=me.shield;myHeat=me.heat||0;myWeapon=me.weapon;myAlive=me.alive;myKills=me.kills;myDeaths=me.deaths;myTeam=me.team;if(me.ab)myAb=me.ab;}
  players=pm;bullets=data.bullets||[];pickups=data.pickups||[];traps=data.traps||[];
  teamScores=data.teamScores||[0,0];riftData=data.rift||null;
});
socket.on('kill_feed',d=>{killFeed.unshift({text:`${d.killer} ⚡ ${d.victim}`,kColor:d.kColor,t:Date.now()});if(killFeed.length>6)killFeed.pop();playSound('kill');});
socket.on('damaged',  d=>{myHp=d.hp;myShield=d.shield;playSound('hit');});
socket.on('healed',   d=>{myHp=d.hp;playSound('heal');});
socket.on('died',     d=>{myAlive=false;gameState='dead';respawnTimer=d.respawnIn;playSound('death');});
socket.on('respawn',  d=>{myX=d.x;myY=d.y;myHp=100;myShield=50;myHeat=0;myAlive=true;gameState='playing';overheated=false;overloadReady=false;playSound('spawn');});
socket.on('overheated',  ()=>{overheated=true;addNotif('!! OVERHEATED !!',C.danger);playSound('overheat');setTimeout(()=>overheated=false,2000);});
socket.on('overload_ready',()=>{overloadReady=true;addNotif('OVERLOAD READY!',C.gold);});
socket.on('pickup',   ()=>playSound('pickup'));
socket.on('emped',    d=>addNotif(`EMP — disabled ${((d.duration||2000)/1000).toFixed(1)}s`,C.danger));
socket.on('explosion',   d=>addExplosion(d.x,d.y,d.r));
socket.on('beam_fire',   d=>beams.push({...d,life:0,maxLife:80}));
socket.on('melee_swing', d=>meleeEffects.push({pid:d.pid,angle:d.angle,range:d.range,life:0,maxLife:200}));
socket.on('chain_lightning',d=>chainEffects.push({...d,life:0,maxLife:500}));
socket.on('shockwave',   d=>shockwaves.push({x:d.x,y:d.y,r:d.r,life:0,maxLife:600,color:C.primary}));
socket.on('emp',         d=>shockwaves.push({x:d.x,y:d.y,r:d.r,life:0,maxLife:500,color:C.gold}));
socket.on('hazard_pulse',d=>hazardPulses.push({...d,life:0,maxLife:600}));
socket.on('jump_pad',    d=>{addParticlesAt(d.x,d.y,10,d.color||C.success);addNotif('Jump Pad!',C.success);});
socket.on('teleport_used',d=>addParticlesAt(d.x,d.y,12,C.primaryBrt));
socket.on('dash_effect', d=>addParticlesAt(d.x,d.y,8,d.color));
socket.on('dome_on',     ()=>addNotif('Energy Dome active!',C.primaryBrt));
socket.on('dome_block',  ()=>playSound('block'));
socket.on('phase_on',    ()=>addNotif('Phase Shift!',C.silver));
socket.on('trap_trigger',d=>addExplosion(d.x,d.y,60));
socket.on('ability_used',d=>{if(myAb[d.slot])myAb[d.slot]={key:d.key,cdLeft:d.cdMs};});
socket.on('game_over',   d=>{winner=d.winner;finalScores=d.scores;gameState='ended';playSound('win');});
socket.on('player_joined',d=>addNotif(`${d.username} joined`,C.silver));
socket.on('player_left',  d=>addNotif(`${d.username} left`,C.silver));
socket.on('rift_start',   d=>addNotif('⚡ Storm closing in!',C.danger));
socket.on('rift_update',  d=>addNotif(`Storm closing! ${(d.shrinkMs/1000).toFixed(0)}s`,C.danger));
socket.on('purchase_result',d=>{if(d.success){if(d.isWeapon&&!unlockedWeapons.includes(d.itemKey))unlockedWeapons.push(d.itemKey);if(!d.isWeapon&&!unlockedSkins.includes(d.itemKey))unlockedSkins.push(d.itemKey);if(d.newCoins!=null)myCoins=d.newCoins;addNotif('Purchase successful!',C.success);playSound('pickup');}else addNotif(d.reason||'Failed',C.danger);});
socket.on('settings_saved',()=>addNotif('Settings saved',C.success));
// Friends
socket.on('friends_list',data=>{friendsList=data.filter(f=>f.status==='accepted');pendingRequests=data.filter(f=>f.status==='pending');});
socket.on('friend_request',d=>addNotif(`Friend request from ${d.from}!`,C.gold));
socket.on('friend_online', d=>{ const f=friendsList.find(f=>f.username===d.username); if(f)f.online=d.online; });
socket.on('friend_result', d=>{if(d.success){addNotif('Friend request sent!',C.success);socket.emit('get_friends');}else addNotif(d.reason||'Failed',C.danger);});
socket.on('friend_respond_ok',d=>{addNotif(d.accept?'Friend added!':'Request declined',d.accept?C.success:C.silver);socket.emit('get_friends');});
// Party
socket.on('party_created', d=>{myPartyCode=d.code;myPartyData=d;addNotif(`Party created: ${d.code}`,C.gold);});
socket.on('party_update',  d=>{myPartyCode=d.code;myPartyData=d;});
socket.on('party_left',    ()=>{myPartyCode=null;myPartyData=null;addNotif('Left party',C.silver);});
socket.on('party_error',   d=>addNotif(d.reason||'Party error',C.danger));
socket.on('party_invite',  d=>addNotif(`Party invite from ${d.from} [code: ${d.code}]`,C.gold));

// ── Sound ─────────────────────────────────────────────────────────────────────
let audioCtx;
function getAC(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();return audioCtx;}
function playSound(type){
  if(settings.sfx_vol===0) return;
  try{
    const ac=getAC(),g=ac.createGain(),o=ac.createOscillator();
    o.connect(g);g.connect(ac.destination);g.gain.value=settings.sfx_vol;
    const t=ac.currentTime;
    switch(type){
      case 'shoot':    o.type='square';  o.frequency.setValueAtTime(160,t);o.frequency.exponentialRampToValueAtTime(60,t+.08);  g.gain.setValueAtTime(.2*settings.sfx_vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.1);  o.start();o.stop(t+.1);   break;
      case 'hit':      o.type='sawtooth';o.frequency.setValueAtTime(280,t);                                                       g.gain.setValueAtTime(.25*settings.sfx_vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.12);o.start();o.stop(t+.12); break;
      case 'kill':     o.type='sine';    o.frequency.setValueAtTime(440,t);o.frequency.exponentialRampToValueAtTime(880,t+.1);   g.gain.setValueAtTime(.35*settings.sfx_vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);  o.start();o.stop(t+.3);   break;
      case 'death':    o.type='sine';    o.frequency.setValueAtTime(440,t);o.frequency.exponentialRampToValueAtTime(110,t+.5);   g.gain.setValueAtTime(.35*settings.sfx_vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.6);  o.start();o.stop(t+.6);   break;
      case 'pickup':   o.type='sine';    o.frequency.setValueAtTime(660,t);o.frequency.exponentialRampToValueAtTime(990,t+.1);   g.gain.setValueAtTime(.25*settings.sfx_vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);  o.start();o.stop(t+.2);   break;
      case 'spawn':    o.type='sine';    o.frequency.setValueAtTime(330,t);o.frequency.exponentialRampToValueAtTime(660,t+.15);  g.gain.setValueAtTime(.25*settings.sfx_vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);  o.start();o.stop(t+.2);   break;
      case 'overheat': o.type='sawtooth';o.frequency.setValueAtTime(800,t);o.frequency.exponentialRampToValueAtTime(200,t+.3);   g.gain.setValueAtTime(.35*settings.sfx_vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.35);o.start();o.stop(t+.35);  break;
      case 'block':    o.type='square';  o.frequency.setValueAtTime(200,t);                                                       g.gain.setValueAtTime(.2*settings.sfx_vol,t); g.gain.exponentialRampToValueAtTime(.001,t+.1);  o.start();o.stop(t+.1);   break;
      case 'heal':     o.type='sine';    o.frequency.setValueAtTime(528,t);o.frequency.exponentialRampToValueAtTime(792,t+.2);   g.gain.setValueAtTime(.25*settings.sfx_vol,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);  o.start();o.stop(t+.3);   break;
      case 'win':      o.type='sine';    o.frequency.setValueAtTime(440,t);o.frequency.exponentialRampToValueAtTime(880,t+.4);   g.gain.setValueAtTime(.4*settings.sfx_vol,t); g.gain.exponentialRampToValueAtTime(.001,t+.6);  o.start();o.stop(t+.6);   break;
    }
  }catch(e){}
}
// ── VFX ───────────────────────────────────────────────────────────────────────
function addExplosion(x,y,r){explosions.push({x,y,r,life:0,maxLife:500});addParticlesAt(x,y,14,`hsl(${Math.random()*30+10},100%,60%)`);}
function addParticlesAt(x,y,n,color){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=50+Math.random()*160;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0,maxLife:600+Math.random()*400,color,r:2+Math.random()*3});}}
function addNotif(text,color=C.silver){notifications.push({text,color,life:0,maxLife:3500});if(notifications.length>5)notifications.shift();}
// ── Input send ────────────────────────────────────────────────────────────────
let lastSend=0,localLastShot=0;
function sendInput(){
  if(!myId||gameState!=='playing'||anyPanelOpen()) return;
  const now=Date.now();if(now-lastSend<16)return;lastSend=now;
  // Merge touch joystick into keys
  if(touchMove.active){
    const D=15;
    keys['w']=touchMove.dy<-D;keys['s']=touchMove.dy>D;
    keys['a']=touchMove.dx<-D;keys['d']=touchMove.dx>D;
  }
  // Compute aim angle: touch aim overrides mouse
  if(touchAim.active&&(Math.abs(touchAim.dx)>8||Math.abs(touchAim.dy)>8)){
    myAngle=Math.atan2(touchAim.dy,touchAim.dx);
    mouseX=canvas.width/2+Math.cos(myAngle)*100;
    mouseY=canvas.height/2+Math.sin(myAngle)*100;
  } else if(_gpIndex<0||!(Math.abs((navigator.getGamepads()[_gpIndex]?.axes[2]??0))>0.18)){
    // Mouse aim (only if gamepad right stick isn't active)
    const camX=myX-canvas.width/2,camY=myY-canvas.height/2;
    myAngle=Math.atan2(mouseY+camY-myY,mouseX+camX-myX);
  }
  const shooting=!!(keys['_shoot']||touchShoot);
  const wep=WEAPONS_DATA[myWeapon];
  if(shooting&&wep&&now-localLastShot>=wep.rate&&!overheated){localLastShot=now;playSound('shoot');}
  socket.emit('input',{up:!!(keys['w']||keys['arrowup']),down:!!(keys['s']||keys['arrowdown']),left:!!(keys['a']||keys['arrowleft']),right:!!(keys['d']||keys['arrowright']),shooting,angle:myAngle,ab0:!!keys['q'],ab1:!!keys['e']});
}
// ── Draw helpers ──────────────────────────────────────────────────────────────
function glow(col,blur=12){ctx.shadowColor=col;ctx.shadowBlur=blur;}
function noGlow(){ctx.shadowBlur=0;}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
function panel(x,y,w,h,r=8,stroke=C.panelBorder){ctx.fillStyle=C.panel;rr(x,y,w,h,r);ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
function hbar(x,y,w,h,label,val,max,color){ctx.fillStyle='rgba(168,200,232,.35)';ctx.font='10px Arial';ctx.textAlign='left';ctx.fillText(`${label} ${Math.ceil(val)}/${max}`,x,y-1);ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillRect(x,y,w,h);glow(color,5);ctx.fillStyle=color;ctx.fillRect(x,y,w*Math.max(0,val/max),h);noGlow();}
// ── World ─────────────────────────────────────────────────────────────────────
function drawFloor(cx,cy){ctx.save();ctx.strokeStyle='rgba(58,140,200,.05)';ctx.lineWidth=1;const gs=80,sx=Math.floor(cx/gs)*gs,sy=Math.floor(cy/gs)*gs;for(let x=sx;x<cx+canvas.width+gs;x+=gs){ctx.beginPath();ctx.moveTo(x-cx,0);ctx.lineTo(x-cx,canvas.height);ctx.stroke();}for(let y=sy;y<cy+canvas.height+gs;y+=gs){ctx.beginPath();ctx.moveTo(0,y-cy);ctx.lineTo(canvas.width,y-cy);ctx.stroke();}ctx.restore();}
function drawWalls(cx,cy){for(const w of walls){ctx.save();ctx.fillStyle='#0a1828';glow(C.primary,5);ctx.fillRect(w.x-cx,w.y-cy,w.w,w.h);ctx.strokeStyle='rgba(58,140,200,.4)';ctx.lineWidth=1.5;ctx.strokeRect(w.x-cx,w.y-cy,w.w,w.h);ctx.restore();}}

function drawMapFeatures(cx,cy){
  const t=Date.now()/1000;
  // Jump pads
  for(const jp of MAP_JUMP_PADS){
    const sx=jp.x-cx,sy=jp.y-cy,pulse=Math.sin(t*4)*.3+.7;
    ctx.save();glow(jp.color||C.success,16*pulse);ctx.strokeStyle=jp.color||C.success;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(sx,sy,18,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.arc(sx,sy,10,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=`rgba(64,200,128,${pulse*.5})`;ctx.beginPath();ctx.arc(sx,sy,18,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('▲',sx,sy);
    ctx.restore();
  }
  // Teleporters
  for(const tp of MAP_TELEPORTERS){
    const sx=tp.x-cx,sy=tp.y-cy,pulse=Math.sin(t*3+tp.x)*.3+.7;
    ctx.save();glow(C.primaryBrt,14*pulse);ctx.strokeStyle=C.primaryBrt;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(sx,sy,16,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle=`rgba(90,170,224,${pulse*.4})`;ctx.beginPath();ctx.arc(sx,sy,16,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('◈',sx,sy);
    ctx.restore();
  }
  // Hazard zones
  for(const hz of MAP_HAZARDS){
    const sx=hz.x-cx,sy=hz.y-cy,pulse=Math.sin(t*2)*.4+.6;
    ctx.save();ctx.globalAlpha=pulse*.35;glow(C.danger,20);
    ctx.fillStyle=C.danger;ctx.beginPath();ctx.arc(sx,sy,hz.r,0,Math.PI*2);ctx.fill();
    ctx.globalAlpha=1;ctx.strokeStyle=C.danger;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(sx,sy,hz.r,0,Math.PI*2);ctx.stroke();noGlow();
    ctx.globalAlpha=pulse*.8;ctx.fillStyle='rgba(224,64,96,.9)';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('⚠ HAZARD',sx,sy);
    ctx.restore();
  }
  // Hazard pulses
  for(const hp of hazardPulses){
    const t2=hp.life/hp.maxLife;
    ctx.save();ctx.globalAlpha=(1-t2)*.5;glow(C.danger,20);ctx.strokeStyle=C.danger;ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(hp.x-cx,hp.y-cy,hp.r*(.5+t2*.5),0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  // POI zone labels on world (show when near)
  for(const poi of MAP_POIS){
    const dist=Math.hypot(myX-poi.x,myY-poi.y);
    if(dist>poi.r*1.5) continue;
    const alpha=Math.max(0,1-dist/(poi.r*1.5));
    ctx.save();ctx.globalAlpha=alpha*.7;
    ctx.fillStyle=C.silver;ctx.font='bold 14px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(poi.name,poi.x-cx,poi.y-cy);
    ctx.restore();
  }
}

function drawRiftZone(cx,cy){
  if(!riftData) return;
  const{x,y,r}=riftData;
  const t=Date.now()/1000;
  const pulse=Math.sin(t*3)*.2+.8;
  ctx.save();
  // Outside rift = red fog
  ctx.fillStyle='rgba(224,40,60,.12)';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  // Clear inside area
  ctx.globalCompositeOperation='destination-out';
  ctx.fillStyle='rgba(0,0,0,.12)';
  ctx.beginPath();ctx.arc(x-cx,y-cy,r,0,Math.PI*2);ctx.fill();
  ctx.globalCompositeOperation='source-over';
  // Rift ring
  glow(C.danger,20*pulse);ctx.strokeStyle=C.danger;ctx.lineWidth=4;
  ctx.beginPath();ctx.arc(x-cx,y-cy,r,0,Math.PI*2);ctx.stroke();
  // Inner soft ring
  ctx.strokeStyle='rgba(224,64,96,.3)';ctx.lineWidth=20;
  ctx.beginPath();ctx.arc(x-cx,y-cy,r,0,Math.PI*2);ctx.stroke();noGlow();
  ctx.restore();
}

function drawPickups(cx,cy){
  const t=Date.now()/1000;
  for(const pk of pickups){
    if(!pk.active) continue;
    const sx=pk.x-cx,sy=pk.y-cy,pulse=Math.sin(t*3)*.3+.7;
    ctx.save();
    if(pk.type==='health'){glow('#40c880',12*pulse);ctx.fillStyle=`rgba(64,200,128,${pulse})`;ctx.beginPath();ctx.arc(sx,sy,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(sx-6,sy-2,12,4);ctx.fillRect(sx-2,sy-6,4,12);}
    else if(pk.type==='shield'){glow(C.primaryBrt,12*pulse);ctx.fillStyle=`rgba(90,170,224,${pulse})`;ctx.beginPath();ctx.arc(sx,sy,12,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='13px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('◈',sx,sy);}
    else{const wep=WEAPONS_DATA[pk.weapon]||{};glow(wep.color||C.gold,12*pulse);ctx.fillStyle=`rgba(232,192,64,${pulse*.85})`;ctx.beginPath();ctx.arc(sx,sy,14,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText((pk.weapon||'').slice(0,3).toUpperCase(),sx,sy);}
    ctx.restore();
  }
}
function drawTraps(cx,cy){const t=Date.now()/1000;for(const tr of traps){const sx=tr.x-cx,sy=tr.y-cy,pulse=Math.sin(t*5)*.4+.6;ctx.save();glow(C.gold,8*pulse);ctx.fillStyle=`rgba(232,192,64,${pulse*.7})`;ctx.beginPath();ctx.arc(sx,sy,8,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(232,192,64,.9)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(sx,sy,14,0,Math.PI*2);ctx.stroke();ctx.restore();}}
function drawPlayers(cx,cy){
  for(const p of Object.values(players)){
    if(!p.alive) continue;
    const sx=p.x-cx,sy=p.y-cy,isMe=p.id===myId,wep=WEAPONS_DATA[p.weapon]||{};
    ctx.save();
    if(p.invincible&&Math.sin(Date.now()/50)>0){ctx.restore();continue;}
    // Team glow
    const teamGlow=p.team===0?'#5aaae0':p.team===1?'#e04060':p.color;
    glow(teamGlow,isMe?22:14);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(sx,sy,P_RADIUS,0,Math.PI*2);ctx.fill();
    if(p.domed){ctx.strokeStyle=C.primaryBrt;ctx.lineWidth=3;glow(C.primaryBrt,20);ctx.beginPath();ctx.arc(sx,sy,P_RADIUS+8,0,Math.PI*2);ctx.stroke();}
    noGlow();ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.arc(sx,sy,P_RADIUS*.55,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=p.color;ctx.lineWidth=3;glow(p.color,6);
    ctx.beginPath();ctx.moveTo(sx+Math.cos(p.angle)*P_RADIUS,sy+Math.sin(p.angle)*P_RADIUS);ctx.lineTo(sx+Math.cos(p.angle)*(P_RADIUS+(wep.barrel||12)),sy+Math.sin(p.angle)*(P_RADIUS+(wep.barrel||12)));ctx.stroke();
    if(p.shield>0){noGlow();ctx.strokeStyle=`rgba(90,170,224,${p.shield/50*.7})`;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(sx,sy,P_RADIUS+4,0,Math.PI*2);ctx.stroke();}
    noGlow();
    const tag=isMe?`[YOU] ${p.username}`:p.username;const tw=ctx.measureText(tag).width+14;
    ctx.fillStyle='rgba(4,12,24,.7)';ctx.fillRect(sx-tw/2,sy-P_RADIUS-22,tw,16);
    ctx.fillStyle=isMe?C.white:(p.team===0?'#7ab8e0':p.team===1?'#e07080':C.silver);
    ctx.font=(isMe?'bold ':'')+'11px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(tag,sx,sy-P_RADIUS-14);
    const hpPct=p.hp/100;ctx.fillStyle='rgba(0,0,0,.6)';ctx.fillRect(sx-18,sy+P_RADIUS+4,36,5);
    ctx.fillStyle=hpPct>.5?C.success:hpPct>.25?C.gold:C.danger;ctx.fillRect(sx-18,sy+P_RADIUS+4,36*hpPct,5);
    ctx.restore();
  }
}
function drawBullets(cx,cy){for(const b of bullets){const wep=WEAPONS_DATA[b.weapon]||{},col=wep.color||'#fff';ctx.save();glow(col,10);ctx.fillStyle=col;ctx.beginPath();ctx.arc(b.x-cx,b.y-cy,b.weapon==='storm_cannon'?5:3,0,Math.PI*2);ctx.fill();ctx.restore();}}
function drawBeams(cx,cy){for(const b of beams){ctx.save();ctx.globalAlpha=1-b.life/b.maxLife;glow(b.color||'#40e0e0',14);ctx.strokeStyle=b.color||'#40e0e0';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x1-cx,b.y1-cy);ctx.lineTo(b.x2-cx,b.y2-cy);ctx.stroke();ctx.restore();}}
function drawMelee(cx,cy){for(const m of meleeEffects){const p=players[m.pid];if(!p)continue;ctx.save();ctx.globalAlpha=(1-m.life/m.maxLife)*.8;glow('#e040c0',16);ctx.strokeStyle='#e040c0';ctx.lineWidth=2;ctx.beginPath();ctx.arc(p.x-cx,p.y-cy,m.range,m.angle-.5,m.angle+.5);ctx.stroke();ctx.restore();}}
function drawChain(cx,cy){for(const c of chainEffects){const src=players[c.pid];if(!src)continue;ctx.save();ctx.globalAlpha=1-c.life/c.maxLife;glow(C.gold,16);ctx.strokeStyle=C.gold;ctx.lineWidth=2;let lx=src.x,ly=src.y;for(const t of c.targets){ctx.beginPath();ctx.moveTo(lx-cx,ly-cy);const mx=(lx+t.x)/2+(Math.random()-.5)*40,my=(ly+t.y)/2+(Math.random()-.5)*40;ctx.quadraticCurveTo(mx-cx,my-cy,t.x-cx,t.y-cy);ctx.stroke();lx=t.x;ly=t.y;}ctx.restore();}}
function drawShockwaves(cx,cy){for(const s of shockwaves){const prog=s.life/s.maxLife;ctx.save();ctx.globalAlpha=(1-prog)*.6;glow(s.color||C.primary,20);ctx.strokeStyle=s.color||C.primary;ctx.lineWidth=2;ctx.beginPath();ctx.arc(s.x-cx,s.y-cy,s.r*prog,0,Math.PI*2);ctx.stroke();ctx.restore();}}
function drawExplosions(cx,cy){for(const ex of explosions){const t=ex.life/ex.maxLife;ctx.save();ctx.globalAlpha=1-t;glow('#ff6028',30);const g=ctx.createRadialGradient(ex.x-cx,ex.y-cy,0,ex.x-cx,ex.y-cy,ex.r*(.3+t*.7));g.addColorStop(0,'rgba(255,255,200,.9)');g.addColorStop(.4,'rgba(255,100,0,.6)');g.addColorStop(1,'rgba(255,50,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(ex.x-cx,ex.y-cy,ex.r*(.3+t*.7),0,Math.PI*2);ctx.fill();ctx.restore();}}
function drawParticles(cx,cy){for(const p of particles){const t=p.life/p.maxLife;ctx.save();ctx.globalAlpha=1-t;glow(p.color,4);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x-cx,p.y-cy,p.r*(1-t*.5),0,Math.PI*2);ctx.fill();ctx.restore();}}

// ── HUD ───────────────────────────────────────────────────────────────────────
function drawHUD(){
  const W=canvas.width,H=canvas.height;
  // FPS
  if(settings.show_fps){ctx.save();ctx.fillStyle=C.silver;ctx.font='11px Arial';ctx.textAlign='right';ctx.fillText(`FPS: ${fpsCurrent}`,W-8,H-8);ctx.restore();}
  // Bottom-left panel
  ctx.save();panel(10,H-134,244,122);
  const wep=WEAPONS_DATA[myWeapon]||{};
  ctx.fillStyle=wep.color||C.primary;ctx.font='bold 13px Arial';ctx.textAlign='left';
  glow(wep.color||C.primary,8);ctx.fillText((wep.name||myWeapon).toUpperCase(),18,H-116);noGlow();
  hbar(18,H-102,210,8,'HP',myHp,100,myHp>.5?C.success:myHp>.25?C.gold:C.danger);
  hbar(18,H-82, 210,8,'SHD',myShield,50,C.primaryBrt);
  hbar(18,H-62, 210,8,'HEAT',myHeat,100,myHeat>80?C.danger:myHeat>50?C.gold:C.primary);
  if(overheated){ctx.fillStyle=C.danger;ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText('!! OVERHEATED !!',128,H-44);}
  else if(overloadReady){glow(C.gold,8);ctx.fillStyle=C.gold;ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.fillText('⚡ OVERLOAD READY',128,H-44);noGlow();}
  ctx.restore();
  // Team scores (team modes)
  const cfg=MODES_DATA[gameMode];
  if(cfg&&cfg.teams===2){
    ctx.save();panel(W/2-130,6,260,32);
    ctx.fillStyle='#5aaae0';ctx.font='bold 14px Arial';ctx.textAlign='center';
    ctx.fillText(`Blue ${teamScores[0]}  |  Red ${teamScores[1]} — First to ${killsToWin}`,W/2,25);
    ctx.restore();
  } else if(killsToWin>0){
    ctx.save();panel(W/2-90,6,180,30);
    ctx.fillStyle=C.primaryBrt;ctx.font='bold 14px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(`${myKills} / ${killsToWin} kills`,W/2,21);ctx.restore();
  }
  // Rift indicator
  if(riftData){
    ctx.save();ctx.fillStyle=C.danger;ctx.font='bold 12px Arial';ctx.textAlign='center';
    ctx.fillText(`⚡ STORM RADIUS: ${Math.round(riftData.r)}`,W/2,45);
    ctx.restore();
  }
  // Abilities
  ctx.save();
  for(let i=0;i<2;i++){
    const ab=myAb[i];if(!ab)continue;
    const def=ABILITIES_DATA[ab.key]||{},cdLeft=ab.cdLeft||0,cdTotal=def.cd||1,ready=cdLeft<=0;
    const bx=W-160+i*80,by=H-82;
    panel(bx-30,by,60,72,8,ready?C.primary:C.panelBorder);
    if(!ready){ctx.strokeStyle=C.primary;ctx.lineWidth=3;glow(C.primary,6);ctx.beginPath();ctx.arc(bx,by+30,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-cdLeft/cdTotal));ctx.stroke();noGlow();ctx.fillStyle='rgba(255,255,255,.4)';ctx.font='11px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`${(cdLeft/1000).toFixed(1)}s`,bx,by+30);}
    else{glow(C.primary,10);ctx.fillStyle=C.primary;ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('READY',bx,by+30);noGlow();}
    ctx.fillStyle=C.silver;ctx.font='10px Arial';ctx.textAlign='center';ctx.textBaseline='top';ctx.fillText(i===0?'[Q]':'[E]',bx,by+50);
    ctx.fillStyle=C.white;ctx.font='9px Arial';ctx.fillText((def.name||ab.key).slice(0,10),bx,by+60);
  }
  ctx.restore();
  // Scoreboard
  ctx.save();
  const sorted=Object.values(players).filter(p=>!p.isBot||true).sort((a,b)=>b.kills-a.kills).slice(0,8);
  let sy=48;
  for(const p of sorted){
    const isMe=p.id===myId;const teamCol=p.team===0?'#5aaae0':p.team===1?'#e04060':p.color;
    ctx.fillStyle='rgba(4,12,24,.65)';ctx.fillRect(8,sy-13,200,20);
    ctx.fillStyle=teamCol;ctx.font=(isMe?'bold ':'')+'11px Arial';ctx.textAlign='left';glow(teamCol,isMe?6:0);ctx.fillText(p.username+(p.isBot?' 🤖':''),14,sy);noGlow();
    ctx.fillStyle=C.silver;ctx.font='11px Arial';ctx.textAlign='right';ctx.fillText(`${p.kills}K/${p.deaths}D`,205,sy);
    sy+=22;
  }
  const coinsY=sorted.length*22+54;
  ctx.fillStyle='rgba(4,12,24,.65)';ctx.fillRect(8,coinsY,110,20);
  glow(C.gold,6);ctx.fillStyle=C.gold;ctx.font='bold 11px Arial';ctx.textAlign='left';ctx.fillText(`⚡ ${myCoins}`,14,coinsY+13);noGlow();
  ctx.restore();
  // Kill feed
  ctx.save();const now=Date.now();let ky=48;
  for(const kf of killFeed){const age=now-kf.t;if(age>5000)continue;const alpha=Math.min(1,(5000-age)/500);ctx.globalAlpha=alpha;const tw=ctx.measureText(kf.text).width+18;ctx.fillStyle='rgba(4,12,24,.7)';ctx.fillRect(W-tw-8,ky-13,tw,20);ctx.fillStyle=kf.kColor||C.danger;ctx.font='11px Arial';ctx.textAlign='right';ctx.fillText(kf.text,W-12,ky);ky+=22;}ctx.restore();
  // Notifications
  ctx.save();let ny=H/2-80;for(const n of notifications){const a=Math.min(1,Math.min(n.life/300,(n.maxLife-n.life)/400));ctx.globalAlpha=Math.max(0,a);ctx.fillStyle='rgba(4,12,24,.78)';const tw=ctx.measureText(n.text).width+20;ctx.fillRect(W/2-tw/2,ny-13,tw,22);ctx.fillStyle=n.color||C.silver;ctx.font='13px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(n.text,W/2,ny);ny+=28;}ctx.restore();
  // Minimap
  drawMinimap();drawCrosshair();
  // Panel hints
  ctx.save();ctx.fillStyle='rgba(168,200,232,.2)';ctx.font='11px Arial';ctx.textAlign='right';
  ctx.fillText('[B]Shop  [F]Friends  [P]Party  [O]Settings',W-10,H-10);ctx.restore();
}

function drawMinimap(){
  const W=canvas.width,mmW=180,mmH=135,mx=W-mmW-8,my=8;
  const scx=mmW/mapW,scy=mmH/mapH;
  ctx.save();ctx.fillStyle='rgba(4,12,24,.85)';ctx.fillRect(mx,my,mmW,mmH);ctx.strokeStyle=C.panelBorder;ctx.lineWidth=1;ctx.strokeRect(mx,my,mmW,mmH);
  // POI zones on minimap
  for(const poi of MAP_POIS){ctx.save();ctx.globalAlpha=.2;ctx.strokeStyle=C.silver;ctx.lineWidth=1;ctx.beginPath();ctx.arc(mx+poi.x*scx,my+poi.y*scy,poi.r*scx,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.15;ctx.fillStyle='rgba(255,255,255,.05)';ctx.fill();ctx.restore();}
  // Walls
  ctx.fillStyle='rgba(26,56,92,.7)';for(const w of walls){if(w.x<0||w.y<0)continue;ctx.fillRect(mx+w.x*scx,my+w.y*scy,w.w*scx,w.h*scy);}
  // Jump pads
  for(const jp of MAP_JUMP_PADS){ctx.fillStyle=C.success;ctx.beginPath();ctx.arc(mx+jp.x*scx,my+jp.y*scy,2.5,0,Math.PI*2);ctx.fill();}
  // Teleporters
  for(const tp of MAP_TELEPORTERS){ctx.fillStyle=C.primaryBrt;ctx.beginPath();ctx.arc(mx+tp.x*scx,my+tp.y*scy,2,0,Math.PI*2);ctx.fill();}
  // Rift
  if(riftData){ctx.save();ctx.strokeStyle=C.danger;ctx.lineWidth=1;ctx.beginPath();ctx.arc(mx+riftData.x*scx,my+riftData.y*scy,riftData.r*scx,0,Math.PI*2);ctx.stroke();ctx.restore();}
  // Players
  for(const p of Object.values(players)){if(!p.alive)continue;ctx.fillStyle=p.id===myId?'#fff':p.color;glow(p.color,3);ctx.beginPath();ctx.arc(mx+p.x*scx,my+p.y*scy,p.id===myId?3:2,0,Math.PI*2);ctx.fill();}
  // Traps
  for(const t of traps){ctx.fillStyle=C.gold;ctx.fillRect(mx+t.x*scx-1,my+t.y*scy-1,3,3);}
  noGlow();
  // POI labels on minimap (tiny)
  ctx.fillStyle='rgba(168,200,232,.5)';ctx.font='7px Arial';ctx.textAlign='center';
  for(const poi of MAP_POIS){ctx.fillText(poi.name,mx+poi.x*scx,my+poi.y*scy-poi.r*scy-2);}
  ctx.restore();
}

function drawCrosshair(){
  const wep=WEAPONS_DATA[myWeapon]||{};const gap=6+(wep.spread||0)*80,len=8;
  let cStyle=settings.crosshair||'dynamic';
  ctx.save();glow(C.primaryBrt,4);ctx.strokeStyle='rgba(232,240,248,.85)';ctx.lineWidth=1.5;
  if(cStyle==='dot'){ctx.fillStyle='rgba(232,240,248,.9)';ctx.beginPath();ctx.arc(mouseX,mouseY,3,0,Math.PI*2);ctx.fill();}
  else if(cStyle==='circle'){ctx.beginPath();ctx.arc(mouseX,mouseY,10+gap,0,Math.PI*2);ctx.stroke();}
  else{// cross or dynamic
    ctx.beginPath();ctx.moveTo(mouseX-len-gap,mouseY);ctx.lineTo(mouseX-gap,mouseY);ctx.moveTo(mouseX+gap,mouseY);ctx.lineTo(mouseX+len+gap,mouseY);ctx.moveTo(mouseX,mouseY-len-gap);ctx.lineTo(mouseX,mouseY-gap);ctx.moveTo(mouseX,mouseY+gap);ctx.lineTo(mouseX,mouseY+len+gap);ctx.stroke();
  }
  noGlow();ctx.fillStyle='rgba(232,240,248,.4)';ctx.beginPath();ctx.arc(mouseX,mouseY,2,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

// ── Screens ───────────────────────────────────────────────────────────────────
function drawLobby(){
  const W=canvas.width,H=canvas.height;
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);
  const t=Date.now()/1000;ctx.save();ctx.strokeStyle='rgba(58,140,200,.04)';ctx.lineWidth=1;
  for(let i=0;i<16;i++){const x=((i*130+t*20)%(W+130))-130;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}ctx.restore();
  ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
  glow(C.primary,50);ctx.strokeStyle=C.primary;ctx.lineWidth=2;ctx.beginPath();ctx.arc(W/2,H/2-110,64,0,Math.PI*2);ctx.stroke();noGlow();
  glow(C.primaryBrt,30);ctx.fillStyle=C.primaryBrt;ctx.font='bold 64px Arial';ctx.fillText('ZapZone',W/2,H/2-30);noGlow();
  const modeName=MODES_DATA[gameMode]?.name||gameMode;
  ctx.fillStyle=C.gold;ctx.font='bold 16px Arial';ctx.fillText(`Mode: ${modeName}`,W/2,H/2+10);
  ctx.fillStyle=C.silver;ctx.font='18px Arial';ctx.fillText('Waiting for players...',W/2,H/2+38);
  glow(C.primary,6);ctx.fillStyle=C.primaryBrt;ctx.font='16px Arial';
  ctx.fillText(`${Object.values(players).filter(p=>!p.isBot).length} player(s) in room`,W/2,H/2+66);noGlow();
  ctx.fillStyle='rgba(168,200,232,.3)';ctx.font='13px Arial';
  ctx.fillText('[B]Shop  [F]Friends  [P]Party  [O]Settings',W/2,H/2+100);
  if(myPartyCode){glow(C.gold,8);ctx.fillStyle=C.gold;ctx.font='bold 14px Arial';ctx.fillText(`Party Code: ${myPartyCode}`,W/2,H/2+124);noGlow();}
  ctx.restore();
}

function drawCountdown(){ctx.save();ctx.fillStyle='rgba(0,0,0,.5)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.textAlign='center';ctx.textBaseline='middle';glow(C.gold,60);ctx.fillStyle=C.gold;ctx.font='bold 120px Arial';ctx.fillText(Math.ceil(countdown),canvas.width/2,canvas.height/2);noGlow();ctx.fillStyle=C.silver;ctx.font='24px Arial';ctx.fillText('GET READY!',canvas.width/2,canvas.height/2+80);ctx.restore();}
function drawDead(){ctx.save();ctx.fillStyle='rgba(224,64,96,.22)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.textAlign='center';ctx.textBaseline='middle';glow(C.danger,30);ctx.fillStyle=C.danger;ctx.font='bold 56px Arial';ctx.fillText('YOU DIED',canvas.width/2,canvas.height/2-40);noGlow();ctx.fillStyle=C.silver;ctx.font='22px Arial';ctx.fillText(`Respawning in ${Math.max(0,Math.ceil(respawnTimer/1000))}s`,canvas.width/2,canvas.height/2+20);ctx.restore();}
function drawGameOver(){
  const W=canvas.width,H=canvas.height;ctx.save();ctx.fillStyle='rgba(0,0,0,.88)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.textBaseline='middle';glow(C.gold,40);ctx.fillStyle=C.gold;ctx.font='bold 56px Arial';ctx.fillText(`${winner} WINS!`,W/2,H/2-140);noGlow();
  const tW=420,rH=36,startY=H/2-80;panel(W/2-tW/2,startY-24,tW,finalScores.length*rH+48,10);
  ctx.fillStyle='rgba(168,200,232,.5)';ctx.font='12px Arial';ctx.fillText('PLAYER',W/2-90,startY);ctx.fillText('KILLS',W/2+70,startY);ctx.fillText('DEATHS',W/2+150,startY);
  finalScores.forEach((p,i)=>{const ry=startY+28+i*rH;if(i===0){ctx.fillStyle='rgba(232,192,64,.1)';ctx.fillRect(W/2-tW/2+2,ry-16,tW-4,rH);}ctx.fillStyle=p.color;ctx.font=(i===0?'bold ':'')+'14px Arial';glow(p.color,i===0?8:0);ctx.textAlign='center';ctx.fillText(p.username,W/2-90,ry);noGlow();ctx.fillStyle=C.silver;ctx.fillText(p.kills,W/2+70,ry);ctx.fillText(p.deaths,W/2+150,ry);});
  ctx.fillStyle='rgba(168,200,232,.4)';ctx.font='15px Arial';ctx.fillText('Returning to lobby...',W/2,H/2+160);ctx.restore();
}

// ── Shop ──────────────────────────────────────────────────────────────────────
const _buyRects=[];
function drawShop(){
  const W=canvas.width,H=canvas.height,sw=590,sh=510,sx=W/2-sw/2,sy=H/2-sh/2;
  _buyRects.length=0;ctx.save();ctx.fillStyle='rgba(0,0,0,.78)';ctx.fillRect(0,0,W,H);
  panel(sx,sy,sw,sh,12,C.primary);glow(C.primary,10);ctx.fillStyle=C.primaryBrt;ctx.font='bold 20px Arial';ctx.textAlign='center';ctx.fillText('⚡ ZAP SHOP',W/2,sy+30);noGlow();
  ctx.fillStyle=C.gold;ctx.font='14px Arial';ctx.fillText(`Coins: ${myCoins}`,W/2,sy+52);
  ctx.fillStyle='rgba(168,200,232,.4)';ctx.font='11px Arial';ctx.textAlign='right';ctx.fillText('[B]/[ESC] close',sx+sw-12,sy+22);
  for(const[i,tab]of['weapons','skins'].entries()){const tx=sx+20+i*140,ty=sy+66;ctx.fillStyle=shopTab===tab?C.primaryDim:'rgba(0,0,0,.3)';rr(tx,ty,120,26,6);ctx.fill();ctx.strokeStyle=shopTab===tab?C.primary:C.panelBorder;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=shopTab===tab?C.white:C.silver;ctx.font='12px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(tab.toUpperCase(),tx+60,ty+13);}
  ctx.textAlign='left';ctx.textBaseline='alphabetic';
  const items=shopTab==='weapons'?Object.entries(WEAPONS_DATA).filter(([k])=>k!=='pulse_rifle'&&k!=='shock_blaster'):Object.entries(SKINS_DATA||{}).filter(([k])=>k!=='default');
  let row=0,col=0;
  for(const[key,item]of items){
    const owned=shopTab==='weapons'?unlockedWeapons.includes(key):unlockedSkins.includes(key);
    const ix=sx+16+col*193,iy=sy+106+row*92;
    ctx.fillStyle=owned?'rgba(64,200,128,.08)':'rgba(10,24,40,.65)';rr(ix,iy,180,80,8);ctx.fill();ctx.strokeStyle=owned?C.success:C.panelBorder;ctx.lineWidth=1;ctx.stroke();
    const color=item.color||C.primary;glow(color,5);ctx.fillStyle=color;ctx.font='bold 12px Arial';ctx.textAlign='left';ctx.fillText(item.name||key,ix+10,iy+18);noGlow();
    if(shopTab==='weapons'){ctx.fillStyle=C.silver;ctx.font='10px Arial';ctx.fillText(`DMG:${item.dmg}  HEAT:${item.heat}  RPM:${Math.round(60000/item.rate)}`,ix+10,iy+34);ctx.fillText(`RANGE:${item.range>=9999?'MAX':item.range}`,ix+10,iy+48);}
    else{ctx.fillStyle=color;ctx.beginPath();ctx.arc(ix+158,iy+38,16,0,Math.PI*2);ctx.fill();}
    if(owned){ctx.fillStyle=C.success;ctx.font='bold 10px Arial';ctx.textAlign='right';ctx.fillText('OWNED',ix+174,iy+72);}
    else{const bx=ix+106,by=iy+56,bw=66,bh=18,canAfford=myCoins>=(item.price||0);ctx.fillStyle=canAfford?C.primaryDim:'rgba(40,10,10,.8)';rr(bx,by,bw,bh,4);ctx.fill();ctx.strokeStyle=canAfford?C.primary:C.danger;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=C.white;ctx.font='10px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`⚡ ${item.price||0}`,bx+bw/2,by+9);_buyRects.push({x:bx,y:by,w:bw,h:bh,key,isWeapon:shopTab==='weapons'});}
    col++;if(col>=3){col=0;row++;}
  }
  ctx.restore();
}

// ── Friends Panel ─────────────────────────────────────────────────────────────
let friendInputActive=false;
function drawFriends(){
  const W=canvas.width,H=canvas.height,pw=360,ph=480,px=W/2-pw/2,py=H/2-ph/2;
  ctx.save();ctx.fillStyle='rgba(0,0,0,.75)';ctx.fillRect(0,0,W,H);
  panel(px,py,pw,ph,12,C.primary);
  glow(C.primary,10);ctx.fillStyle=C.primaryBrt;ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText('Friends',W/2,py+28);noGlow();
  ctx.fillStyle='rgba(168,200,232,.4)';ctx.font='11px Arial';ctx.fillText('[F]/[ESC] close',W/2,py+44);
  // Add friend input
  ctx.strokeStyle=friendInputActive?C.primary:C.panelBorder;ctx.lineWidth=1;
  rr(px+16,py+56,pw-80,28,6);ctx.fillStyle='rgba(0,0,0,.5)';ctx.fill();ctx.stroke();
  ctx.fillStyle=friendInput?C.white:'rgba(168,200,232,.3)';ctx.font='13px Arial';ctx.textAlign='left';ctx.textBaseline='middle';
  ctx.fillText(friendInput||'Add by username...',px+24,py+70);
  // Send button
  ctx.fillStyle=C.primaryDim;rr(px+pw-58,py+56,44,28,6);ctx.fill();ctx.strokeStyle=C.primary;ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle=C.white;ctx.font='11px Arial';ctx.textAlign='center';ctx.fillText('Add',px+pw-36,py+70);
  // Pending
  if(pendingRequests.length){
    ctx.fillStyle=C.gold;ctx.font='bold 11px Arial';ctx.textAlign='left';ctx.fillText(`Pending (${pendingRequests.length}):`,px+16,py+100);
    let ry=py+116;
    for(const f of pendingRequests.slice(0,3)){
      ctx.fillStyle='rgba(10,24,40,.7)';rr(px+16,ry,pw-32,28,6);ctx.fill();ctx.strokeStyle=C.panelBorder;ctx.lineWidth=1;ctx.stroke();
      ctx.fillStyle=C.white;ctx.font='12px Arial';ctx.fillText(f.username,px+26,ry+14);
      // Accept/Decline buttons
      ctx.fillStyle=C.success;rr(px+pw-80,ry+4,34,20,4);ctx.fill();ctx.fillStyle='#fff';ctx.font='10px Arial';ctx.textAlign='center';ctx.fillText('✓',px+pw-63,ry+14);
      ctx.fillStyle=C.danger;rr(px+pw-42,ry+4,34,20,4);ctx.fill();ctx.fillStyle='#fff';ctx.fillText('✗',px+pw-25,ry+14);
      ry+=34;
    }
  }
  // Friends list
  const listY=pendingRequests.length?py+116+pendingRequests.slice(0,3).length*34+10:py+106;
  ctx.fillStyle=C.silver;ctx.font='bold 11px Arial';ctx.textAlign='left';ctx.fillText(`Friends (${friendsList.length}):`,px+16,listY);
  let fy=listY+16;
  if(friendsList.length===0){ctx.fillStyle='rgba(168,200,232,.35)';ctx.font='12px Arial';ctx.fillText('No friends yet.',px+24,fy+10);}
  for(const f of friendsList.slice(0,8)){
    ctx.fillStyle='rgba(10,24,40,.7)';rr(px+16,fy,pw-32,28,6);ctx.fill();ctx.strokeStyle=C.panelBorder;ctx.lineWidth=1;ctx.stroke();
    const dot=f.online?C.success:'rgba(168,200,232,.3)';ctx.fillStyle=dot;ctx.beginPath();ctx.arc(px+28,fy+14,5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=C.white;ctx.font='12px Arial';ctx.textAlign='left';ctx.fillText(f.username,px+38,fy+14);
    ctx.fillStyle='rgba(168,200,232,.5)';ctx.font='10px Arial';ctx.fillText(`K:${f.total_kills||0} W:${f.wins||0}`,px+38,fy+24);
    // Invite to party button
    if(myPartyCode&&f.online){ctx.fillStyle=C.primaryDim;rr(px+pw-56,fy+4,46,20,4);ctx.fill();ctx.strokeStyle=C.primary;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#fff';ctx.font='9px Arial';ctx.textAlign='center';ctx.fillText('Invite',px+pw-33,fy+14);}
    fy+=34;
  }
  ctx.restore();
}

// ── Party Panel ───────────────────────────────────────────────────────────────
const MODES_LIST_UI=[{k:'ffa',n:'Free For All'},{k:'practice',n:'Practice vs Bots'},{k:'tdm',n:'Team Deathmatch'},{k:'br',n:'Battle Royale'},{k:'1v1',n:'1v1'},{k:'2v2',n:'2v2'},{k:'3v3',n:'3v3'},{k:'4v4',n:'4v4'},{k:'5v5',n:'5v5'}];
let partyJoinInput='';
function drawParty(){
  const W=canvas.width,H=canvas.height,pw=360,ph=420,px=W/2-pw/2,py=H/2-ph/2;
  ctx.save();ctx.fillStyle='rgba(0,0,0,.75)';ctx.fillRect(0,0,W,H);
  panel(px,py,pw,ph,12,C.primary);
  glow(C.primary,10);ctx.fillStyle=C.primaryBrt;ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText('Party',W/2,py+28);noGlow();
  ctx.fillStyle='rgba(168,200,232,.4)';ctx.font='11px Arial';ctx.fillText('[P]/[ESC] close',W/2,py+44);
  if(!myPartyCode){
    // Create party
    ctx.fillStyle=C.primaryDim;rr(px+16,py+64,pw-32,36,8);ctx.fill();ctx.strokeStyle=C.primary;ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle=C.white;ctx.font='bold 14px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Create Party',W/2,py+82);
    ctx.fillStyle='rgba(168,200,232,.4)';ctx.font='12px Arial';ctx.fillText('— or join with code —',W/2,py+118);
    ctx.strokeStyle=C.panelBorder;rr(px+16,py+130,pw-80,28,6);ctx.fillStyle='rgba(0,0,0,.5)';ctx.fill();ctx.stroke();
    ctx.fillStyle=partyJoinInput?C.white:'rgba(168,200,232,.3)';ctx.font='13px Arial';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(partyJoinInput||'Enter party code...',px+24,py+144);
    ctx.fillStyle=C.primaryDim;rr(px+pw-58,py+130,44,28,6);ctx.fill();ctx.strokeStyle=C.primary;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=C.white;ctx.font='11px Arial';ctx.textAlign='center';ctx.fillText('Join',px+pw-36,py+144);
  } else {
    // In party
    glow(C.gold,8);ctx.fillStyle=C.gold;ctx.font='bold 20px Arial';ctx.textAlign='center';ctx.fillText(`Code: ${myPartyCode}`,W/2,py+72);noGlow();
    ctx.fillStyle=C.silver;ctx.font='13px Arial';ctx.fillText('Share this code with friends',W/2,py+92);
    if(myPartyData){
      const members=myPartyData.members||[];
      ctx.fillStyle=C.silver;ctx.font='bold 11px Arial';ctx.textAlign='left';ctx.fillText(`Members (${members.length}):`,px+16,py+116);
      let my=py+132;
      for(const m of members){ctx.fillStyle='rgba(10,24,40,.7)';rr(px+16,my,pw-32,28,6);ctx.fill();ctx.strokeStyle=C.panelBorder;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=m.username===myPartyData.leader?C.gold:C.white;ctx.font='12px Arial';ctx.textAlign='left';ctx.fillText(m.username+(m.username===myPartyData.leader?' 👑':''),px+26,my+14);my+=34;}
      // Mode selector
      const modeLabel=MODES_LIST_UI.find(m=>m.k===myPartyData.mode)?.n||myPartyData.mode;
      ctx.fillStyle=C.silver;ctx.font='11px Arial';ctx.textAlign='left';ctx.fillText('Mode: ',px+16,my+20);
      ctx.fillStyle=C.primaryBrt;ctx.font='bold 11px Arial';ctx.fillText(modeLabel,px+50,my+20);
    }
    // Leave button
    ctx.fillStyle='rgba(60,10,10,.8)';rr(px+16,py+ph-54,pw-32,36,8);ctx.fill();ctx.strokeStyle=C.danger;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=C.danger;ctx.font='bold 13px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Leave Party',W/2,py+ph-36);
  }
  ctx.restore();
}

// ── Settings Panel ────────────────────────────────────────────────────────────
function drawSettings(){
  const W=canvas.width,H=canvas.height,pw=380,ph=400,px=W/2-pw/2,py=H/2-ph/2;
  ctx.save();ctx.fillStyle='rgba(0,0,0,.75)';ctx.fillRect(0,0,W,H);
  panel(px,py,pw,ph,12,C.primary);
  glow(C.primary,10);ctx.fillStyle=C.primaryBrt;ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText('Settings',W/2,py+28);noGlow();
  ctx.fillStyle='rgba(168,200,232,.4)';ctx.font='11px Arial';ctx.fillText('[O]/[ESC] close',W/2,py+44);
  ctx.textAlign='left';ctx.textBaseline='middle';
  const lx=px+20,rx=px+pw-20,barW=140,bly=py+72;
  // Sensitivity
  ctx.fillStyle=C.silver;ctx.font='13px Arial';ctx.fillText('Sensitivity',lx,bly+6);
  ctx.fillStyle='rgba(0,0,0,.4)';rr(rx-barW,bly,barW,12,4);ctx.fill();ctx.strokeStyle=C.panelBorder;ctx.lineWidth=1;ctx.stroke();
  glow(C.primary,4);ctx.fillStyle=C.primary;ctx.fillRect(rx-barW,bly,barW*((settings.sensitivity-0.5)/1.5),12);noGlow();
  ctx.fillStyle=C.white;ctx.font='11px Arial';ctx.textAlign='right';ctx.fillText(settings.sensitivity.toFixed(2),rx+2,bly+6);
  // SFX Vol
  const svly=bly+40;ctx.textAlign='left';ctx.fillStyle=C.silver;ctx.font='13px Arial';ctx.fillText('SFX Volume',lx,svly+6);
  ctx.fillStyle='rgba(0,0,0,.4)';rr(rx-barW,svly,barW,12,4);ctx.fill();ctx.strokeStyle=C.panelBorder;ctx.lineWidth=1;ctx.stroke();
  glow(C.primary,4);ctx.fillStyle=C.primary;ctx.fillRect(rx-barW,svly,barW*settings.sfx_vol,12);noGlow();
  ctx.fillStyle=C.white;ctx.font='11px Arial';ctx.textAlign='right';ctx.fillText(Math.round(settings.sfx_vol*100)+'%',rx+2,svly+6);
  // Crosshair
  const chly=svly+44;ctx.textAlign='left';ctx.fillStyle=C.silver;ctx.font='13px Arial';ctx.fillText('Crosshair',lx,chly+6);
  const chOptions=['cross','dot','circle','dynamic'];let cx2=rx-barW;
  for(const opt of chOptions){const sel=settings.crosshair===opt;ctx.fillStyle=sel?C.primaryDim:'rgba(0,0,0,.4)';rr(cx2,chly,barW/4-4,20,4);ctx.fill();ctx.strokeStyle=sel?C.primary:C.panelBorder;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=sel?C.white:C.silver;ctx.font='10px Arial';ctx.textAlign='center';ctx.fillText(opt,cx2+barW/8-2,chly+10);cx2+=barW/4;}
  // Show FPS
  const fpsly=chly+38;ctx.textAlign='left';ctx.fillStyle=C.silver;ctx.font='13px Arial';ctx.fillText('Show FPS',lx,fpsly+6);
  ctx.fillStyle=settings.show_fps?C.primaryDim:'rgba(0,0,0,.4)';rr(rx-40,fpsly,40,20,4);ctx.fill();ctx.strokeStyle=settings.show_fps?C.primary:C.panelBorder;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=settings.show_fps?C.white:C.silver;ctx.font='11px Arial';ctx.textAlign='center';ctx.fillText(settings.show_fps?'ON':'OFF',rx-20,fpsly+10);
  // Show dmg numbers
  const dmgly=fpsly+36;ctx.textAlign='left';ctx.fillStyle=C.silver;ctx.font='13px Arial';ctx.fillText('Damage Numbers',lx,dmgly+6);
  ctx.fillStyle=settings.show_dmg_nums?C.primaryDim:'rgba(0,0,0,.4)';rr(rx-40,dmgly,40,20,4);ctx.fill();ctx.strokeStyle=settings.show_dmg_nums?C.primary:C.panelBorder;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=settings.show_dmg_nums?C.white:C.silver;ctx.font='11px Arial';ctx.textAlign='center';ctx.fillText(settings.show_dmg_nums?'ON':'OFF',rx-20,dmgly+10);
  // Save button
  const savely=py+ph-54;ctx.fillStyle=C.primaryDim;rr(px+16,savely,pw-32,36,8);ctx.fill();ctx.strokeStyle=C.primary;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=C.white;ctx.font='bold 14px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Save Settings',W/2,savely+18);
  ctx.restore();
  // Store refs for click handling
  window._settingsRects={sensitivity:{x:W/2-barW/2-10,y:bly,w:barW,h:12},sfx:{x:W/2-barW/2-10,y:svly,w:barW,h:12},save:{x:px+16,y:savely,w:pw-32,h:36},showFps:{x:rx-40,y:fpsly,w:40,h:20},showDmg:{x:rx-40,y:dmgly,w:40,h:20},chOptions:chOptions.map((opt,i)=>({opt,x:rx-barW+i*(barW/4),y:chly,w:barW/4-4,h:20}))};
}

// ── Panel click handlers ──────────────────────────────────────────────────────
canvas.addEventListener('mousedown',e=>{
  if(e.button!==0) return;
  // Shop
  if(shopOpen){
    for(const r of _buyRects){if(e.clientX>=r.x&&e.clientX<=r.x+r.w&&e.clientY>=r.y&&e.clientY<=r.y+r.h){if(r.isWeapon)socket.emit('buy_weapon',{weaponKey:r.key});else socket.emit('buy_skin',{skinKey:r.key});}}
    const W=canvas.width,H=canvas.height,sx=W/2-295,sy=H/2-255;
    if(e.clientY>=sy+66&&e.clientY<=sy+92){if(e.clientX>=sx+20&&e.clientX<=sx+140)shopTab='weapons';if(e.clientX>=sx+160&&e.clientX<=sx+280)shopTab='skins';}
    return;
  }
  // Friends
  if(friendsOpen){
    const W=canvas.width,H=canvas.height,pw=360,ph=480,px=W/2-pw/2,py=H/2-ph/2;
    // Add friend input area
    if(e.clientX>=px+16&&e.clientX<=px+pw-64&&e.clientY>=py+56&&e.clientY<=py+84) friendInputActive=true;
    else friendInputActive=false;
    // Send button
    if(e.clientX>=px+pw-58&&e.clientX<=px+pw-14&&e.clientY>=py+56&&e.clientY<=py+84){if(friendInput.trim()){socket.emit('add_friend',{target:friendInput.trim()});friendInput='';}}
    // Pending accept/decline
    let ry=py+116+((pendingRequests.length)?0:0);
    for(const f of pendingRequests.slice(0,3)){
      if(e.clientY>=ry+4&&e.clientY<=ry+24){
        if(e.clientX>=px+pw-80&&e.clientX<=px+pw-46){socket.emit('respond_friend',{from:f.username,accept:true});}
        if(e.clientX>=px+pw-42&&e.clientX<=px+pw-8) {socket.emit('respond_friend',{from:f.username,accept:false});}
      }
      ry+=34;
    }
    // Invite buttons
    if(myPartyCode){
      const listY=pendingRequests.length?py+116+pendingRequests.slice(0,3).length*34+10:py+106;
      let fy=listY+16;
      for(const f of friendsList.slice(0,8)){
        if(f.online&&e.clientX>=px+pw-56&&e.clientX<=px+pw-10&&e.clientY>=fy+4&&e.clientY<=fy+24){socket.emit('invite_friend',{friend:f.username});}
        fy+=34;
      }
    }
    return;
  }
  // Party
  if(partyOpen){
    const W=canvas.width,H=canvas.height,pw=360,ph=420,px=W/2-pw/2,py=H/2-ph/2;
    if(!myPartyCode){
      // Create button
      if(e.clientX>=px+16&&e.clientX<=px+pw-16&&e.clientY>=py+64&&e.clientY<=py+100){socket.emit('create_party',{mode:gameMode});}
      // Join input
      if(e.clientX>=px+16&&e.clientX<=px+pw-64&&e.clientY>=py+130&&e.clientY<=py+158) window._partyJoinActive=true;
      else window._partyJoinActive=false;
      // Join button
      if(e.clientX>=px+pw-58&&e.clientX<=px+pw-14&&e.clientY>=py+130&&e.clientY<=py+158){if(partyJoinInput.trim()){socket.emit('join_party',{code:partyJoinInput.trim().toUpperCase()});partyJoinInput='';}}
    } else {
      // Leave button
      if(e.clientX>=px+16&&e.clientX<=px+pw-16&&e.clientY>=py+ph-54&&e.clientY<=py+ph-18){socket.emit('leave_party');}
    }
    return;
  }
  // Settings
  if(settingsOpen&&window._settingsRects){
    const sr=window._settingsRects;
    if(e.clientX>=sr.sensitivity.x&&e.clientX<=sr.sensitivity.x+sr.sensitivity.w&&e.clientY>=sr.sensitivity.y&&e.clientY<=sr.sensitivity.y+sr.sensitivity.h){settings.sensitivity=Math.max(0.5,Math.min(2.0,(e.clientX-sr.sensitivity.x)/sr.sensitivity.w*1.5+0.5));}
    if(e.clientX>=sr.sfx.x&&e.clientX<=sr.sfx.x+sr.sfx.w&&e.clientY>=sr.sfx.y&&e.clientY<=sr.sfx.y+sr.sfx.h){settings.sfx_vol=Math.max(0,Math.min(1,(e.clientX-sr.sfx.x)/sr.sfx.w));}
    if(e.clientX>=sr.showFps.x&&e.clientX<=sr.showFps.x+sr.showFps.w&&e.clientY>=sr.showFps.y&&e.clientY<=sr.showFps.y+sr.showFps.h){settings.show_fps=!settings.show_fps;}
    if(e.clientX>=sr.showDmg.x&&e.clientX<=sr.showDmg.x+sr.showDmg.w&&e.clientY>=sr.showDmg.y&&e.clientY<=sr.showDmg.y+sr.showDmg.h){settings.show_dmg_nums=!settings.show_dmg_nums;}
    for(const c of sr.chOptions){if(e.clientX>=c.x&&e.clientX<=c.x+c.w&&e.clientY>=c.y&&e.clientY<=c.y+c.h)settings.crosshair=c.opt;}
    if(e.clientX>=sr.save.x&&e.clientX<=sr.save.x+sr.save.w&&e.clientY>=sr.save.y&&e.clientY<=sr.save.y+sr.save.h){socket.emit('save_settings',settings);}
  }
});

// Keyboard input for friends/party text boxes
document.addEventListener('keydown',e=>{
  if(friendsOpen&&friendInputActive){
    if(e.key==='Backspace') friendInput=friendInput.slice(0,-1);
    else if(e.key==='Enter'&&friendInput.trim()){socket.emit('add_friend',{target:friendInput.trim()});friendInput='';}
    else if(e.key.length===1&&friendInput.length<20) friendInput+=e.key;
    e.stopPropagation();
  }
  if(partyOpen&&window._partyJoinActive){
    if(e.key==='Backspace') partyJoinInput=partyJoinInput.slice(0,-1);
    else if(e.key==='Enter'&&partyJoinInput.trim()){socket.emit('join_party',{code:partyJoinInput.trim().toUpperCase()});partyJoinInput='';}
    else if(e.key.length===1&&partyJoinInput.length<6) partyJoinInput+=e.key.toUpperCase();
    e.stopPropagation();
  }
});

// ── Touch Controls (mobile HUD) ───────────────────────────────────────────────
function drawTouchControls(){
  if(!isMobile) return;
  const W=canvas.width,H=canvas.height;
  const jR=62,jBx=110,jBy=H-120;
  ctx.save();
  // ── Left joystick ──
  ctx.globalAlpha=0.28;ctx.strokeStyle=C.primaryBrt;ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(jBx,jBy,jR,0,Math.PI*2);ctx.stroke();
  ctx.strokeStyle='rgba(90,170,224,.15)';ctx.lineWidth=1;
  ctx.beginPath();ctx.arc(jBx,jBy,jR*0.5,0,Math.PI*2);ctx.stroke();
  if(touchMove.active){
    const maxD=jR*0.82,ang=Math.atan2(touchMove.dy,touchMove.dx),dist=Math.min(Math.hypot(touchMove.dx,touchMove.dy),maxD);
    const nx=jBx+Math.cos(ang)*dist,ny=jBy+Math.sin(ang)*dist;
    ctx.globalAlpha=0.65;glow(C.primaryBrt,12);
    ctx.fillStyle=C.primary;ctx.beginPath();ctx.arc(nx,ny,28,0,Math.PI*2);ctx.fill();
    noGlow();
  } else {
    ctx.globalAlpha=0.35;ctx.fillStyle=C.primaryDim;ctx.beginPath();ctx.arc(jBx,jBy,28,0,Math.PI*2);ctx.fill();
  }
  // WASD labels
  ctx.globalAlpha=0.35;ctx.fillStyle=C.silver;ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('▲',jBx,jBy-jR+14);ctx.fillText('▼',jBx,jBy+jR-14);
  ctx.fillText('◀',jBx-jR+14,jBy);ctx.fillText('▶',jBx+jR-14,jBy);

  // ── Right side buttons ──
  const bR=34,shootX=W-90,shootY=H-110;
  const ab0X=W-200,ab0Y=H-140;
  const ab1X=W-100,ab1Y=H-220;
  // FIRE
  ctx.globalAlpha=touchShoot?0.85:0.42;
  glow(C.danger,touchShoot?18:4);
  ctx.fillStyle=touchShoot?C.danger:'rgba(180,30,60,.6)';
  ctx.beginPath();ctx.arc(shootX,shootY,bR,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=C.danger;ctx.lineWidth=2;ctx.stroke();
  ctx.globalAlpha=1;ctx.fillStyle='#fff';ctx.font='bold 12px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('FIRE',shootX,shootY);noGlow();
  // Ability Q
  const ab0Def=ABILITIES_DATA[myAb[0]?.key]||{};const ab0Ready=!(myAb[0]?.cdLeft>0);
  ctx.globalAlpha=keys['q']?0.85:0.4;
  glow(ab0Ready?C.primary:C.panelBorder,keys['q']?12:3);
  ctx.fillStyle=ab0Ready?C.primaryDim:'rgba(10,20,36,.7)';ctx.beginPath();ctx.arc(ab0X,ab0Y,28,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=ab0Ready?C.primary:C.panelBorder;ctx.lineWidth=1.5;ctx.stroke();
  ctx.globalAlpha=1;ctx.fillStyle=ab0Ready?C.white:C.silver;ctx.font='bold 10px Arial';
  ctx.fillText('Q',ab0X,ab0Y-8);ctx.font='8px Arial';ctx.fillText((ab0Def.name||'').slice(0,9),ab0X,ab0Y+6);
  noGlow();
  // Ability E
  const ab1Def=ABILITIES_DATA[myAb[1]?.key]||{};const ab1Ready=!(myAb[1]?.cdLeft>0);
  ctx.globalAlpha=keys['e']?0.85:0.4;
  glow(ab1Ready?C.primaryBrt:C.panelBorder,keys['e']?12:3);
  ctx.fillStyle=ab1Ready?'rgba(30,80,130,.8)':'rgba(10,20,36,.7)';ctx.beginPath();ctx.arc(ab1X,ab1Y,28,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=ab1Ready?C.primaryBrt:C.panelBorder;ctx.lineWidth=1.5;ctx.stroke();
  ctx.globalAlpha=1;ctx.fillStyle=ab1Ready?C.white:C.silver;ctx.font='bold 10px Arial';
  ctx.fillText('E',ab1X,ab1Y-8);ctx.font='8px Arial';ctx.fillText((ab1Def.name||'').slice(0,9),ab1X,ab1Y+6);
  noGlow();
  // Panel shortcut pills (top-right column)
  const pills=[{lbl:'Shop',k:'shop'},{lbl:'Friends',k:'friends'},{lbl:'Party',k:'party'},{lbl:'⚙',k:'settings'}];
  let py2=52;
  for(const p of pills){
    ctx.globalAlpha=0.38;ctx.fillStyle=C.dark;rr(W-70,py2,62,22,6);ctx.fill();ctx.strokeStyle=C.panelBorder;ctx.lineWidth=1;ctx.stroke();
    ctx.globalAlpha=0.9;ctx.fillStyle=C.silver;ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.lbl,W-39,py2+11);
    _vbtns[p.k]={x:W-70,y:py2,w:62,h:22};py2+=28;
  }
  // Store collision rects
  _vbtns.shoot={x:shootX-bR,y:shootY-bR,w:bR*2,h:bR*2};
  _vbtns.ab0  ={x:ab0X-28,y:ab0Y-28,w:56,h:56};
  _vbtns.ab1  ={x:ab1X-28,y:ab1Y-28,w:56,h:56};
  ctx.restore();
}

// ── Main loop ─────────────────────────────────────────────────────────────────
let lastFrame=0,lastSend2=0;
function loop(ts){
  const dt=Math.min(ts-lastFrame,50);lastFrame=ts;
  const W=canvas.width,H=canvas.height;
  pollGamepad();
  // FPS counter
  fpsFrames.push(ts);fpsFrames=fpsFrames.filter(t=>ts-t<1000);fpsCurrent=fpsFrames.length;
  ctx.clearRect(0,0,W,H);
  // Tick VFX
  for(const ex of explosions)   ex.life+=dt;
  for(const p  of particles)    {p.life+=dt;p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.vx*=.93;p.vy*=.93;}
  for(const b  of beams)         b.life+=dt;
  for(const c  of chainEffects)  c.life+=dt;
  for(const s  of shockwaves)    s.life+=dt;
  for(const m  of meleeEffects)  m.life+=dt;
  for(const n  of notifications) n.life+=dt;
  for(const h  of hazardPulses)  h.life+=dt;
  if(respawnTimer>0)respawnTimer-=dt;
  if(gameState==='countdown'&&countdown>0)countdown-=dt/1000;
  for(const ab of myAb){if(ab&&ab.cdLeft>0)ab.cdLeft=Math.max(0,ab.cdLeft-dt);}
  explosions   =explosions.filter(e=>e.life<e.maxLife);
  particles    =particles.filter(p=>p.life<p.maxLife);
  beams        =beams.filter(b=>b.life<b.maxLife);
  chainEffects =chainEffects.filter(c=>c.life<c.maxLife);
  shockwaves   =shockwaves.filter(s=>s.life<s.maxLife);
  meleeEffects =meleeEffects.filter(m=>m.life<m.maxLife);
  notifications=notifications.filter(n=>n.life<n.maxLife);
  hazardPulses =hazardPulses.filter(h=>h.life<h.maxLife);

  if(gameState==='menu'||gameState==='lobby'){
    ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);
    if(gameState==='lobby') drawLobby();
  } else {
    const camX=myX-W/2,camY=myY-H/2;
    ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);
    drawFloor(camX,camY);
    ctx.save();ctx.strokeStyle='rgba(58,140,200,.1)';ctx.lineWidth=3;glow(C.primary,12);ctx.strokeRect(-camX,-camY,mapW,mapH);noGlow();ctx.restore();
    drawWalls(camX,camY);
    drawMapFeatures(camX,camY);
    drawTraps(camX,camY);
    drawPickups(camX,camY);
    drawRiftZone(camX,camY);
    drawExplosions(camX,camY);
    drawShockwaves(camX,camY);
    drawParticles(camX,camY);
    drawBeams(camX,camY);
    drawBullets(camX,camY);
    drawMelee(camX,camY);
    drawChain(camX,camY);
    drawPlayers(camX,camY);
    if(['playing','dead','countdown'].includes(gameState)){drawHUD();if(gameState==='playing')sendInput();}
    if(gameState==='countdown') drawCountdown();
    if(gameState==='dead')      drawDead();
    if(gameState==='ended')     drawGameOver();
  }
  // Overlays (available in any game state)
  if(shopOpen)    drawShop();
  if(friendsOpen) drawFriends();
  if(partyOpen)   drawParty();
  if(settingsOpen)drawSettings();
  // Mobile virtual controls (drawn last, on top of everything)
  if(['playing','dead','countdown'].includes(gameState)&&!anyPanelOpen()) drawTouchControls();
  requestAnimationFrame(loop);
}
requestAnimationFrame(ts=>{lastFrame=ts;requestAnimationFrame(loop);});
