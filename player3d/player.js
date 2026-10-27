/* VERTFORM 3D player model.
make(THREE, scene, color, label, opts) returns a THREE.Group ({armL, armR, body, kit, rig, setLook} in userData).
Models labelled "YOU" wear the look set with setMyLook(); others wear the plain base model.
A look is an object of small whole numbers (see LIMITS), validated again on the server.
The page sends a look with {type:"vf3d:look"} messages; ?look=<base64 json> also works. */
(function(){
'use strict';
const SKIN=[0xf5d3b8,0xe8b894,0xd9a27c,0xb97a57,0x8d5a3b,0x5e3a26];
const HAIR_COLOR=[0x14110f,0x3a2518,0x7a4b25,0xc9a45c,0xb2432b,0x8a8a8a,0xe8e2d0,0x2f5fd1];
const KIT_COLOR=[0x10131f,0xf2f4f8,0x1f3a8a,0xd23a3a,0xf07a2a,0xf4c542,0x2f9e5b,0x1aa6a6,0x8b5cf6,0xe86fa8];
const HAIR_NAMES=['Bald','Buzz','Short','Long','Ponytail','Bun','Afro','Mohawk','Curly top','High top','Spiky'];
const BUILD=[.94,1,1.1],HEIGHT=[.96,1,1.05];
const LIMITS={skin:6,hair:HAIR_NAMES.length,hairColor:8,shorts:10,shoes:10,build:3,height:3,kit:10,
trim:11,beard:4,headband:11,sleeve:4,sleeveColor:3,pads:4,socks:3,sockColor:3,wrist:3};
const DEFAULT={skin:2,hair:2,hairColor:0,shorts:0,shoes:1,number:10,build:1,height:1,kit:2,
trim:0,beard:0,headband:0,sleeve:0,sleeveColor:0,pads:0,socks:1,sockColor:0,wrist:0};

function clean(l){
const o=Object.assign({},DEFAULT);
if(l&&typeof l==='object')Object.keys(LIMITS).forEach(k=>{const v=Math.floor(Number(l[k]));if(v>=0&&v<LIMITS[k])o[k]=v});
if(l&&Number.isFinite(Number(l.number))){const n=Math.floor(Number(l.number));if(n>=0&&n<=99)o.number=n}
return o;
}
const npcLook=()=>clean({hair:0});

function numberTexture(THREE,n){
const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
x.font='800 92px "Arial Narrow",Impact,sans-serif';x.textAlign='center';x.textBaseline='middle';
x.lineWidth=8;x.strokeStyle='rgba(0,0,0,.45)';x.strokeText(String(n),64,70);x.fillStyle='#fff';x.fillText(String(n),64,70);
return new THREE.CanvasTexture(c);
}

const mine=[];let myLook=null;

function make(THREE,scene,color,label,opts){
opts=opts||{};
const ghost=!!opts.ghost,isYou=label==='YOU',fade=typeof opts.fade==='number'?opts.fade:null;
const op=ghost?.32:(fade!==null?fade:1),tr=ghost||fade!==null;
const mat=(c,r)=>new THREE.MeshStandardMaterial({color:ghost?0xffffff:c,roughness:r,transparent:tr,opacity:op,depthWrite:fade===null});
const g=new THREE.Group(),rig=new THREE.Group();g.add(rig);
const kit=mat(color,.5),skin=mat(SKIN[2],.7),shorts=mat(0x10131f,.8),shoes=mat(0xf2f4f8,.7),hairM=mat(0x14110f,.85);
const trimM=mat(0xffffff,.5),bandM=mat(0xffffff,.6),sleeveM=mat(0x10131f,.6),padM=mat(0x10131f,.8),sockM=mat(0xf2f4f8,.8),wristM=mat(0xffffff,.7);
const stubM=new THREE.MeshStandardMaterial({color:0x14110f,roughness:.9,transparent:true,opacity:ghost?.1:.28,depthWrite:false});
const mesh=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x||0,y||0,z||0);return o};
const T=(o,r)=>{o.userData.region=r;return o};
const parts={};const keep=(k,o)=>{(parts[k]=parts[k]||[]).push(o);return o};

// legs, socks, knee pads, shoes
[-.1,.1].forEach(sx=>{
rig.add(T(mesh(new THREE.CylinderGeometry(.075,.065,.5,10),skin,sx,.27,0),'legs'));
rig.add(mesh(new THREE.BoxGeometry(.13,.07,.24),shoes,sx,.035,.04));
[[.07,.105],[.16,.15],[.3,.22]].forEach(([h,y],i)=>keep('sock'+i,rig.add(mesh(new THREE.CylinderGeometry(.079,.077,h,10),sockM,sx,y,0))&&rig.children[rig.children.length-1]));
keep('pad',rig.add(mesh(new THREE.CylinderGeometry(.088,.086,.11,12),padM,sx,.34,.012))&&rig.children[rig.children.length-1]);
});
rig.add(T(mesh(new THREE.CylinderGeometry(.215,.21,.3,14),shorts,0,.7,0),'legs'));
[-.212,.212].forEach(x=>keep('trim',rig.add(mesh(new THREE.BoxGeometry(.02,.3,.07),trimM,x,.7,0))&&rig.children[rig.children.length-1]));
rig.add(mesh(new THREE.CylinderGeometry(.06,.07,.14,10),skin,0,1.55,0));
// torso and collar
const body=T(mesh(new THREE.CylinderGeometry(.27,.22,.75,14),kit,0,1.15,0),'torso');rig.add(body);
const collar=mesh(new THREE.TorusGeometry(.13,.022,8,20),trimM,0,1.515,0);collar.rotation.x=Math.PI/2;rig.add(keep('trim',collar));
// head, eyes, hair, face
const head=mesh(new THREE.SphereGeometry(.17,16,12),skin,0,1.68,0);rig.add(head);
const eyeM=new THREE.MeshBasicMaterial({color:0x10131f,transparent:tr,opacity:op});
[-.06,.06].forEach(ex=>head.add(mesh(new THREE.SphereGeometry(.018,8,6),eyeM,ex,.02,.158)));
const hairG=new THREE.Group(),faceG=new THREE.Group();head.add(hairG,faceG);
const band=mesh(new THREE.TorusGeometry(.172,.024,8,28),bandM,0,.075,0);band.rotation.x=Math.PI/2;head.add(keep('band',band));
// arms: skin, shirt sleeve, trim cuff, compression sleeve, wristband
const mkArm=sx=>{
const a=new THREE.Group();
a.add(T(mesh(new THREE.BoxGeometry(.09,.62,.09),skin,0,0,0),'arms'));
a.add(T(mesh(new THREE.BoxGeometry(.105,.2,.105),kit,0,.21,0),'shoulders'));
a.add(keep('trim',mesh(new THREE.BoxGeometry(.112,.03,.112),trimM,0,.115,0)));
a.add(keep(sx<0?'sleeveL':'sleeveR',mesh(new THREE.BoxGeometry(.1,.36,.1),sleeveM,0,-.1,0)));
a.add(keep(sx<0?'wristL':'wristR',mesh(new THREE.BoxGeometry(.104,.06,.104),wristM,0,-.25,0)));
a.children.forEach(o=>{if(!o.userData.region)o.userData.region='arms'});a.position.set(sx,1.05,.18);a.rotation.x=-.9;return a;
};
const armL=mkArm(-.2),armR=mkArm(.2);rig.add(armL,armR);
// back number
const numMat=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,opacity:op});
const num=new THREE.Mesh(new THREE.PlaneGeometry(.26,.26),numMat);num.position.set(0,1.2,-.262);num.rotation.y=Math.PI;num.visible=false;rig.add(num);
rig.children.forEach(o=>{if(o.isMesh&&!o.userData.region&&o.position.y<.6)o.userData.region='legs'});
g.userData={armL,armR,body,kit,rig,isYou};

const disp=grp=>{while(grp.children.length){const c=grp.children[0];grp.remove(c);c.traverse(o=>o.geometry&&o.geometry.dispose())}};
const TOP=Math.PI*.42; // hair above the eyes all round, longer at the back, so the face stays visible
function cap(r,t){
const top=mesh(new THREE.SphereGeometry(r,16,10,0,Math.PI*2,0,Math.min(t,TOP)),hairM,0,.005,0);
if(t<=TOP)return [top];
return [top,mesh(new THREE.SphereGeometry(r,16,10,Math.PI,Math.PI,TOP,t-TOP),hairM,0,.005,0)];
}
function buildHair(style){
disp(hairG);const add=o=>Array.isArray(o)?o.forEach(x=>hairG.add(x)):hairG.add(o);
if(style===0)return;
if(style===1)add(cap(.176,TOP));
else if(style===2)add(cap(.183,Math.PI*.55));
else if(style===3){add(cap(.186,Math.PI*.6));add(mesh(new THREE.BoxGeometry(.3,.34,.1),hairM,0,-.12,-.13))}
else if(style===4){add(cap(.184,Math.PI*.55));add(mesh(new THREE.CylinderGeometry(.045,.025,.3,8),hairM,0,-.1,-.2))}
else if(style===5){add(cap(.184,Math.PI*.55));add(mesh(new THREE.SphereGeometry(.085,10,8),hairM,0,.2,-.02))}
else if(style===6){add(mesh(new THREE.SphereGeometry(.245,16,10,0,Math.PI*2,0,Math.PI*.36),hairM,0,.045,-.03));add(mesh(new THREE.SphereGeometry(.245,16,10,Math.PI,Math.PI,Math.PI*.36,Math.PI*.3),hairM,0,.045,-.03))}
else if(style===7){add(cap(.174,Math.PI*.3));add(mesh(new THREE.BoxGeometry(.06,.1,.32),hairM,0,.17,-.01))}
else if(style===8){add(cap(.178,TOP));[[0,.17,.02],[.08,.15,.05],[-.08,.15,.05],[.06,.15,-.08],[-.06,.15,-.08],[0,.13,.11],[0,.15,-.12]].forEach(([x,y,z])=>add(mesh(new THREE.SphereGeometry(.068,10,8),hairM,x,y,z)))}
else if(style===9){add(cap(.178,TOP));add(mesh(new THREE.CylinderGeometry(.15,.16,.17,16),hairM,0,.19,-.01))}
else if(style===10){add(cap(.178,TOP));for(let i=0;i<7;i++){const a=i/7*Math.PI*2,c=mesh(new THREE.ConeGeometry(.045,.13,6),hairM,Math.sin(a)*.09,.17,Math.cos(a)*.09-.01);c.rotation.set(Math.cos(a)*.5,0,-Math.sin(a)*.5);add(c)}add(mesh(new THREE.ConeGeometry(.05,.15,6),hairM,0,.22,0))}
if(!ghost&&fade===null)hairG.traverse(o=>{if(o.isMesh)o.castShadow=true});
}
function buildFace(b){
disp(faceG);
const front=(r,t0,t1,m)=>mesh(new THREE.SphereGeometry(r,16,8,0,Math.PI,t0,t1-t0),m,0,0,0);
if(b===1)faceG.add(front(.1735,Math.PI*.55,Math.PI*.92,stubM));
else if(b===2)faceG.add(mesh(new THREE.BoxGeometry(.1,.024,.03),hairM,0,-.045,.158));
else if(b===3){faceG.add(front(.177,Math.PI*.63,Math.PI*.93,hairM));faceG.add(mesh(new THREE.BoxGeometry(.1,.024,.03),hairM,0,-.045,.162))}
}
const KC=i=>KIT_COLOR[Math.max(0,Math.min(KIT_COLOR.length-1,i))];
const show=(k,on)=>(parts[k]||[]).forEach(o=>o.visible=!!on);
function setLook(l){
const k=clean(l);g.userData.look=k;
if(!ghost){
skin.color.setHex(SKIN[k.skin]);hairM.color.setHex(HAIR_COLOR[k.hairColor]);stubM.color.setHex(HAIR_COLOR[k.hairColor]);
shorts.color.setHex(KC(k.shorts));shoes.color.setHex(KC(k.shoes));
if(isYou)kit.color.setHex(KC(k.kit));
const shirt=kit.color.getHex();
trimM.color.setHex(k.trim?KC(k.trim-1):shirt);bandM.color.setHex(k.headband?KC(k.headband-1):0xffffff);
sleeveM.color.setHex([0x10131f,0xf2f4f8,shirt][k.sleeveColor]);padM.color.setHex([0,0x10131f,0xf2f4f8,shirt][k.pads]||0x10131f);
sockM.color.setHex([0xf2f4f8,0x10131f,shirt][k.sockColor]);wristM.color.setHex(k.trim?KC(k.trim-1):0xf2f4f8);
}
show('trim',k.trim>0);show('band',k.headband>0);show('pad',k.pads>0);
[0,1,2].forEach(i=>show('sock'+i,k.socks===i));
show('sleeveL',k.sleeve===1||k.sleeve===3);show('sleeveR',k.sleeve===2||k.sleeve===3);
show('wristR',k.wrist>=1);show('wristL',k.wrist===2);
buildHair(k.hair);buildFace(k.beard);
rig.scale.set(BUILD[k.build],HEIGHT[k.height],BUILD[k.build]);
if(isYou&&!ghost){if(numMat.map)numMat.map.dispose();numMat.map=numberTexture(THREE,k.number);numMat.needsUpdate=true;num.visible=true}
}
g.userData.setLook=setLook;
if(!ghost&&fade===null)g.traverse(o=>{if(o.isMesh)o.castShadow=true});
if(isYou&&!ghost){mine.push(g);setLook(myLook||DEFAULT)}else setLook(ghost?DEFAULT:npcLook());
scene&&scene.add(g);
return g;
}

function setMyLook(l){if(!l||typeof l!=='object')return;myLook=clean(l);mine.forEach(g=>g.userData.setLook(myLook))}
window.addEventListener('message',e=>{
if(e.origin!==location.origin)return;const m=e.data||{};
if(m.type==='vf3d:look')setMyLook(Object.assign({},m.look,Number.isInteger(m.kit)?{kit:m.kit}:{}));
});
try{const q=new URLSearchParams(location.search).get('look');if(q)setMyLook(JSON.parse(atob(q.replace(/-/g,'+').replace(/_/g,'/'))))}catch(_){}

window.VF3D_PLAYER={make,clean,setMyLook,mine,DEFAULT,SKIN,HAIR_COLOR,KIT_COLOR,HAIR_NAMES,LIMITS};
})();
