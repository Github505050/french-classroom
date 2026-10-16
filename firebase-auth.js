import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const gate=document.getElementById('auth-gate'),form=document.getElementById('gate-form'),message=document.getElementById('gate-message');
const trigger=document.getElementById('account-trigger'),modal=document.getElementById('account-modal'),body=document.getElementById('account-body');
const STORAGE_USER='classroom_active_uid',BACKUP_PREFIX='classroom_backup_',LOCAL_GUEST='classroom_guest_backup';
const PREFIX=/^frenchportal_v[12]_/;
let user=null,role='student',cloudEnabled=false,writeTimer=null,session=0,students=[],listMessage='Loading students…';
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const friendly=e=>({'auth/invalid-credential':'Email or password is incorrect.','auth/invalid-email':'Enter a valid email address.','auth/too-many-requests':'Too many attempts. Try again later.','auth/operation-not-allowed':'Enable email/password in Firebase Console.','auth/unauthorized-domain':'Add github505050.github.io to Firebase authorized domains.','permission-denied':'Firestore permission denied. Check the published rules.'}[e?.code]||e?.message||'Something went wrong.');
const status=s=>{const e=document.getElementById('account-status');if(e)e.textContent=s};
function entries(){const e={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(PREFIX.test(k))e[k]=localStorage.getItem(k)}return e}
function clearEntries(){for(const k of Object.keys(entries()))localStorage.removeItem(k)}
function restoreEntries(e){clearEntries();for(const [k,v] of Object.entries(e||{}))if(PREFIX.test(k)&&typeof v==='string')localStorage.setItem(k,v)}
function migrateLocal(uid){const old=localStorage.getItem(STORAGE_USER);if(old===uid)return;
 if(old)localStorage.setItem(BACKUP_PREFIX+old,JSON.stringify(entries()));
 else if(!localStorage.getItem(LOCAL_GUEST))localStorage.setItem(LOCAL_GUEST,JSON.stringify(entries()));
 let backup={};try{backup=JSON.parse(localStorage.getItem(BACKUP_PREFIX+uid)||'{}')}catch{}
 restoreEntries(backup);localStorage.setItem(STORAGE_USER,uid);
}
function leaveLocal(){const old=localStorage.getItem(STORAGE_USER);if(old)localStorage.setItem(BACKUP_PREFIX+old,JSON.stringify(entries()));clearEntries();localStorage.removeItem(STORAGE_USER)}
function saveBackup(){if(user)localStorage.setItem(BACKUP_PREFIX+user.uid,JSON.stringify(entries()))}
const gateStatus=t=>{message.textContent=t};
form.addEventListener('submit',async e=>{e.preventDefault();const email=document.getElementById('gate-email').value,password=document.getElementById('gate-password').value,btn=document.getElementById('gate-submit');btn.disabled=true;gateStatus('Signing in…');try{await signInWithEmailAndPassword(auth,email,password);document.getElementById('gate-password').value=''}catch(err){gateStatus(friendly(err))}finally{btn.disabled=false}});
function show(){modal.hidden=false;modal.classList.remove('hidden');trigger.setAttribute('aria-expanded','true');paint()}
function hide(){modal.hidden=true;modal.classList.add('hidden');trigger.setAttribute('aria-expanded','false');trigger.focus()}
trigger?.addEventListener('click',show);document.getElementById('account-close')?.addEventListener('click',hide);
modal?.addEventListener('click',e=>{if(e.target===modal)hide()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)hide()});
function paint(){if(!user)return;body.innerHTML=`<h2>My account</h2><p class="account-email">${html(user.email)}</p><span class="account-role">${role==='teacher'?'Teacher':'Student'}</span><p class="account-sub">Your private progress is linked to this account.</p><div class="account-actions">${role==='teacher'?'<button id="teacher-open" class="btn primary" type="button">Open teacher dashboard</button>':''}<button id="account-upload" class="btn" type="button">Upload this device's progress</button><button id="account-download" class="btn" type="button">Load my cloud progress</button><button id="account-signout" class="btn" type="button">Sign out</button></div><p id="account-status" role="status" class="account-status">${cloudEnabled?'Cloud sync is on':'Cloud sync unavailable — local answers are kept on this device'}</p>`;
document.getElementById('teacher-open')?.addEventListener('click',()=>{hide();window.classroomGoTeacher?.()});
document.getElementById('account-signout').onclick=async()=>{cloudEnabled=false;await signOut(auth)};
document.getElementById('account-upload').onclick=async()=>{if(!confirm('Replace your cloud progress with the answers saved on this device?'))return;try{await syncNow();status('Uploaded successfully.')}catch(e){status(friendly(e))}};
document.getElementById('account-download').onclick=async()=>{if(!confirm('Replace this device’s saved answers with your cloud progress?'))return;try{await loadCloud(true);status('Cloud progress loaded.')}catch(e){status(friendly(e))}};
}
async function syncNow(){if(!user)throw Error('Not signed in');const id=user.uid;const data=entries();await setDoc(doc(db,'progress',id),{entries:data,updatedAt:serverTimestamp()});saveBackup();cloudEnabled=true}
async function loadCloud(overwrite=false){if(!user)return;const id=user.uid;const result=await getDoc(doc(db,'progress',id));if(result.exists()){restoreEntries(result.data().entries||{});saveBackup();cloudEnabled=true;window.classroomRefresh?.()}else if(overwrite){throw Error('No cloud progress found for this account.')}else{cloudEnabled=true;await syncNow()}}
function schedule(){if(!user)return;saveBackup();if(!cloudEnabled)return;clearTimeout(writeTimer);const current=++session,uid=user.uid;writeTimer=setTimeout(async()=>{if(current!==session||user?.uid!==uid)return;try{await syncNow()}catch(e){console.warn('Cloud save unavailable',e);status('Sync failed — answers remain on this device')}},1400)}
window.classroomCloud={schedule};
window.classroomTeacherDashboard=()=>`<section class="teacher-dashboard"><div class="teacher-head"><span class="eyebrow" style="color:#b9eded">TEACHER WORKSPACE</span><h2>Classroom overview</h2><p>Manage student progress and learning activity.</p></div><div class="teacher-metrics"><div class="teacher-metric"><strong id="teacher-count">${students.length}</strong><span>Student profiles</span></div><div class="teacher-metric"><strong id="teacher-completions">${students.reduce((a,s)=>a+s.completed,0)}</strong><span>Completed lessons</span></div><div class="teacher-metric"><strong id="teacher-activity">${students.filter(s=>s.progress).length}</strong><span>With saved progress</span></div></div><div class="teacher-list"><div class="row"><h3>Students</h3><button class="teacher-action" id="teacher-reload">Refresh</button></div><p class="small muted">${html(listMessage)}</p><div id="teacher-students">${students.map(s=>`<div class="teacher-student"><div><strong>${html(s.email||'Student')}</strong><small>${html(s.uid)}</small></div><div><strong>${s.completed}</strong> lessons completed</div></div>`).join('')}</div></div><div class="teacher-list"><h3>Add a new student</h3><p class="muted small">Open Firebase Authentication → Users → Add user. Give the student their own email and password privately. Their account appears here after their first login.</p><a class="btn" href="https://console.firebase.google.com/project/french-classroom/authentication/users" target="_blank" rel="noopener noreferrer">Manage accounts in Firebase ↗</a></div></section>`;
window.classroomLoadStudents=async()=>{if(role!=='teacher'||!user)return;listMessage='Refreshing…';window.classroomRefresh?.();try{const [profiles,progress]=await Promise.all([getDocs(collection(db,'profiles')),getDocs(collection(db,'progress'))]);const map=new Map();profiles.forEach(x=>{if(x.id!==user.uid)map.set(x.id,{uid:x.id,email:x.data().email||'',completed:0,progress:false})});progress.forEach(x=>{if(x.id===user.uid)return;const student=map.get(x.id)||{uid:x.id,email:'',completed:0,progress:false};student.progress=true;const vals=x.data().entries||{};student.completed=Object.entries(vals).filter(([k,v])=>/^frenchportal_v2_.*_completed$/.test(k)&&v==='yes').length;map.set(x.id,student)});students=[...map.values()].sort((a,b)=>a.email.localeCompare(b.email));listMessage=students.length?'Student records from Firestore.':'No students yet. Add an account in Firebase.'}catch(e){listMessage='Cannot load students: '+friendly(e)}window.classroomRefresh?.()};
window.classroomGoTeacher=()=>{if(role!=='teacher')return;window.classroomSetSection?.('teacher');window.classroomLoadStudents()};
let first=true;
onAuthStateChanged(auth,async u=>{const attempt=++session;clearTimeout(writeTimer);cloudEnabled=false;
 if(!u){if(user||localStorage.getItem(STORAGE_USER))leaveLocal();user=null;role='student';window.classroomSetTeacherRole?.(false);document.body.classList.add('classroom-locked');trigger.textContent='Account';gateStatus('Sign in with the account your teacher created.');return}
 if(user?.uid!==u.uid)migrateLocal(u.uid);
 user=u;role='student';
 try{const roleDoc=await getDoc(doc(db,'roles',u.uid));role=roleDoc.data()?.role==='teacher'?'teacher':'student';window.classroomSetTeacherRole?.(role==='teacher')}catch(err){console.warn('Role lookup:',err)}
 try{await setDoc(doc(db,'profiles',u.uid),{email:u.email||'',lastSeen:serverTimestamp()},{merge:true})}catch(err){console.warn('Profile not saved:',err)}
 try{await loadCloud(false)}catch(err){console.warn('Progress sync:',err);cloudEnabled=false}
 if(attempt!==session)return;
 document.body.classList.remove('classroom-locked');trigger.textContent='My account';if(!modal.hidden)paint();
 window.classroomRefresh?.();
 if(role==='teacher'&&first){first=false;window.classroomGoTeacher()}else first=false;
 gateStatus('');
});
