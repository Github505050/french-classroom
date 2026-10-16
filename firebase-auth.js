import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
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
const BLOCKED_EMAIL_DOMAINS=new Set(["mailinator.com","guerrillamail.com","guerrillamail.net","10minutemail.com","10minutemail.net","temp-mail.org","tempmail.com","tempmail.net","yopmail.com","yopmail.fr","trashmail.com","trashmail.net","dispostable.com","maildrop.cc","getnada.com","sharklasers.com","grr.la","throwawaymail.com","tempr.email","fakeinbox.com","mintemail.com","emailondeck.com","mailnesia.com","mohmal.com","spambog.com","inboxkitten.com","burnermail.io","dropmail.me","1secmail.com","1secmail.org","1secmail.net","1secmail.xyz","tmpmail.org","tmpmail.net","fakemail.net","fakemailgenerator.com","mytemp.email"]);
function disposableEmail(email){const domain=String(email).toLowerCase().trim().split('@')[1]||'';return BLOCKED_EMAIL_DOMAINS.has(domain)}
let signupMode=false;
const toggle=document.getElementById('gate-signup-toggle'),submit=document.getElementById('gate-submit'),resend=document.getElementById('gate-verify-resend'),refresh=document.getElementById('gate-verify-refresh');
toggle.onclick=()=>{signupMode=!signupMode;submit.textContent=signupMode?'Create account':'Sign in';toggle.textContent=signupMode?'Already registered? Sign in':'Create a student account';gateStatus(signupMode?'Create your account, then verify your email to enter.':'')};
form.addEventListener('submit',async e=>{
 e.preventDefault();const email=document.getElementById('gate-email').value.trim(),password=document.getElementById('gate-password').value,btn=submit;
 btn.disabled=true;gateStatus(signupMode?'Creating your account…':'Signing in…');
 try{
  if(signupMode){if(disposableEmail(email))throw Error('Temporary email addresses are not accepted. Please use a regular personal or school email.');if(password.length<6)throw Error('Password must have at least 6 characters.');const created=await createUserWithEmailAndPassword(auth,email,password);await sendEmailVerification(created.user);gateStatus('Account created! Check your inbox and spam folder, open the verification link, then return here and select I verified my email.');resend.hidden=false;refresh.hidden=false;}
  else await signInWithEmailAndPassword(auth,email,password);
  document.getElementById('gate-password').value='';
 }catch(err){gateStatus(friendly(err))}finally{btn.disabled=false}
});
resend.onclick=async()=>{if(!auth.currentUser)return gateStatus('Sign in first to resend verification.');resend.disabled=true;try{await sendEmailVerification(auth.currentUser);gateStatus('Verification email sent. Check your inbox and spam folder.')}catch(e){gateStatus(friendly(e))}finally{resend.disabled=false}};
refresh.onclick=async()=>{if(!auth.currentUser)return gateStatus('Sign in first, then verify your email.');refresh.disabled=true;try{await auth.currentUser.reload();await auth.currentUser.getIdToken(true);await handleAuthState(auth.currentUser);if(!auth.currentUser.emailVerified)gateStatus('Your email is not verified yet. Open the link in the email and try again.')}catch(e){gateStatus(friendly(e))}finally{refresh.disabled=false}};
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
window.classroomTeacherDashboard=()=>`<section class="teacher-dashboard"><div class="teacher-head"><span class="eyebrow" style="color:#b9eded">TEACHER WORKSPACE</span><h2>Classroom overview</h2><p>Manage student progress and learning activity.</p></div><div class="teacher-metrics"><div class="teacher-metric"><strong id="teacher-count">${students.length}</strong><span>Student profiles</span></div><div class="teacher-metric"><strong id="teacher-completions">${students.reduce((a,s)=>a+s.completed,0)}</strong><span>Completed lessons</span></div><div class="teacher-metric"><strong id="teacher-activity">${students.filter(s=>s.progress).length}</strong><span>With saved progress</span></div></div><div class="teacher-list"><div class="row"><h3>Students</h3><button class="teacher-action" id="teacher-reload">Refresh</button></div><p class="small muted">${html(listMessage)}</p><div id="teacher-students">${students.map(s=>`<div class="teacher-student"><div><strong>${html(s.email||'Student')}</strong><small>${html(s.uid)}</small></div><div><strong>${s.completed}</strong> lessons completed</div></div>`).join('')}</div></div><div class="teacher-list"><h3>Student registration</h3><p class="muted small">Students create their own accounts and verify their email before entering. Share your classroom URL with them.</p><button class="teacher-action" id="teacher-copy-link" type="button">Copy classroom link</button></div></section>`;
window.classroomLoadStudents=async()=>{if(role!=='teacher'||!user)return;listMessage='Refreshing…';window.classroomRefresh?.();try{const [profiles,progress]=await Promise.all([getDocs(collection(db,'profiles')),getDocs(collection(db,'progress'))]);const map=new Map();profiles.forEach(x=>{if(x.id!==user.uid)map.set(x.id,{uid:x.id,email:x.data().email||'',completed:0,progress:false})});progress.forEach(x=>{if(x.id===user.uid)return;const student=map.get(x.id)||{uid:x.id,email:'',completed:0,progress:false};student.progress=true;const vals=x.data().entries||{};student.completed=Object.entries(vals).filter(([k,v])=>/^frenchportal_v2_.*_completed$/.test(k)&&v==='yes').length;map.set(x.id,student)});students=[...map.values()].sort((a,b)=>a.email.localeCompare(b.email));listMessage=students.length?'Student records from Firestore.':'No students yet. Add an account in Firebase.'}catch(e){listMessage='Cannot load students: '+friendly(e)}window.classroomRefresh?.()};
window.classroomGoTeacher=()=>{if(role!=='teacher')return;window.classroomSetSection?.('teacher');window.classroomLoadStudents()};
let first=true;
async function handleAuthState(u){const attempt=++session;clearTimeout(writeTimer);cloudEnabled=false;
 if(!u){resend.hidden=true;refresh.hidden=true;toggle.hidden=false;if(user||localStorage.getItem(STORAGE_USER))leaveLocal();user=null;role='student';window.classroomSetTeacherRole?.(false);document.body.classList.add('classroom-locked');trigger.textContent='Account';gateStatus('Sign in or create your student account.');return}
 await u.reload().catch(()=>{});await u.getIdToken(true).catch(()=>{});
 let isTeacher=false;try{const r=await getDoc(doc(db,'roles',u.uid));isTeacher=r.data()?.role==='teacher'}catch(e){console.warn('Role check:',e)}
 if(!u.emailVerified && !isTeacher){document.body.classList.add('classroom-locked');resend.hidden=false;refresh.hidden=false;toggle.hidden=true;submit.textContent='Sign in';gateStatus('Verify your email to enter the classroom. Check your inbox or spam, then choose I verified my email.');return}
 resend.hidden=true;refresh.hidden=true;toggle.hidden=false;
 if(user?.uid!==u.uid)migrateLocal(u.uid);
 user=u;role='student';
 role=isTeacher?'teacher':'student';window.classroomSetTeacherRole?.(isTeacher);
 try{await setDoc(doc(db,'profiles',u.uid),{email:u.email||'',lastSeen:serverTimestamp()},{merge:true})}catch(err){console.warn('Profile not saved:',err)}
 try{await loadCloud(false)}catch(err){console.warn('Progress sync:',err);cloudEnabled=false}
 if(attempt!==session)return;
 document.body.classList.remove('classroom-locked');trigger.textContent='My account';if(!modal.hidden)paint();
 window.classroomRefresh?.();
 if(role==='teacher'&&first){first=false;window.classroomGoTeacher()}else first=false;
 gateStatus('');
}
onAuthStateChanged(auth,handleAuthState);
