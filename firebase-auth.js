import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const app=initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
const trigger=document.getElementById('account-trigger'),modal=document.getElementById('account-modal');
const body=document.getElementById('account-body');
let user=null,role='student',cloudEnabled=false,writeTimer=null,busy=false;
const status=(message)=>{const el=document.getElementById('account-status');if(el)el.textContent=message};
function snapshot(){const entries={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(/^frenchportal_v[12]_/.test(k))entries[k]=localStorage.getItem(k)}return entries}
function show(){modal.hidden=false;modal.classList.remove('hidden');trigger.setAttribute('aria-expanded','true');paint();const first=modal.querySelector('input,button');first?.focus()}
function hide(){modal.hidden=true;modal.classList.add('hidden');trigger.setAttribute('aria-expanded','false');trigger.focus()}
trigger?.addEventListener('click',show);
document.getElementById('account-close')?.addEventListener('click',hide);
modal?.addEventListener('click',e=>{if(e.target===modal)hide()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)hide()});
const friendly=e=>({'auth/invalid-credential':'Email or password is incorrect.','auth/invalid-email':'Enter a valid email address.','auth/too-many-requests':'Too many attempts. Try again later.','auth/operation-not-allowed':'Email/password login must be enabled in Firebase Console.','permission-denied':'Firestore permissions are not ready. Publish the security rules first.'}[e.code]||e.message||'Something went wrong.');
function paint(){
 if(!user){trigger.textContent='Account';body.innerHTML=`<h2>Student & teacher sign in</h2><p class="account-sub">Access your personal classroom progress.</p><form id="account-form"><label>Email<input class="field" type="email" id="account-email" autocomplete="username" required></label><label>Password<input class="field" type="password" id="account-password" autocomplete="current-password" required></label><button class="btn primary account-wide" type="submit">Sign in</button></form><p id="account-status" role="status" class="account-status"></p><p class="account-sub">Your teacher creates your account. Continue using the classroom without signing in if you prefer.</p>`;
 document.getElementById('account-form')?.addEventListener('submit',async e=>{e.preventDefault();const email=document.getElementById('account-email').value,password=document.getElementById('account-password').value;status('Signing in…');try{await signInWithEmailAndPassword(auth,email,password)}catch(err){status(friendly(err))}});
 return;
 }
 trigger.textContent='My account';
 body.innerHTML=`<h2>My account</h2><p class="account-email">${user.email.replace(/[&<>"']/g,'')}</p><span class="account-role">${role==='teacher'?'Teacher':'Student'}</span><p class="account-sub">Cloud progress is optional. Choose the correct progress source before syncing.</p><div class="account-actions"><button id="account-upload" class="btn primary" type="button">Upload this device's progress</button><button id="account-download" class="btn" type="button">Load my cloud progress</button><button id="account-signout" class="btn" type="button">Sign out</button></div><p id="account-status" role="status" class="account-status">${cloudEnabled?'Cloud saving active for this session.':'Cloud saving is paused until you choose upload or load.'}</p>`;
 document.getElementById('account-signout').onclick=async()=>{cloudEnabled=false;await signOut(auth)};
 document.getElementById('account-upload').onclick=async()=>{if(busy)return;if(!confirm('Upload this device’s existing scores and answers to your account? Only do this if they belong to you. This replaces your current cloud progress.'))return;busy=true;status('Uploading…');try{await setDoc(doc(db,'progress',user.uid),{entries:snapshot(),updatedAt:serverTimestamp()});cloudEnabled=true;status('Progress uploaded. Future changes will save to this account while online.')}catch(err){status(friendly(err))}finally{busy=false}};
 document.getElementById('account-download').onclick=async()=>{if(busy)return;if(!confirm('Load cloud progress into this browser? Existing saved answers for matching questions may be replaced.'))return;busy=true;status('Loading…');try{const snap=await getDoc(doc(db,'progress',user.uid));if(snap.exists()){const entries=snap.data().entries||{};for(const [k,v] of Object.entries(entries)){if(/^frenchportal_v[12]_/.test(k)&&typeof v==='string')localStorage.setItem(k,v)}cloudEnabled=true;status('Cloud progress loaded. Future changes will save while online.');if(typeof window.classroomRefresh==='function')window.classroomRefresh()}else{status('No cloud progress found. Use Upload to save this device’s progress.')}}catch(err){status(friendly(err))}finally{busy=false}};
}
function schedule(){if(!user||!cloudEnabled)return;clearTimeout(writeTimer);writeTimer=setTimeout(async()=>{try{await setDoc(doc(db,'progress',user.uid),{entries:snapshot(),updatedAt:serverTimestamp()});}catch(err){console.warn('Cloud save failed',err);status('Cloud save failed. Check your connection and try again.')}},1000)}
window.classroomCloud={schedule};
onAuthStateChanged(auth,async u=>{user=u;cloudEnabled=false;role='student';clearTimeout(writeTimer);if(u){try{const p=await getDoc(doc(db,'roles',u.uid));role=p.data()?.role==='teacher'?'teacher':'student'}catch(e){console.warn('Role lookup unavailable',e)}}if(modal&&!modal.hidden)paint();trigger.textContent=u?'My account':'Account'});
