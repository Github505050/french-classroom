import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, signOut, updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, serverTimestamp, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

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
const BLOCKED_EMAIL_DOMAINS=new Set(["mailinator.com","guerrillamail.com","guerrillamail.net","10minutemail.com","10minutemail.net","temp-mail.org","tempmail.com","tempmail.net","yopmail.com","yopmail.fr","trashmail.com","trashmail.net","dispostable.com","maildrop.cc","getnada.com","sharklasers.com","grr.la","throwawaymail.com","tempr.email","fakeinbox.com","mintemail.com","emailondeck.com","mailnesia.com","mohmal.com","spambog.com","inboxkitten.com","burnermail.io","dropmail.me","1secmail.com","1secmail.org","1secmail.net","1secmail.xyz","tmpmail.org","tmpmail.net","fakemail.net","fakemailgenerator.com","mytemp.email","mail.tm","mail.gw","tempmail.plus","temp-mail.io","emailfake.com","generator.email","mail7.io","tempail.com","tempmailo.com","moakt.com","minuteinbox.com","guerrillamail.info","mailcatch.com","mailpoof.com","tempmailaddress.com","temporary-mail.net","tmail.ws","mailforspam.com","spamgourmet.com","discard.email","fake-email.app","tempmail.dev","anonymmail.net","mail-temporaire.fr","yopmail.net","yopmail.org","nada.email","maildropbox.com"]);
function disposableEmail(email){const domain=String(email).toLowerCase().trim().split('@')[1]||'';return BLOCKED_EMAIL_DOMAINS.has(domain)}
let signupMode=false;const extra=document.getElementById('gate-signup-extra'),confirmWrap=document.getElementById('gate-confirm-wrap');
const profilesCache=new Map();
const forgot=document.getElementById('gate-forgot');forgot?.addEventListener('click',async()=>{const email=document.getElementById('gate-email').value.trim();if(!email)return gateStatus('Enter your email address first.');try{await sendPasswordResetEmail(auth,email);gateStatus('If an account exists for that email, password reset instructions have been sent.')}catch(e){gateStatus(friendly(e))}});
const toggle=document.getElementById('gate-signup-toggle'),submit=document.getElementById('gate-submit'),resend=document.getElementById('gate-verify-resend'),refresh=document.getElementById('gate-verify-refresh');
function signinUi(note=''){
 signupMode=false;extra.hidden=true;confirmWrap.hidden=true;submit.textContent='Sign in';toggle.textContent='Create a student account';
 if(resend)resend.hidden=true;if(refresh)refresh.hidden=true;toggle.hidden=false;gateStatus(note);
}
toggle.onclick=()=>{signupMode=!signupMode;extra.hidden=!signupMode;confirmWrap.hidden=!signupMode;submit.textContent=signupMode?'Create account':'Sign in';toggle.textContent=signupMode?'Already registered? Sign in':'Create a student account';gateStatus(signupMode?'Verify your email before signing in.':'')};
form.addEventListener('submit',async e=>{
 e.preventDefault();const email=document.getElementById('gate-email').value.trim(),password=document.getElementById('gate-password').value;
 submit.disabled=true;gateStatus(signupMode?'Creating your account…':'Signing in…');
 try{
  if(signupMode){
   const fullName=document.getElementById('gate-name').value.trim();const dob=document.getElementById('gate-dob').value;const same=document.getElementById('gate-confirm').value;
   if(fullName.length<2||fullName.length>70)throw Error('Enter your full name.');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(dob)||dob>new Date().toISOString().slice(0,10)||dob<'1900-01-01')throw Error('Enter a valid date of birth.');
   if(password!==same)throw Error('Passwords do not match.');
   if(disposableEmail(email))throw Error('Please use a permanent personal or school email address.');
   if(password.length<8)throw Error('Use a password of at least 8 characters.');
   const result=await createUserWithEmailAndPassword(auth,email,password);
   try{await updateProfile(result.user,{displayName:fullName});localStorage.setItem('classroom_pending_profile_'+result.user.uid,JSON.stringify({fullName,dob}));await sendEmailVerification(result.user)}finally{await signOut(auth)}
   document.getElementById('gate-password').value='';
   signinUi('Verification email sent. Click the link in your inbox, then come back and sign in using your password.');
  }else{
   const result=await signInWithEmailAndPassword(auth,email,password);
   await result.user.reload();
   await result.user.getIdToken(true);
   await handleAuthState(result.user);
  }
 }catch(err){gateStatus(friendly(err))}finally{submit.disabled=false}
});
if(resend)resend.hidden=true;if(refresh)refresh.hidden=true;
function show(){modal.hidden=false;modal.classList.remove('hidden');trigger.setAttribute('aria-expanded','true');paint()}
function hide(){modal.hidden=true;modal.classList.add('hidden');trigger.setAttribute('aria-expanded','false');trigger.focus()}
trigger?.addEventListener('click',show);document.getElementById('account-close')?.addEventListener('click',hide);
modal?.addEventListener('click',e=>{if(e.target===modal)hide()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)hide()});
function paint(){
 if(!user)return;
 const localPic=localStorage.getItem('classroom_avatar_'+user.uid)||user.photoURL||'';const pic=localPic?html(localPic):'',photo=pic?'<img src="'+pic+'" alt="Profile photo" class="profile-picture">':'<span class="profile-initial">'+html((user.displayName||user.email||'S')[0].toUpperCase())+'</span>';
 body.innerHTML=`<div class="profile-header"><div class="profile-avatar">${photo}</div><div><h2>My profile</h2><p class="account-email">${html(user.email)}</p><span class="account-role">${role==='teacher'?'Teacher':'Student'}</span></div></div>
 <form id="profile-name-form"><label>Display name<input class="field" id="profile-name" maxlength="60" value="${html(user.displayName||'')}" placeholder="Your name"></label><button class="btn" type="submit">Save name</button></form>
 <div class="profile-photo-picker"><label>Profile photo<input id="profile-photo-file" type="file" accept="image/jpeg,image/png,image/webp"></label></div><p class="profile-hint">Choose an image up to 3 MB.</p>
 <details class="profile-details"><summary>Change password</summary><form id="profile-password-form"><label>Current password<input class="field" id="profile-old-password" type="password" autocomplete="current-password" required></label><label>New password<input class="field" id="profile-new-password" type="password" autocomplete="new-password" minlength="8" required></label><button class="btn" type="submit">Change password</button></form></details>
 <div class="account-actions">${role==='teacher'?'<button id="teacher-open" class="btn primary" type="button">Teacher dashboard</button>':''}<button id="account-signout" class="btn" type="button">Sign out</button><button id="account-delete" class="btn profile-danger" type="button">Delete my account</button></div>
 <p id="account-status" role="status" class="account-status"></p>`;
 document.getElementById('teacher-open')?.addEventListener('click',()=>{hide();window.classroomGoTeacher?.()});
 document.getElementById('account-signout').onclick=async()=>{hide();await signOut(auth)};
 document.getElementById('profile-name-form').onsubmit=async e=>{e.preventDefault();try{await updateProfile(auth.currentUser,{displayName:document.getElementById('profile-name').value.trim()});status('Name saved.')}catch(e){status(friendly(e))}};
 document.getElementById('profile-photo-file').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>3_000_000||!['image/jpeg','image/png','image/webp'].includes(file.type))return status('Use a JPG, PNG, or WebP image under 3 MB.');try{const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;const ctx=canvas.getContext('2d');const side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,160,160);bitmap.close?.();const data=canvas.toDataURL('image/jpeg',.78);await setDoc(doc(db,'profiles',user.uid),{email:user.email||'',avatar:data,lastSeen:serverTimestamp()},{merge:true});localStorage.setItem('classroom_avatar_'+user.uid,data);paint();status('Photo saved to your account.')}catch(err){status('Could not process this photo.')}};
 document.getElementById('profile-password-form').onsubmit=async e=>{e.preventDefault();const old=document.getElementById('profile-old-password').value,next=document.getElementById('profile-new-password').value;if(next.length<8)return status('Use at least 8 characters.');try{await reauthenticateWithCredential(auth.currentUser,EmailAuthProvider.credential(auth.currentUser.email,old));await updatePassword(auth.currentUser,next);e.target.reset();status('Password changed successfully.')}catch(e){status(friendly(e))}};
 document.getElementById('account-delete').onclick=async()=>{if(!confirm('Permanently delete your account and cloud progress? This cannot be undone.'))return;const pw=prompt('Enter your current password to confirm deletion:');if(!pw)return;try{const u=auth.currentUser;await reauthenticateWithCredential(u,EmailAuthProvider.credential(u.email,pw));await Promise.all([deleteDoc(doc(db,'progress',u.uid)),deleteDoc(doc(db,'profiles',u.uid))]);await deleteUser(u);localStorage.removeItem('classroom_avatar_'+u.uid);hide();status('Account deleted.')}catch(e){status('Account deletion failed: '+friendly(e))}};
}
async function syncNow(){if(!user)throw Error('Not signed in');const id=user.uid;const data=entries();await setDoc(doc(db,'progress',id),{entries:data,updatedAt:serverTimestamp()});saveBackup();cloudEnabled=true}
async function loadCloud(overwrite=false){if(!user)return;const id=user.uid;const result=await getDoc(doc(db,'progress',id));if(result.exists()){restoreEntries(result.data().entries||{});saveBackup();cloudEnabled=true;window.classroomRefresh?.()}else if(overwrite){throw Error('No cloud progress found for this account.')}else{cloudEnabled=true;await syncNow()}}
function schedule(){if(!user)return;saveBackup();if(!cloudEnabled)return;clearTimeout(writeTimer);const current=++session,uid=user.uid;writeTimer=setTimeout(async()=>{if(current!==session||user?.uid!==uid)return;try{await syncNow()}catch(e){console.warn('Cloud save unavailable',e);status('Sync failed — answers remain on this device')}},1400)}
window.classroomCloud={schedule};
window.classroomTeacherDashboard=()=>`<section class="teacher-dashboard"><div class="teacher-head"><span class="eyebrow" style="color:#b9eded">TEACHER WORKSPACE</span><h2>Classroom overview</h2><p>Manage student progress and learning activity.</p></div><div class="teacher-metrics"><div class="teacher-metric"><strong id="teacher-count">${students.length}</strong><span>Student profiles</span></div><div class="teacher-metric"><strong id="teacher-completions">${students.reduce((a,s)=>a+s.completed,0)}</strong><span>Completed lessons</span></div><div class="teacher-metric"><strong id="teacher-activity">${students.filter(s=>s.progress).length}</strong><span>With saved progress</span></div></div><div class="teacher-list"><div class="row"><h3>Students</h3><button class="teacher-action" id="teacher-reload">Refresh</button></div><p class="small muted">${html(listMessage)}</p><div id="teacher-students">${students.map(s=>`<div class="teacher-student"><div><strong>${html(s.email||'Student')}</strong><small>${html(s.uid)}</small></div><div><strong>${s.completed}</strong> lessons completed</div></div>`).join('')}</div></div><div class="teacher-list"><h3>Student registration</h3><p class="muted small">Students create their own accounts and verify their email before entering. Share your classroom URL with them.</p><button class="teacher-action" id="teacher-copy-link" type="button">Copy classroom link</button></div></section>`;
window.classroomLoadStudents=async()=>{if(role!=='teacher'||!user)return;listMessage='Refreshing…';window.classroomRefresh?.();try{const [profiles,progress]=await Promise.all([getDocs(collection(db,'profiles')),getDocs(collection(db,'progress'))]);const map=new Map();profiles.forEach(x=>{if(x.id!==user.uid)map.set(x.id,{uid:x.id,email:x.data().email||'',completed:0,progress:false})});progress.forEach(x=>{if(x.id===user.uid)return;const student=map.get(x.id)||{uid:x.id,email:'',completed:0,progress:false};student.progress=true;const vals=x.data().entries||{};student.completed=Object.entries(vals).filter(([k,v])=>/^frenchportal_v2_.*_completed$/.test(k)&&v==='yes').length;map.set(x.id,student)});students=[...map.values()].sort((a,b)=>a.email.localeCompare(b.email));listMessage=students.length?'Student records from Firestore.':'No students yet. Add an account in Firebase.'}catch(e){listMessage='Cannot load students: '+friendly(e)}window.classroomRefresh?.()};
window.classroomGoTeacher=()=>{if(role!=='teacher')return;window.classroomSetSection?.('teacher');window.classroomLoadStudents()};
document.addEventListener('click',async e=>{
 const copy=e.target.closest('#teacher-copy-link');
 if(copy){try{await navigator.clipboard.writeText('https://github505050.github.io/french-classroom/');copy.textContent='Link copied'}catch{copy.textContent='https://github505050.github.io/french-classroom/'}return}
 if(e.target.closest('#teacher-reload'))window.classroomLoadStudents?.();
});

let first=true;
async function handleAuthState(u){const attempt=++session;clearTimeout(writeTimer);cloudEnabled=false;
 if(!u){if(resend)resend.hidden=true;if(refresh)refresh.hidden=true;toggle.hidden=false;if(user||localStorage.getItem(STORAGE_USER))leaveLocal();user=null;role='student';window.classroomSetTeacherRole?.(false);document.body.classList.add('classroom-locked');trigger.textContent='Account';gateStatus('Sign in or create your student account.');return}
 await u.reload().catch(()=>{});await u.getIdToken(true).catch(()=>{});
 let isTeacher=false;try{const r=await getDoc(doc(db,'roles',u.uid));isTeacher=r.data()?.role==='teacher'}catch(e){console.warn('Role check:',e)}
 if(!u.emailVerified && !isTeacher){document.body.classList.add('classroom-locked');await signOut(auth);signinUi('Your email is not verified. Open the verification link in your inbox, then sign in again with your password.');return}
 if(resend)resend.hidden=true;if(refresh)refresh.hidden=true;toggle.hidden=false;
 if(user?.uid!==u.uid)migrateLocal(u.uid);
 user=u;role='student';
 role=isTeacher?'teacher':'student';window.classroomSetTeacherRole?.(isTeacher);
 try{const pending=JSON.parse(localStorage.getItem('classroom_pending_profile_'+u.uid)||'null');const data={email:u.email||'',lastSeen:serverTimestamp()};if(pending){data.name=pending.fullName;data.dob=pending.dob;}await setDoc(doc(db,'profiles',u.uid),data,{merge:true});if(pending)localStorage.removeItem('classroom_pending_profile_'+u.uid)}catch(err){console.warn('Profile not saved:',err)}
 try{await loadCloud(false)}catch(err){console.warn('Progress sync:',err);cloudEnabled=false}
 if(attempt!==session)return;
 if(!modal.hidden)hide();document.body.classList.remove('classroom-locked');trigger.textContent='My account';window.classroomBonjour?.();
 window.classroomRefresh?.();
 if(role==='teacher'&&first){first=false;window.classroomGoTeacher()}else first=false;
 gateStatus('');
}
onAuthStateChanged(auth,handleAuthState);
