require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const db   = require('./db');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
app.use(express.static(path.join(__dirname)));
const PORT = process.env.PORT || 3000;

// ── Constants ─────────────────────────────────────────────────────────────────
const MAP_W=2400, MAP_H=1800, P_SPEED=230, P_RADIUS=18, RESPAWN_MS=3500, TICK_MS=1000/60, BCAST_EVERY=3;
const PLAYER_COLORS=['#5aaae0','#e04060','#40c880','#e8c040','#e06028','#a048c8','#28c0c8','#e048a0'];
const TEAM_COLORS=[['#5aaae0','#3a8cc8'],['#e04060','#c82840']]; // [blue,red]

const MODES = {
  ffa:      {name:'Free For All',     maxP:8,  teams:0, kills:20, bots:0, respawn:true,  br:false},
  practice: {name:'Practice vs Bots', maxP:1,  teams:0, kills:30, bots:5, respawn:true,  br:false},
  tdm:      {name:'Team Deathmatch',  maxP:10, teams:2, kills:30, bots:0, respawn:true,  br:false},
  br:       {name:'Battle Royale',    maxP:20, teams:0, kills:0,  bots:0, respawn:false, br:true },
  '1v1':    {name:'1v1',              maxP:2,  teams:2, kills:10, bots:0, respawn:true,  br:false},
  '2v2':    {name:'2v2',              maxP:4,  teams:2, kills:20, bots:0, respawn:true,  br:false},
  '3v3':    {name:'3v3',              maxP:6,  teams:2, kills:30, bots:0, respawn:true,  br:false},
  '4v4':    {name:'4v4',              maxP:8,  teams:2, kills:40, bots:0, respawn:true,  br:false},
  '5v5':    {name:'5v5',              maxP:10, teams:2, kills:50, bots:0, respawn:true,  br:false},
};

const WEAPONS = {
  pulse_rifle:   {name:'Pulse Rifle',    dmg:24,  speed:750,  rate:100,  heat:8,  spread:0.03,barrel:14,color:'#3a8cc8',range:800, price:0   },
  shock_blaster: {name:'Shock Blaster',  dmg:90,  speed:460,  rate:750,  heat:20, spread:0.08,barrel:10,color:'#e06028',range:300, price:0   },
  volt_smg:      {name:'Volt SMG',       dmg:18,  speed:720,  rate:67,   heat:14, spread:0.07,barrel:11,color:'#40c880',range:450, price:1200},
  arc_burst:     {name:'Arc Burst',      dmg:30,  speed:760,  rate:220,  heat:10, spread:0.06,barrel:14,color:'#7ab8e0',range:700, price:1500,pellets:3},
  static_dmr:    {name:'Static DMR',     dmg:55,  speed:1000, rate:333,  heat:12, spread:0.01,barrel:18,color:'#a8c8e8',range:1300,price:2000},
  storm_cannon:  {name:'Storm Cannon',   dmg:70,  speed:400,  rate:500,  heat:18, spread:0.02,barrel:16,color:'#e8c040',range:600, price:2200,splash:120},
  chain_launcher:{name:'Chain Launcher', dmg:40,  speed:550,  rate:300,  heat:15, spread:0,   barrel:15,color:'#c048e0',range:900, price:2300,bounces:3},
  rail_sniper:   {name:'Rail Sniper',    dmg:120, speed:1600, rate:1200, heat:25, spread:0,   barrel:24,color:'#e8f0f8',range:9999,price:2500},
  disruptor:     {name:'Disruptor Gun',  dmg:20,  speed:680,  rate:150,  heat:10, spread:0.04,barrel:12,color:'#e04060',range:700, price:2800},
  beam_laser:    {name:'Beam Laser',     dmg:12,  speed:0,    rate:50,   heat:4,  spread:0,   barrel:14,color:'#40e0e0',range:650, price:3000,beam:true},
  energy_blade:  {name:'Energy Blade',   dmg:50,  speed:0,    rate:450,  heat:0,  spread:0,   barrel:8, color:'#e040c0',range:60,  price:1800,melee:true},
};

const ABILITIES = {
  dash_burst:      {name:'Dash Burst',      cd:5000,  desc:'Quick dash in move direction'},
  blink_step:      {name:'Blink Step',      cd:10000, desc:'Teleport in aim direction'},
  chain_lightning: {name:'Chain Lightning', cd:15000, desc:'Lightning chains 3 enemies',  dmg:45},
  shockwave_slam:  {name:'Shockwave Slam',  cd:12000, desc:'Knockback + damage AoE',      dmg:30,radius:200},
  energy_dome:     {name:'Energy Dome',     cd:18000, desc:'Absorb all damage for 2.5s',  duration:2500},
  heal_surge:      {name:'Heal Surge',      cd:35000, desc:'Instantly restore 60 HP',     heal:60},
  overload_shot:   {name:'Overload Shot',   cd:20000, desc:'Triple damage next shot',      mult:3},
  phase_shift:     {name:'Phase Shift',     cd:25000, desc:'Invincible for 1.5s',          duration:1500},
  scan_pulse:      {name:'Scan Pulse',      cd:30000, desc:'Reveal all enemies 5s',        duration:5000},
  emp_blast:       {name:'EMP Blast',       cd:20000, desc:'Disable nearby enemies 2s',   radius:250,duration:2000},
  sky_launch:      {name:'Sky Launch',      cd:6000,  desc:'Speed burst for 1.5s',         mult:2.5,duration:1500},
  static_trap:     {name:'Static Trap',     cd:20000, desc:'Place 60 dmg electric trap',  dmg:60},
};

const SKINS = {
  default:{name:'Default', color:null,      price:0   },
  volt:   {name:'Volt',    color:'#e8c040', price:500 },
  shadow: {name:'Shadow',  color:'#9040c8', price:800 },
  neon:   {name:'Neon',    color:'#40ff80', price:600 },
  plasma: {name:'Plasma',  color:'#ff40c0', price:1000},
  ice:    {name:'Ice',     color:'#80d8ff', price:750 },
};

// ── Map features ──────────────────────────────────────────────────────────────
const JUMP_PADS = [
  {id:'jp0',x:320, y:900, tx:2080,ty:900, color:'#40c880'},
  {id:'jp1',x:2080,y:900, tx:320, ty:900, color:'#40c880'},
  {id:'jp2',x:1200,y:180, tx:1200,ty:1620,color:'#40c880'},
  {id:'jp3',x:1200,y:1620,tx:1200,ty:180, color:'#40c880'},
  {id:'jp4',x:600, y:400, tx:1800,ty:1400,color:'#40c880'},
  {id:'jp5',x:1800,y:400, tx:600, ty:1400,color:'#40c880'},
];

const TELEPORTERS = [
  {id:'tp0a',x:260, y:340, paired:'tp0b'},{id:'tp0b',x:2140,y:340, paired:'tp0a'},
  {id:'tp1a',x:260, y:1460,paired:'tp1b'},{id:'tp1b',x:2140,y:1460,paired:'tp1a'},
  {id:'tp2a',x:1200,y:600, paired:'tp2b'},{id:'tp2b',x:1200,y:1200,paired:'tp2a'},
];

const HAZARD_ZONES = [
  {id:'hz0',x:2100,y:160, r:120,dmg:8, interval:2000},
  {id:'hz1',x:2260,y:320, r:100,dmg:8, interval:2000},
];

const POI_ZONES = [
  {name:'Voltage City',     x:200,  y:200,  r:280},
  {name:'Zap Core Plant',   x:2200, y:200,  r:280},
  {name:'Neon District',    x:1200, y:250,  r:250},
  {name:'Storm Labs',       x:200,  y:900,  r:220},
  {name:'SkyGrid Towers',   x:1200, y:870,  r:280},
  {name:'Pulse Harbor',     x:2200, y:900,  r:220},
  {name:'Overcharge Arena', x:1760, y:870,  r:180},
  {name:'Static Hills',     x:700,  y:1400, r:260},
  {name:'Rift Zone',        x:1200, y:1650, r:180},
];

const WALLS = [
  {x:-60,y:-60,w:MAP_W+120,h:60},{x:-60,y:MAP_H,w:MAP_W+120,h:60},
  {x:-60,y:-60,w:60,h:MAP_H+120},{x:MAP_W,y:-60,w:60,h:MAP_H+120},
  {x:100, y:100, w:80, h:200},{x:220,y:100,w:80,h:140},{x:100,y:340,w:200,h:60},
  {x:2100,y:80,  w:100,h:160},{x:2220,y:80, w:80, h:80},{x:2100,y:260,w:200,h:50},
  {x:1000,y:200, w:120,h:80 },{x:1280,y:200,w:120,h:80},{x:1060,y:300,w:280,h:50},
  {x:180, y:680, w:220,h:50 },{x:180, y:730, w:50, h:160},
  {x:180, y:1070,w:220,h:50 },{x:180, y:910, w:50, h:160},
  {x:1100,y:820, w:200,h:120},
  {x:790, y:760, w:90, h:240},{x:1520,y:760,w:90,h:240},
  {x:1155,y:320, w:90, h:200},{x:1155,y:1240,w:90,h:200},
  {x:2000,y:680, w:220,h:50 },{x:2170,y:730,w:50,h:160},
  {x:2000,y:1070,w:220,h:50 },{x:2170,y:910,w:50,h:160},
  {x:1700,y:700, w:60, h:200},{x:1820,y:700,w:60,h:200},
  {x:380, y:1200,w:160,h:280},{x:1860,y:1200,w:160,h:280},
  {x:380, y:320, w:160,h:280},{x:1860,y:320, w:160,h:280},
];

const SPAWN_POINTS=[
  {x:120,y:120},{x:MAP_W-120,y:120},{x:120,y:MAP_H-120},{x:MAP_W-120,y:MAP_H-120},
  {x:MAP_W/2,y:120},{x:MAP_W/2,y:MAP_H-120},{x:120,y:MAP_H/2},{x:MAP_W-120,y:MAP_H/2},
];

const PICKUP_DEFS=[
  {x:620, y:600, type:'weapon',weapon:'volt_smg'     },{x:1780,y:600, type:'weapon',weapon:'arc_burst'    },
  {x:620, y:1200,type:'weapon',weapon:'rail_sniper'  },{x:1780,y:1200,type:'weapon',weapon:'storm_cannon' },
  {x:1200,y:900, type:'weapon',weapon:'static_dmr'   },{x:950, y:500, type:'weapon',weapon:'chain_launcher'},
  {x:1450,y:500, type:'weapon',weapon:'disruptor'    },{x:950, y:1300,type:'weapon',weapon:'energy_blade' },
  {x:1450,y:1300,type:'weapon',weapon:'beam_laser'   },
  {x:370, y:900, type:'health'},{x:2030,y:900, type:'health'},
  {x:1200,y:430, type:'shield'},{x:1200,y:1370,type:'shield'},
  {x:780, y:380, type:'health'},{x:1620,y:380, type:'health'},
  {x:780, y:1420,type:'health'},{x:1620,y:1420,type:'health'},
];

// ── Collision helpers ─────────────────────────────────────────────────────────
function circleHitsRect(cx,cy,cr,rx,ry,rw,rh){const nx=Math.max(rx,Math.min(cx,rx+rw)),ny=Math.max(ry,Math.min(cy,ry+rh)),dx=cx-nx,dy=cy-ny;return dx*dx+dy*dy<cr*cr;}
function resolveCircleRect(cx,cy,cr,rx,ry,rw,rh){const nx=Math.max(rx,Math.min(cx,rx+rw)),ny=Math.max(ry,Math.min(cy,ry+rh)),dx=cx-nx,dy=cy-ny,d=Math.sqrt(dx*dx+dy*dy);if(d===0){const dL=cx-rx,dR=rx+rw-cx,dT=cy-ry,dB=ry+rh-cy,m=Math.min(dL,dR,dT,dB);if(m===dL)return{x:rx-cr,y:cy};if(m===dR)return{x:rx+rw+cr,y:cy};if(m===dT)return{x:cx,y:ry-cr};return{x:cx,y:ry+rh+cr};}const p=cr-d;return{x:cx+(dx/d)*p,y:cy+(dy/d)*p};}
function ptInRect(px,py,rx,ry,rw,rh){return px>=rx&&px<=rx+rw&&py>=ry&&py<=ry+rh;}
function raycast(ox,oy,angle,maxD){const dx=Math.cos(angle),dy=Math.sin(angle),step=maxD/Math.ceil(maxD/8);for(let i=step;i<=maxD;i+=step){for(const w of WALLS)if(ptInRect(ox+dx*i,oy+dy*i,w.x,w.y,w.w,w.h))return i;}return maxD;}

// ── Bot AI ────────────────────────────────────────────────────────────────────
function makeBotPlayer(id, room) {
  const sp=room._bestSpawn();
  return {
    id,username:`Bot_${id.slice(-1)}`,isBot:true,
    x:sp.x,y:sp.y,angle:0,
    hp:100,shield:50,weapon:'pulse_rifle',heat:0,overheatedUntil:0,
    kills:0,deaths:0,alive:true,respawnAt:0,lastShot:0,
    color:PLAYER_COLORS[Math.floor(Math.random()*PLAYER_COLORS.length)],skin:'default',
    team:-1,
    ab:[{key:'dash_burst',cdUntil:0},{key:'energy_dome',cdUntil:0}],
    invincibleUntil:0,speedBoostUntil:0,speedBoostMult:1,domeUntil:0,overloadShot:false,empedUntil:0,
    prevX:sp.x,prevY:sp.y,
    _aiTimer:0,_roamTarget:null,_strafeToggle:false,
    input:{up:false,down:false,left:false,right:false,shooting:false,angle:0,ab0:false,ab1:false},
  };
}
function tickBot(bot, room, dt) {
  bot._aiTimer += dt;
  if (bot._aiTimer < 180) return; // 5~6 fps AI
  bot._aiTimer = 0;
  const inp = bot.input;
  const enemies = Object.values(room.players).filter(p=>p.alive&&p.id!==bot.id&&p.team!==bot.team);
  if (!enemies.length) {
    if (!bot._roamTarget||Math.hypot(bot.x-bot._roamTarget.x,bot.y-bot._roamTarget.y)<60)
      bot._roamTarget=SPAWN_POINTS[Math.floor(Math.random()*SPAWN_POINTS.length)];
    _botMoveTo(inp,bot,bot._roamTarget); inp.shooting=false; return;
  }
  const t=enemies.reduce((a,b)=>Math.hypot(a.x-bot.x,a.y-bot.y)<Math.hypot(b.x-bot.x,b.y-bot.y)?a:b);
  const dist=Math.hypot(t.x-bot.x,t.y-bot.y);
  const wep=WEAPONS[bot.weapon]||WEAPONS.pulse_rifle;
  inp.angle=Math.atan2(t.y-bot.y,t.x-bot.x)+(Math.random()-.5)*0.18;
  if (dist < 100) {
    bot._strafeToggle=!bot._strafeToggle;
    inp.up=bot._strafeToggle; inp.down=!bot._strafeToggle; inp.left=false; inp.right=false;
  } else {
    _botMoveTo(inp,bot,t);
  }
  inp.shooting = dist < (wep.range||600) && dist < 700;
}
function _botMoveTo(inp,bot,t){const dx=t.x-bot.x,dy=t.y-bot.y;inp.up=dy<-30;inp.down=dy>30;inp.left=dx<-30;inp.right=dx>30;}

// ── GameRoom ──────────────────────────────────────────────────────────────────
class GameRoom {
  constructor(id, mode='ffa', partyCode=null) {
    this.id=id; this.mode=mode; this.partyCode=partyCode;
    const cfg=MODES[mode]||MODES.ffa;
    this.cfg=cfg;
    this.players={}; this.bullets=[]; this.traps=[];
    this.pickups=PICKUP_DEFS.map((d,i)=>({...d,id:`pk${i}`,active:true,respawnAt:0}));
    this.teamScores=[0,0];
    this.state='lobby'; this.cdTimer=0; this.endTimer=0; this.ticks=0; this.colorIdx=0; this.winner=null;
    this._tpCooldown={}; // playerid → {tpId → untilMs}
    this._hazardTimers=Object.fromEntries(HAZARD_ZONES.map(h=>[h.id,0]));
    // Rift Zone
    this.riftActive=false; this.riftX=MAP_W/2; this.riftY=MAP_H/2;
    this.riftR=Math.max(MAP_W,MAP_H); this.riftPhase=0; this.riftTimer=0;
    this.riftPhases=[
      {r:900,shrinkMs:30000},{r:600,shrinkMs:25000},{r:300,shrinkMs:20000},{r:0,shrinkMs:15000}
    ];
    this._riftShrinking=false; this._riftStart=0; this._riftEnd=0; this._riftFrom=0;
  }

  addPlayer(socketId, username, dbData, teamHint=-1) {
    const cfg=this.cfg;
    let team=-1;
    if (cfg.teams===2) {
      const counts=[0,0];
      for(const p of Object.values(this.players)) if(p.team>=0) counts[p.team]++;
      team = teamHint>=0 ? teamHint : (counts[0]<=counts[1]?0:1);
    }
    const skinColor=SKINS[dbData.equipped_skin]?.color;
    const color=skinColor||(team>=0?TEAM_COLORS[team][this.colorIdx++%2]:PLAYER_COLORS[this.colorIdx++%PLAYER_COLORS.length]);
    const sp=this._bestSpawn(team);
    const wepKey=dbData.unlocked_weapons.includes(dbData.spawn_weapon)?dbData.spawn_weapon:'pulse_rifle';
    const p={
      id:socketId,username,isBot:false,
      x:sp.x,y:sp.y,angle:0,
      hp:100,shield:50,weapon:wepKey,heat:0,overheatedUntil:0,
      kills:0,deaths:0,alive:true,respawnAt:0,lastShot:0,
      color,skin:dbData.equipped_skin,team,
      ab:[{key:dbData.ability_1,cdUntil:0},{key:dbData.ability_2,cdUntil:0}],
      invincibleUntil:0,speedBoostUntil:0,speedBoostMult:1,domeUntil:0,overloadShot:false,empedUntil:0,
      prevX:sp.x,prevY:sp.y,
      input:{up:false,down:false,left:false,right:false,shooting:false,angle:0,ab0:false,ab1:false},
    };
    this.players[socketId]=p;
    return p;
  }

  removePlayer(id){delete this.players[id];}

  _bestSpawn(team=-1){
    let best=SPAWN_POINTS[0],bestD=0;
    for(const sp of SPAWN_POINTS){
      let minD=Infinity;
      for(const p of Object.values(this.players)){const dx=p.x-sp.x,dy=p.y-sp.y;minD=Math.min(minD,Math.sqrt(dx*dx+dy*dy));}
      if(minD>bestD){bestD=minD;best=sp;}
    }
    // Team-specific spawning
    if(team===0) return{x:Math.min(best.x,400)+(Math.random()-.5)*60,y:best.y+(Math.random()-.5)*60};
    if(team===1) return{x:Math.max(best.x,MAP_W-400)+(Math.random()-.5)*60,y:best.y+(Math.random()-.5)*60};
    return{x:best.x+(Math.random()-.5)*60,y:best.y+(Math.random()-.5)*60};
  }

  tick(dt){
    const cfg=this.cfg;
    if(this.state==='lobby'){
      const realPlayers=Object.values(this.players).filter(p=>!p.isBot).length;
      const needed=cfg.teams===2?2:cfg.mode==='practice'?1:2;
      if(realPlayers>=needed){
        // Add bots if practice mode
        for(let i=0;i<cfg.bots;i++){
          const bot=makeBotPlayer(`bot_${i}`,this);
          this.players[bot.id]=bot;
        }
        this.state='countdown';this.cdTimer=3000;
        io.to(this.id).emit('state_change',{state:'countdown',countdown:3});
      }
      return;
    }
    if(this.state==='countdown'){
      this.cdTimer-=dt;
      if(this.cdTimer<=0){
        this.state='playing';
        if(cfg.br){this.riftActive=true;this._startRiftPhase();}
        io.to(this.id).emit('state_change',{state:'playing'});
      }
      return;
    }
    if(this.state==='ended'){this.endTimer-=dt;if(this.endTimer<=0)this._reset();return;}

    const now=Date.now();

    // Bot AI ticks
    for(const p of Object.values(this.players)) if(p.isBot) tickBot(p,this,dt);

    // Rift Zone
    if(this.riftActive&&this.state==='playing') this._tickRift(dt,now);

    // Hazard zones (Zap Core Plant damage)
    for(const hz of HAZARD_ZONES){
      this._hazardTimers[hz.id]=(this._hazardTimers[hz.id]||0)+dt;
      if(this._hazardTimers[hz.id]>=hz.interval){
        this._hazardTimers[hz.id]=0;
        io.to(this.id).emit('hazard_pulse',{id:hz.id,x:hz.x,y:hz.y,r:hz.r});
        for(const p of Object.values(this.players)){
          if(!p.alive) continue;
          const d=Math.hypot(p.x-hz.x,p.y-hz.y);
          if(d<hz.r) this._damage(p,'environment',hz.dmg*(1-d/hz.r));
        }
      }
    }

    // Players
    for(const p of Object.values(this.players)){
      if(!p.alive){
        if(cfg.respawn&&now>=p.respawnAt){
          const sp=this._bestSpawn(p.team);
          Object.assign(p,{x:sp.x,y:sp.y,hp:100,shield:50,heat:0,overheatedUntil:0,alive:true,overloadShot:false});
          if(!p.isBot) io.to(p.id).emit('respawn',{x:p.x,y:p.y});
        }
        continue;
      }

      const inp=p.input;
      const speedMult=now<p.speedBoostUntil?p.speedBoostMult:1;
      let dx=(inp.right?1:0)-(inp.left?1:0),dy=(inp.down?1:0)-(inp.up?1:0);
      const mag=Math.sqrt(dx*dx+dy*dy);if(mag>0){dx/=mag;dy/=mag;}
      if(this.ticks%120===0){p.prevX=p.x;p.prevY=p.y;}
      let nx=p.x+dx*P_SPEED*speedMult*dt/1000,ny=p.y+dy*P_SPEED*speedMult*dt/1000;
      for(const w of WALLS){if(circleHitsRect(nx,ny,P_RADIUS,w.x,w.y,w.w,w.h)){const r=resolveCircleRect(nx,ny,P_RADIUS,w.x,w.y,w.w,w.h);nx=r.x;ny=r.y;}}
      p.x=Math.max(P_RADIUS,Math.min(MAP_W-P_RADIUS,nx));
      p.y=Math.max(P_RADIUS,Math.min(MAP_H-P_RADIUS,ny));
      p.angle=inp.angle;
      p.shield=Math.min(50,p.shield+6*dt/1000);
      if(now>=p.overheatedUntil) p.heat=Math.max(0,p.heat-(inp.shooting?18:35)*dt/1000);

      // Jump pads
      for(const jp of JUMP_PADS){
        if(Math.hypot(p.x-jp.x,p.y-jp.y)<(P_RADIUS+20)){
          p.x=jp.tx+(Math.random()-.5)*40;p.y=jp.ty+(Math.random()-.5)*40;
          io.to(this.id).emit('jump_pad',{pid:p.id,x:jp.tx,y:jp.ty,color:jp.color});
          break;
        }
      }

      // Teleporters
      if(!this._tpCooldown[p.id]) this._tpCooldown[p.id]={};
      for(const tp of TELEPORTERS){
        if(now<(this._tpCooldown[p.id][tp.id]||0)) continue;
        if(Math.hypot(p.x-tp.x,p.y-tp.y)<(P_RADIUS+18)){
          const dest=TELEPORTERS.find(t=>t.id===tp.paired);
          if(dest){
            p.x=dest.x+(Math.random()-.5)*30;p.y=dest.y+(Math.random()-.5)*30;
            this._tpCooldown[p.id][tp.id]=now+2000;
            this._tpCooldown[p.id][tp.paired]=now+2000;
            io.to(this.id).emit('teleport_used',{pid:p.id,x:p.x,y:p.y});
          }
          break;
        }
      }

      // Rift damage
      if(this.riftActive&&this.riftPhase<this.riftPhases.length){
        const d=Math.hypot(p.x-this.riftX,p.y-this.riftY);
        if(d>this.riftR) this._damage(p,'rift',12*dt/1000);
      }

      // Abilities
      for(let slot=0;slot<2;slot++){
        if(inp[`ab${slot}`]&&!inp[`_ab${slot}prev`]) this._useAbility(p,slot,now);
        inp[`_ab${slot}prev`]=inp[`ab${slot}`];
      }

      // Shooting
      const wep=WEAPONS[p.weapon];
      if(inp.shooting&&now-p.lastShot>=wep.rate&&now>=p.overheatedUntil&&now>=p.empedUntil){
        p.lastShot=now;
        p.heat=Math.min(100,p.heat+(wep.heat||0));
        if(p.heat>=100){p.overheatedUntil=now+2000;if(!p.isBot)io.to(p.id).emit('overheated');}
        const dm=p.overloadShot?(ABILITIES.overload_shot.mult||3):1; p.overloadShot=false;
        if(wep.melee){
          for(const t of Object.values(this.players)){
            if(!t.alive||t.id===p.id||(cfg.teams===2&&t.team===p.team)) continue;
            const ex=t.x-p.x,ey=t.y-p.y;
            if(Math.cos(p.angle)*ex+Math.sin(p.angle)*ey>0&&ex*ex+ey*ey<wep.range**2) this._damage(t,p.id,wep.dmg*dm);
          }
          io.to(this.id).emit('melee_swing',{pid:p.id,angle:p.angle,range:wep.range});
        } else if(wep.beam){
          const hd=raycast(p.x,p.y,p.angle,wep.range);
          const bx=p.x+Math.cos(p.angle)*hd,by=p.y+Math.sin(p.angle)*hd;
          for(const t of Object.values(this.players)){
            if(!t.alive||t.id===p.id||(cfg.teams===2&&t.team===p.team)) continue;
            const ex=t.x-p.x,ey=t.y-p.y,proj=ex*Math.cos(p.angle)+ey*Math.sin(p.angle);
            if(proj<0||proj>hd) continue;
            if(Math.abs(-ex*Math.sin(p.angle)+ey*Math.cos(p.angle))<P_RADIUS+4) this._damage(t,p.id,wep.dmg*dm);
          }
          io.to(this.id).emit('beam_fire',{pid:p.id,x1:p.x,y1:p.y,x2:bx,y2:by,color:wep.color});
        } else {
          for(let i=0;i<(wep.pellets||1);i++){
            const ang=p.angle+(Math.random()-.5)*wep.spread*2;
            this.bullets.push({id:uuidv4().slice(0,8),x:p.x+Math.cos(p.angle)*(P_RADIUS+2),y:p.y+Math.sin(p.angle)*(P_RADIUS+2),vx:Math.cos(ang)*wep.speed,vy:Math.sin(ang)*wep.speed,ownerId:p.id,ownerTeam:p.team,dmg:wep.dmg*dm,weapon:p.weapon,splash:wep.splash||0,bounces:wep.bounces||0,life:0,maxLife:p.weapon==='rail_sniper'?2600:1800});
          }
        }
      }
    }

    // Bullets
    const dead=new Set();
    for(const b of this.bullets){
      b.x+=b.vx*dt/1000;b.y+=b.vy*dt/1000;b.life+=dt;
      if(b.x<-10||b.x>MAP_W+10||b.y<-10||b.y>MAP_H+10||b.life>b.maxLife){dead.add(b.id);continue;}
      let wh=false;
      for(const w of WALLS){if(ptInRect(b.x,b.y,w.x,w.y,w.w,w.h)){if(b.bounces>0){b.bounces--;const ox=b.x-b.vx*dt/1000,oy=b.y-b.vy*dt/1000;if(ptInRect(ox,b.y,w.x,w.y,w.w,w.h))b.vy=-b.vy;else b.vx=-b.vx;wh=false;}else wh=true;break;}}
      if(wh){dead.add(b.id);continue;}
      const cfg=this.cfg;
      for(const p of Object.values(this.players)){
        if(!p.alive||p.id===b.ownerId||(cfg.teams===2&&p.team===b.ownerTeam)) continue;
        const dx=p.x-b.x,dy=p.y-b.y;
        if(dx*dx+dy*dy<(b.splash>0?b.splash:P_RADIUS+6)**2){
          if(b.splash>0){for(const t of Object.values(this.players)){if(!t.alive||(cfg.teams===2&&t.team===b.ownerTeam)) continue;const td=Math.hypot(t.x-b.x,t.y-b.y);if(td<b.splash)this._damage(t,b.ownerId,b.dmg*(1-td/b.splash));}io.to(this.id).emit('explosion',{x:b.x,y:b.y,r:b.splash});}
          else this._damage(p,b.ownerId,b.dmg);
          dead.add(b.id);break;
        }
      }
    }
    this.bullets=this.bullets.filter(b=>!dead.has(b.id));

    // Traps
    for(const t of this.traps){
      for(const p of Object.values(this.players)){
        if(!p.alive||p.id===t.ownerId||t.triggered) continue;
        if(Math.hypot(p.x-t.x,p.y-t.y)<(P_RADIUS+20)){t.triggered=true;this._damage(p,t.ownerId,t.dmg);io.to(this.id).emit('trap_trigger',{x:t.x,y:t.y});}
      }
    }
    this.traps=this.traps.filter(t=>!t.triggered&&Date.now()<t.expiresAt);

    // Pickups
    for(const pk of this.pickups){
      if(!pk.active){if(now>=pk.respawnAt)pk.active=true;continue;}
      for(const p of Object.values(this.players)){
        if(!p.alive) continue;
        if(Math.hypot(p.x-pk.x,p.y-pk.y)>(P_RADIUS+26)) continue;
        let picked=false;
        if(pk.type==='health'&&p.hp<100){p.hp=Math.min(100,p.hp+50);picked=true;}
        else if(pk.type==='shield'&&p.shield<50){p.shield=50;picked=true;}
        else if(pk.type==='weapon'){p.weapon=pk.weapon;p.heat=0;picked=true;}
        if(picked){pk.active=false;pk.respawnAt=now+(pk.type==='weapon'?15000:20000);if(!p.isBot)io.to(p.id).emit('pickup',{type:pk.type,weapon:pk.weapon||null});}
      }
    }

    this.ticks++;
    if(this.ticks%BCAST_EVERY===0) this._broadcast();
  }

  _tickRift(dt,now){
    if(!this._riftShrinking){
      // Start phase shrink
      if(this.riftPhase<this.riftPhases.length){
        const phase=this.riftPhases[this.riftPhase];
        this._riftShrinking=true;
        this._riftStart=this.riftR;
        this._riftEnd=phase.r;
        this._riftFrom=now;
        this._riftDuration=phase.shrinkMs;
        io.to(this.id).emit('rift_update',{x:this.riftX,y:this.riftY,r:this._riftEnd,shrinkMs:phase.shrinkMs});
      }
    } else {
      const elapsed=now-this._riftFrom;
      const t=Math.min(1,elapsed/this._riftDuration);
      this.riftR=this._riftStart+(this._riftEnd-this._riftStart)*t;
      if(t>=1){this.riftPhase++;this._riftShrinking=false;}
    }
  }

  _startRiftPhase(){
    const phase=this.riftPhases[0];
    this._riftShrinking=false;this.riftR=Math.max(MAP_W,MAP_H)*1.2;
    io.to(this.id).emit('rift_start',{x:this.riftX,y:this.riftY,initialR:this.riftR});
  }

  _useAbility(p,slot,now){
    const ab=p.ab[slot];if(!ab||now<ab.cdUntil) return;
    const def=ABILITIES[ab.key];if(!def) return;
    ab.cdUntil=now+def.cd;
    switch(ab.key){
      case 'dash_burst':{const inp=p.input;let dx=(inp.right?1:0)-(inp.left?1:0),dy=(inp.down?1:0)-(inp.up?1:0);const m=Math.sqrt(dx*dx+dy*dy)||1;p.x=Math.max(P_RADIUS,Math.min(MAP_W-P_RADIUS,p.x+dx/m*160));p.y=Math.max(P_RADIUS,Math.min(MAP_H-P_RADIUS,p.y+dy/m*160));io.to(this.id).emit('dash_effect',{pid:p.id,x:p.x,y:p.y,color:p.color});break;}
      case 'blink_step':{let tx=p.x+Math.cos(p.angle)*200,ty=p.y+Math.sin(p.angle)*200;if(!WALLS.some(w=>circleHitsRect(tx,ty,P_RADIUS,w.x,w.y,w.w,w.h))){p.x=tx;p.y=ty;}io.to(this.id).emit('dash_effect',{pid:p.id,x:p.x,y:p.y,color:p.color});break;}
      case 'chain_lightning':{const ts=Object.values(this.players).filter(t=>t.alive&&t.id!==p.id&&(this.cfg.teams!==2||t.team!==p.team)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y)).slice(0,3);for(const t of ts)this._damage(t,p.id,def.dmg||45);io.to(this.id).emit('chain_lightning',{pid:p.id,targets:ts.map(t=>({id:t.id,x:t.x,y:t.y}))});break;}
      case 'shockwave_slam':{for(const t of Object.values(this.players)){if(!t.alive||t.id===p.id||(this.cfg.teams===2&&t.team===p.team)) continue;const dx=t.x-p.x,dy=t.y-p.y,d=Math.sqrt(dx*dx+dy*dy);if(d<(def.radius||200)){this._damage(t,p.id,def.dmg||30);const push=200*(1-d/(def.radius||200));t.x=Math.max(P_RADIUS,Math.min(MAP_W-P_RADIUS,t.x+dx/d*push));t.y=Math.max(P_RADIUS,Math.min(MAP_H-P_RADIUS,t.y+dy/d*push));}}io.to(this.id).emit('shockwave',{x:p.x,y:p.y,r:def.radius||200});break;}
      case 'energy_dome': p.domeUntil=now+(def.duration||2500);io.to(this.id).emit('dome_on',{pid:p.id});break;
      case 'heal_surge':  p.hp=Math.min(100,p.hp+(def.heal||60));if(!p.isBot)io.to(p.id).emit('healed',{hp:p.hp});break;
      case 'overload_shot':p.overloadShot=true;if(!p.isBot)io.to(p.id).emit('overload_ready');break;
      case 'phase_shift': p.invincibleUntil=now+(def.duration||1500);io.to(this.id).emit('phase_on',{pid:p.id});break;
      case 'sky_launch':  p.speedBoostUntil=now+(def.duration||1500);p.speedBoostMult=def.mult||2.5;break;
      case 'emp_blast':{for(const t of Object.values(this.players)){if(!t.alive||t.id===p.id||(this.cfg.teams===2&&t.team===p.team)) continue;if(Math.hypot(t.x-p.x,t.y-p.y)<(def.radius||250)){t.empedUntil=now+(def.duration||2000);if(!t.isBot)io.to(t.id).emit('emped',{duration:def.duration||2000});}}io.to(this.id).emit('emp',{x:p.x,y:p.y,r:def.radius||250});break;}
      case 'static_trap': this.traps.push({x:p.x,y:p.y,ownerId:p.id,dmg:def.dmg||60,triggered:false,expiresAt:now+30000,id:uuidv4().slice(0,6)});io.to(this.id).emit('trap_placed',{x:p.x,y:p.y,ownerId:p.id,color:p.color});break;
    }
    if(!p.isBot) io.to(p.id).emit('ability_used',{slot,cdMs:def.cd,key:ab.key});
  }

  _damage(target,attackerId,rawDmg){
    if(!target.alive) return;
    const now=Date.now();
    if(now<target.invincibleUntil) return;
    const dmg=Math.max(1,rawDmg);
    if(now<target.domeUntil){io.to(this.id).emit('dome_block',{pid:target.id});return;}
    const shAbs=Math.min(target.shield,dmg*0.65);
    target.shield-=shAbs;target.hp-=dmg-shAbs;
    if(target.hp<=0){
      target.hp=0;target.alive=false;target.deaths++;
      target.respawnAt=Date.now()+RESPAWN_MS;
      if(!target.isBot) io.to(target.id).emit('died',{by:this.players[attackerId]?.username||'?',respawnIn:RESPAWN_MS});
      const atk=this.players[attackerId];
      if(atk&&!atk.isBot){
        atk.kills++;
        if(this.cfg.teams===2) this.teamScores[atk.team]=(this.teamScores[atk.team]||0)+1;
        io.to(this.id).emit('kill_feed',{killer:atk.username,victim:target.username,weapon:atk.weapon,kColor:atk.color,kTeam:atk.team,vTeam:target.team});
        const winKills=this.cfg.teams===2?this.teamScores[atk.team]:atk.kills;
        const killTarget=this.cfg.kills;
        if(killTarget>0&&winKills>=killTarget){
          this.state='ended';this.endTimer=12000;
          this.winner=this.cfg.teams===2?`Team ${atk.team===0?'Blue':'Red'}`:atk.username;
          io.to(this.id).emit('game_over',{winner:this.winner,scores:this._scores(),teamScores:this.teamScores});
          for(const pl of Object.values(this.players)){if(!pl.isBot)db.saveGameStats(pl.username,pl.kills,pl.deaths,pl.username===atk.username||(this.cfg.teams===2&&pl.team===atk.team)).catch(console.error);}
        }
      }
      // BR: check last alive
      if(this.cfg.br){
        const alive=Object.values(this.players).filter(p=>p.alive);
        if(alive.length<=1){
          const last=alive[0];
          this.state='ended';this.endTimer=12000;this.winner=last?.username||'Unknown';
          io.to(this.id).emit('game_over',{winner:this.winner,scores:this._scores()});
          if(last&&!last.isBot) db.saveGameStats(last.username,last.kills,last.deaths,true).catch(console.error);
        }
      }
    } else {
      if(!target.isBot) io.to(target.id).emit('damaged',{hp:target.hp,shield:target.shield});
    }
  }

  _scores(){return Object.values(this.players).filter(p=>!p.isBot).map(p=>({username:p.username,kills:p.kills,deaths:p.deaths,color:p.color,team:p.team})).sort((a,b)=>b.kills-a.kills);}

  _reset(){
    for(const p of Object.values(this.players)){
      if(p.isBot){delete this.players[p.id];continue;}
      const sp=this._bestSpawn(p.team);
      Object.assign(p,{x:sp.x,y:sp.y,hp:100,shield:50,heat:0,overheatedUntil:0,kills:0,deaths:0,alive:true,overloadShot:false});
    }
    this.bullets=[];this.traps=[];this.teamScores=[0,0];
    this.pickups=PICKUP_DEFS.map((d,i)=>({...d,id:`pk${i}`,active:true,respawnAt:0}));
    this.winner=null;this.state='lobby';this.riftActive=false;this.riftPhase=0;this.riftR=Math.max(MAP_W,MAP_H);
    io.to(this.id).emit('state_change',{state:'lobby'});
  }

  _broadcast(){
    const now=Date.now();
    io.to(this.id).emit('game_state',{
      players:Object.values(this.players).map(p=>({id:p.id,username:p.username,x:p.x,y:p.y,angle:p.angle,hp:p.hp,shield:p.shield,weapon:p.weapon,heat:p.heat,alive:p.alive,kills:p.kills,deaths:p.deaths,color:p.color,team:p.team,domed:now<p.domeUntil,invincible:now<p.invincibleUntil,ab:[p.ab[0]?{key:p.ab[0].key,cdLeft:Math.max(0,p.ab[0].cdUntil-now)}:null,p.ab[1]?{key:p.ab[1].key,cdLeft:Math.max(0,p.ab[1].cdUntil-now)}:null]})),
      bullets:this.bullets.map(b=>({id:b.id,x:b.x,y:b.y,weapon:b.weapon})),
      pickups:this.pickups.map(p=>({id:p.id,x:p.x,y:p.y,type:p.type,weapon:p.weapon||null,active:p.active})),
      traps:this.traps.map(t=>({x:t.x,y:t.y,color:this.players[t.ownerId]?.color||'#fff'})),
      teamScores:this.teamScores,
      rift:this.riftActive?{x:this.riftX,y:this.riftY,r:this.riftR}:null,
    });
  }
}

// ── Room & Party management ───────────────────────────────────────────────────
const rooms={}, parties={};
const onlineUsers=new Map(); // username → socketId

function findOrCreateRoom(mode='ffa', partyCode=null){
  // Party gets dedicated room
  if(partyCode&&parties[partyCode]){
    const existing=Object.values(rooms).find(r=>r.partyCode===partyCode&&r.state==='lobby');
    if(existing) return existing;
    const id=uuidv4().slice(0,6).toUpperCase();
    rooms[id]=new GameRoom(id,mode,partyCode); return rooms[id];
  }
  const cfg=MODES[mode]||MODES.ffa;
  for(const r of Object.values(rooms)){
    if(r.mode===mode&&r.state==='lobby'&&!r.partyCode&&Object.keys(r.players).length<cfg.maxP) return r;
  }
  const id=uuidv4().slice(0,6).toUpperCase();
  rooms[id]=new GameRoom(id,mode); return rooms[id];
}

let last=Date.now();
setInterval(()=>{
  const now=Date.now(),dt=now-last;last=now;
  for(const[id,room]of Object.entries(rooms)){
    const real=Object.values(room.players).filter(p=>!p.isBot).length;
    if(real===0){delete rooms[id];continue;}
    room.tick(dt);
  }
},TICK_MS);

// ── Socket.IO ─────────────────────────────────────────────────────────────────
io.on('connection',socket=>{
  let myRoom=null,myUsername=null,myParty=null;

  socket.on('join',async({username,mode='ffa',partyCode=null})=>{
    if(!username||typeof username!=='string') return;
    username=username.trim().slice(0,20).replace(/[^a-zA-Z0-9_ ]/g,'')||'Player';
    myUsername=username;

    let dbData,settings;
    try{
      dbData=await db.getOrCreatePlayer(username);
      settings=await db.getSettings(username);
    }catch(e){
      console.error('[DB]',e.message);
      dbData={unlocked_weapons:['pulse_rifle','shock_blaster'],unlocked_skins:['default'],equipped_skin:'default',ability_1:'dash_burst',ability_2:'energy_dome',spawn_weapon:'pulse_rifle',total_kills:0,total_deaths:0,wins:0,coins:500};
      settings={sensitivity:1.0,sfx_vol:0.8,crosshair:'dynamic',show_fps:false,show_dmg_nums:true};
    }

    // Validate mode; use party mode if in a party
    if(partyCode&&parties[partyCode]){
      myParty=partyCode;
      mode=parties[partyCode].mode||mode;
    }
    if(!MODES[mode]) mode='ffa';

    myRoom=findOrCreateRoom(mode,partyCode||null);
    socket.join(myRoom.id);
    const player=myRoom.addPlayer(socket.id,username,dbData);

    // Track online
    onlineUsers.set(username,socket.id);
    // Notify friends
    try{
      const friends=await db.getFriends(username);
      for(const f of friends){
        const fSock=onlineUsers.get(f.username);
        if(fSock) io.to(fSock).emit('friend_online',{username,online:true});
      }
    }catch(e){}

    socket.emit('joined',{
      playerId:socket.id,roomId:myRoom.id,
      player:{id:player.id,username:player.username,x:player.x,y:player.y,color:player.color,hp:player.hp,shield:player.shield,weapon:player.weapon,heat:player.heat||0,kills:player.kills,deaths:player.deaths,alive:player.alive,team:player.team,ab:player.ab.map(a=>({key:a.key,cdLeft:0}))},
      walls:WALLS,mapW:MAP_W,mapH:MAP_H,killsToWin:MODES[mode].kills,playerRadius:P_RADIUS,
      weapons:WEAPONS,abilities:ABILITIES,skins:SKINS,
      mapFeatures:{jumpPads:JUMP_PADS,teleporters:TELEPORTERS,hazardZones:HAZARD_ZONES,poiZones:POI_ZONES},
      mode,modes:MODES,
      dbData:{coins:dbData.coins,total_kills:dbData.total_kills,total_deaths:dbData.total_deaths,wins:dbData.wins,unlocked_weapons:dbData.unlocked_weapons,unlocked_skins:dbData.unlocked_skins},
      settings,
    });
    io.to(myRoom.id).emit('player_joined',{username,color:player.color});
    console.log(`[${myRoom.id}|${mode}] ${username} joined (${Object.keys(myRoom.players).length}p)`);
  });

  socket.on('input',inp=>{if(myRoom){const p=myRoom.players[socket.id];if(p)p.input=inp;}});

  // Shop
  socket.on('buy_weapon',async({weaponKey})=>{const wep=WEAPONS[weaponKey];if(!wep||!myUsername)return;try{const r=await db.purchaseItem(myUsername,weaponKey,wep.price,true);socket.emit('purchase_result',{...r,itemKey:weaponKey,isWeapon:true});}catch(e){socket.emit('purchase_result',{success:false,reason:'Server error'});}});
  socket.on('buy_skin',async({skinKey})=>{const s=SKINS[skinKey];if(!s||!myUsername)return;try{const r=await db.purchaseItem(myUsername,skinKey,s.price,false);socket.emit('purchase_result',{...r,itemKey:skinKey,isWeapon:false});}catch(e){socket.emit('purchase_result',{success:false,reason:'Server error'});}});
  socket.on('equip_skin',async({skinKey})=>{if(!myUsername)return;try{await db.equipSkin(myUsername,skinKey);if(myRoom){const p=myRoom.players[socket.id];if(p){p.skin=skinKey;p.color=SKINS[skinKey]?.color||p.color;}}socket.emit('equip_result',{success:true});}catch(e){}});
  socket.on('save_loadout',async({ab1,ab2,spawnWeapon,unlockedWeapons})=>{if(!myUsername)return;try{await db.saveLoadout(myUsername,ab1,ab2,spawnWeapon,unlockedWeapons||[]);}catch(e){}});

  // Settings
  socket.on('save_settings',async(s)=>{if(!myUsername)return;try{await db.saveSettings(myUsername,s);socket.emit('settings_saved');}catch(e){}});

  // Friends
  socket.on('get_friends',async()=>{if(!myUsername)return;try{const friends=await db.getFriends(myUsername);const enriched=friends.map(f=>({...f,online:onlineUsers.has(f.username)}));socket.emit('friends_list',enriched);}catch(e){}});
  socket.on('add_friend',async({target})=>{if(!myUsername)return;try{const r=await db.sendFriendRequest(myUsername,target);socket.emit('friend_result',r);if(r.success){const tSock=onlineUsers.get(target);if(tSock)io.to(tSock).emit('friend_request',{from:myUsername});}}catch(e){socket.emit('friend_result',{success:false,reason:'Error'});}});
  socket.on('respond_friend',async({from,accept})=>{if(!myUsername)return;try{await db.respondFriendRequest(myUsername,from,accept);socket.emit('friend_respond_ok',{from,accept});}catch(e){}});
  socket.on('remove_friend',async({friend})=>{if(!myUsername)return;try{await db.removeFriend(myUsername,friend);}catch(e){}});

  // Parties
  socket.on('create_party',({mode='ffa'})=>{
    const code=uuidv4().slice(0,6).toUpperCase();
    parties[code]={code,leader:myUsername,mode,members:[{username:myUsername,socketId:socket.id}]};
    myParty=code;
    socket.emit('party_created',{code,mode,members:[{username:myUsername}]});
  });
  socket.on('join_party',({code})=>{
    const party=parties[code];
    if(!party){socket.emit('party_error',{reason:'Party not found'});return;}
    if(party.members.some(m=>m.username===myUsername)){socket.emit('party_error',{reason:'Already in party'});return;}
    party.members.push({username:myUsername,socketId:socket.id});
    myParty=code;
    // Notify all party members
    for(const m of party.members) io.to(m.socketId).emit('party_update',{code,leader:party.leader,mode:party.mode,members:party.members.map(m=>({username:m.username}))});
  });
  socket.on('leave_party',()=>{
    if(!myParty||!parties[myParty]) return;
    const party=parties[myParty];
    party.members=party.members.filter(m=>m.socketId!==socket.id);
    if(party.members.length===0){delete parties[myParty];}
    else{if(party.leader===myUsername)party.leader=party.members[0].username;for(const m of party.members)io.to(m.socketId).emit('party_update',{code:myParty,leader:party.leader,mode:party.mode,members:party.members.map(m=>({username:m.username}))});}
    myParty=null;socket.emit('party_left');
  });
  socket.on('set_party_mode',({mode})=>{
    if(!myParty||!parties[myParty]||parties[myParty].leader!==myUsername) return;
    if(!MODES[mode]) return;
    parties[myParty].mode=mode;
    for(const m of parties[myParty].members) io.to(m.socketId).emit('party_update',{code:myParty,leader:parties[myParty].leader,mode,members:parties[myParty].members.map(m=>({username:m.username}))});
  });
  socket.on('invite_friend',({friend})=>{
    if(!myUsername||!myParty) return;
    const fSock=onlineUsers.get(friend);
    if(fSock) io.to(fSock).emit('party_invite',{from:myUsername,code:myParty,mode:parties[myParty]?.mode||'ffa'});
  });

  socket.on('disconnect',()=>{
    if(myUsername) onlineUsers.delete(myUsername);
    // Notify friends offline
    db.getFriends(myUsername||'').then(friends=>{for(const f of friends){const fs=onlineUsers.get(f.username);if(fs)io.to(fs).emit('friend_online',{username:myUsername,online:false});}}).catch(()=>{});
    if(myRoom){
      const p=myRoom.players[socket.id];
      if(p){io.to(myRoom.id).emit('player_left',{username:p.username});myRoom.removePlayer(socket.id);if(myRoom.state==='playing'&&Object.values(myRoom.players).filter(p=>!p.isBot).length<1){myRoom.state='lobby';io.to(myRoom.id).emit('state_change',{state:'lobby'});}}
    }
    if(myParty&&parties[myParty]){
      const party=parties[myParty];
      party.members=party.members.filter(m=>m.socketId!==socket.id);
      if(party.members.length===0)delete parties[myParty];
    }
  });
});

db.initDB()
  .then(()=>server.listen(PORT,()=>console.log(`ZapZone on http://localhost:${PORT}`)))
  .catch(e=>{console.error('[DB]',e.message);server.listen(PORT,()=>console.log(`ZapZone (no DB) on :${PORT}`));});
