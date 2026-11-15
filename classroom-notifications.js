/* Private, in-app classroom notification centre. No browser push or background messaging. */
(function(){
'use strict';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let items=[],open=false,loading=false,lastFetch=0,ready=false,lastUid=null,selectedNoticeId=null;
const node=()=>document.getElementById('classroom-notice-popover');
// Render the panel at the document root so page cards, header transforms, and
// mobile stacking contexts cannot paint on top of or clip notifications.
let backdrop=null;
function ensureNoticeLayer(){
 const panel=node();
 if(!panel||!document.body)return;
 if(panel.parentElement!==document.body)document.body.appendChild(panel);
 if(!backdrop){
  backdrop=document.createElement('div');
  backdrop.className='classroom-notice-backdrop';
  backdrop.hidden=true;
  backdrop.setAttribute('aria-hidden','true');
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click',close);
 }
}
function updateNoticeLayer(){
 ensureNoticeLayer();
 const panel=node();
 if(!panel)return;
 if(backdrop)backdrop.hidden=!open;
 document.body.classList.toggle('classroom-notice-is-open',open);
 if(open){
  panel.setAttribute('aria-modal','true');
  const bell=document.getElementById('classroom-notice-button');
  if(bell){
   const pos=bell.getBoundingClientRect();
   panel.style.setProperty('--notice-top',Math.min(window.innerHeight-90,Math.max(65,pos.bottom+12))+'px');
   panel.style.setProperty('--notice-right',Math.max(12,window.innerWidth-pos.right)+'px');
  }
 }else panel.removeAttribute('aria-modal');
}

const pushAvailable=()=>typeof window.Notification!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&window.isSecureContext;
const isApplePhone=()=>/iPad|iPhone|iPod/.test(navigator.userAgent);
const installed=()=>window.matchMedia?.('(display-mode: standalone)').matches===true||navigator.standalone===true;
let pushBusy=false,pushEnabled=false;
function decodeVapid(key){
 const normalized=key.replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(normalized+'='.repeat((4-normalized.length%4)%4));
 return Uint8Array.from(raw,ch=>ch.charCodeAt(0));
}
window.classroomDisablePhonePush=async()=>{
 if(!pushAvailable())return;
 try{
  const reg=await navigator.serviceWorker.ready,sub=await reg.pushManager.getSubscription();
  if(sub){
   try{await window.classroomTestUploads?.unregisterPush(sub.endpoint)}
   catch(err){console.warn('Push device removal failed',err)}
   await sub.unsubscribe();
  }
  pushEnabled=false;renderPushSettings();
 }catch(err){console.warn('Failed to unsubscribe push',err)}
};
async function pushStatus(){
 if(!pushAvailable())return;
 try{
  const reg=await navigator.serviceWorker.ready;
  const subscription=await reg.pushManager.getSubscription();
  pushEnabled=!!subscription&&Notification.permission==='granted';
  if(pushEnabled&&window.classroomTestUploads)await window.classroomTestUploads.registerPush(subscription.toJSON());
 }catch(err){console.warn('Unable to inspect push subscription',err)}
 renderPushSettings();
}
function renderPushSettings(){
 const area=document.getElementById('classroom-push-settings');if(!area)return;
 const mobileTip=isApplePhone()&&!installed()?'On iPhone, open this site in Safari, choose Share → Add to Home Screen, then open the installed app to enable notifications.':'Allow phone notifications here, then enable sounds and Lock Screen alerts in your phone settings. Silent Mode, Focus or Do Not Disturb can suppress sound.';
 let body='';
 if(!pushAvailable())body='<p>Phone push is not available in this browser. You can still use the in-app notifications above.</p>';
 else if(isApplePhone()&&!installed())body='<p>'+mobileTip+'</p>';
 else if(Notification.permission==='denied')body='<p>Notifications are blocked for this website. Allow them in your phone or browser notification settings.</p>';
 else body='<p>'+(pushEnabled?'Phone alerts are enabled on this device.':mobileTip)+'</p><button type="button" class="classroom-push-toggle" data-push-toggle '+(pushBusy?'disabled':'')+'>'+(pushBusy?'Updating…':pushEnabled?'Turn off phone alerts':'Enable phone notifications')+'</button>';
 area.innerHTML='<div class="classroom-push-heading"><span aria-hidden="true">🔔</span><strong>Phone notifications</strong></div>'+body;
}
async function togglePhonePush(){
 if(!pushAvailable()||pushBusy)return;
 const api=window.classroomTestUploads;if(!api){renderPushSettings();return}
 pushBusy=true;renderPushSettings();
 try{
  if(pushEnabled){
   const reg=await navigator.serviceWorker.ready,subscription=await reg.pushManager.getSubscription();
   if(subscription){await api.unregisterPush(subscription.endpoint);await subscription.unsubscribe()}
   pushEnabled=false;
  }else{
   // Permission must be requested directly in the user's click gesture.
   const permission=await Notification.requestPermission();
   if(permission!=='granted')throw Error('Phone notifications were not allowed.');
   const publicKey=(await api.pushConfig()).publicKey;
   if(!publicKey)throw Error('Push signing key unavailable.');
   const reg=await navigator.serviceWorker.ready;
   let sub=await reg.pushManager.getSubscription();
   if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeVapid(publicKey)});
   await api.registerPush(sub.toJSON());
   pushEnabled=true;
  }
 }catch(err){alert('Phone alerts: '+(api?.error(err)||String(err)))}
 finally{pushBusy=false;renderPushSettings()}
}

const time=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})};
function draw(){
 const box=node(),badge=document.getElementById('classroom-notice-count'),bell=document.getElementById('classroom-notice-button');
 if(!box||!bell)return;
 const unread=items.filter(n=>!n.read).length;
 if(badge){badge.textContent=unread>99?'99+':String(unread);badge.hidden=!unread}
 bell.setAttribute('aria-label',unread?unread+' unread classroom notifications':'Classroom notifications');
 bell.setAttribute('aria-expanded',String(open));
 updateNoticeLayer();
 box.hidden=!open;
 if(!open)return;
 const selected=items.find(n=>n.id===selectedNoticeId);
 if(selected){
  box.innerHTML='<div class="classroom-notice-header classroom-notice-detail-header">'+
   '<button type="button" class="classroom-notice-back" data-notice-back aria-label="Back to all notifications">← <span>Notifications</span></button>'+
   '<button type="button" data-notice-close aria-label="Close notifications">×</button></div>'+
   '<article class="classroom-notice-detail">'+
    '<div class="classroom-notice-detail-meta"><span class="classroom-notice-detail-type">'+E(selected.kind==='result'?'Test results':selected.kind==='test'?'Assessment':selected.kind==='reminder'?'Reminder':'Teacher announcement')+'</span>'+
    '<span>'+E(time(selected.createdAt))+'</span></div>'+
    '<h2>'+E(selected.title)+'</h2>'+
    '<div class="classroom-notice-detail-message">'+E(selected.body).replace(/\n/g,'<br>')+'</div>'+
    '<div class="classroom-notice-detail-actions"><button type="button" data-notice-destination="'+E(selected.id)+'">Go to '+(selected.destination==='tests'?'Tests':selected.destination==='myresults'?'My Results':'Home')+' →</button></div>'+
   '</article>';
 }else{
  box.innerHTML='<div class="classroom-notice-header"><div><strong>Notifications</strong><small>'+unread+' unread</small></div><button type="button" data-notice-close aria-label="Close notifications">×</button></div>'+
   (items.length?'<div class="classroom-notice-items">'+items.map(n=>
    '<button type="button" class="classroom-notice-item '+(n.read?'is-read':'is-unread')+'" data-notice-open="'+E(n.id)+'">'+
    '<span class="classroom-notice-marker"></span><span class="classroom-notice-copy">'+
    '<span class="classroom-notice-row-title"><strong>'+E(n.title)+'</strong>'+(n.read?'':'<span class="classroom-notice-new">New</span>')+'</span>'+
    '<span class="classroom-notice-description classroom-notice-preview">'+E(n.body.length>98?n.body.slice(0,98).trimEnd()+'…':n.body)+'</span>'+
    '<span class="classroom-notice-when">'+E(time(n.createdAt))+'</span>'+
    '</span><span class="classroom-notice-chevron" aria-hidden="true">›</span></button>').join('')+'</div>':
    '<div class="classroom-notice-empty"><strong>All caught up</strong><p>New classroom updates and published results will appear here.</p></div>')+
   '<div class="classroom-push-settings" id="classroom-push-settings"></div>'+
   '<div class="classroom-notice-foot">Phone alerts follow your device sound, lock-screen and Focus settings.</div>';
  renderPushSettings();
 }
}

async function load(force=false){
 const api=window.classroomTestUploads;if(!api||loading||(!force&&Date.now()-lastFetch<60000))return;
 loading=true;try{
 const data=await api.notifications();
 items=Array.isArray(data.notices)?data.notices:[];
 ready=true;lastFetch=Date.now();draw();
 // When a student taps an OS push alert, the service worker opens a URL with
 // the exact notice ID. A successful authenticated load marks it read.
 const target=new URLSearchParams(window.location.search).get('notice');
 if(target&&items.some(n=>n.id===target)){
  if(!open){open=true;selectedNoticeId=target;draw()}
  else{selectedNoticeId=target;draw()}
  await markRead(target);
  const url=new URL(window.location.href);url.searchParams.delete('notice');
  window.history.replaceState(window.history.state,'',url.pathname+url.search+url.hash);
 }
}catch(err){if(open&&node())node().innerHTML='<div class="classroom-notice-empty"><strong>Notifications unavailable</strong><p>'+E(api.error(err))+'</p><button data-notice-retry type="button">Retry</button></div>'}finally{loading=false}
}
function toggle(){open=!open;if(open)selectedNoticeId=null;draw();if(open){node()?.querySelector('[data-notice-close]')?.focus();load(true);pushStatus()}}
function close(){if(open){open=false;selectedNoticeId=null;draw();document.getElementById('classroom-notice-button')?.focus()}}
async function markRead(id){
 const n=items.find(x=>x.id===id);if(!n||n.read)return true;
 try{
  await window.classroomTestUploads.readNotification(id);
  n.read=true;
  draw();
  return true;
 }catch(err){console.warn('Unable to mark notice read',err);return false}
}
async function showNoticeDetail(id){
 const notice=items.find(n=>n.id===id);if(!notice)return;
 selectedNoticeId=id;
 draw();
 node()?.querySelector('[data-notice-back]')?.focus();
 // Opening the message is the read event. No manual read action is required.
 if(!notice.read)await markRead(id);
}
function openNoticeDestination(id){
 const notice=items.find(n=>n.id===id);if(!notice)return;
 const destination=notice.destination||'home';
 close();
 window.classroomSetSection?.(destination);
}

document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-push-toggle],[data-notice-open],[data-notice-back],[data-notice-destination],[data-notice-close],[data-notice-retry],#classroom-notice-button');
 if(btn){if(btn.hasAttribute('data-push-toggle')){togglePhonePush();return}
 if(btn.id==='classroom-notice-button'){toggle();return}
 if(btn.hasAttribute('data-notice-close')){close();return}
 if(btn.hasAttribute('data-notice-retry')){load(true);return}
 if(btn.hasAttribute('data-notice-back')){selectedNoticeId=null;draw();return}
 if(btn.hasAttribute('data-notice-destination')){openNoticeDestination(btn.dataset.noticeDestination);return}
 if(btn.hasAttribute('data-notice-open')){showNoticeDetail(btn.dataset.noticeOpen);return}}
 if(open&&!node()?.contains(e.target)&&!e.target.closest('#classroom-notice-button'))close();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
window.addEventListener('classroom-test-uploads-ready',()=>load(true));
window.addEventListener('classroom-auth-ready',()=>load(true));
window.addEventListener('classroom-auth-state',event=>{
 const next=event.detail?.uid||null;
 if(next!==lastUid){lastUid=next;items=[];lastFetch=0;ready=false;open=false;selectedNoticeId=null;pushEnabled=false;draw()}
 if(next){load(true);pushStatus()}
});
window.addEventListener('classroom-auth-ready',()=>pushStatus());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(true)});
window.addEventListener('classroom-result-published',()=>load(true));
window.classroomNotificationsRefresh=()=>load(true);
window.classroomNotificationsStart=()=>{draw();load(true)};
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='classroom-push-received')load(true)});
window.setInterval(()=>{if(!document.hidden)load()},120000);
})();
