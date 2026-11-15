/* Private, in-app classroom notification centre. No browser push or background messaging. */
(function(){
'use strict';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let items=[],open=false,loading=false,lastFetch=0,ready=false;
const node=()=>document.getElementById('classroom-notice-popover');
const pushAvailable=()=>typeof window.Notification!=='undefined'&&'serviceWorker' in navigator&&'PushManager' in window&&window.isSecureContext;
const isApplePhone=()=>/iPad|iPhone|iPod/.test(navigator.userAgent);
const installed=()=>window.matchMedia?.('(display-mode: standalone)').matches===true||navigator.standalone===true;
let pushBusy=false,pushEnabled=false;
function decodeVapid(key){
 const normalized=key.replace(/-/g,'+').replace(/_/g,'/');
 const raw=atob(normalized+'='.repeat((4-normalized.length%4)%4));
 return Uint8Array.from(raw,ch=>ch.charCodeAt(0));
}
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
 const mobileTip=isApplePhone()&&!installed()?'On iPhone, open this site in Safari, choose Share → Add to Home Screen, then open the installed app to enable notifications.':'You can receive test and result alerts on your phone even while this app is closed.';
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
 const box=node(),badge=document.getElementById('classroom-notice-count'),bell=document.getElementById('classroom-notice-button');if(!box||!bell)return;
 const unread=items.filter(n=>!n.read).length;
 if(badge){badge.textContent=unread>99?'99+':String(unread);badge.hidden=!unread}
 bell.setAttribute('aria-label',unread?unread+' unread classroom notifications':'Classroom notifications');
 bell.setAttribute('aria-expanded',String(open));box.hidden=!open;
 if(!open)return;
 box.innerHTML='<div class="classroom-notice-header"><div><strong>Notifications</strong><small>'+unread+' unread</small></div><button type="button" data-notice-close aria-label="Close notifications">×</button></div>'+
 (items.length?'<div class="classroom-notice-items">'+items.map(n=>'<article class="classroom-notice-item '+(n.read?'is-read':'is-unread')+'"><span class="classroom-notice-marker"></span><div><h4>'+E(n.title)+'</h4><p>'+E(n.body)+'</p><small>'+E(time(n.createdAt))+'</small><div class="classroom-notice-actions"><button type="button" data-notice-open="'+E(n.id)+'">Open '+(n.destination==='tests'?'Tests':n.destination==='myresults'?'My Results':'Home')+'</button>'+(n.read?'':'<button type="button" data-notice-read="'+E(n.id)+'">Mark read</button>')+'</div></div></article>').join('')+'</div>':'<div class="classroom-notice-empty"><strong>All caught up</strong><p>New classroom updates and published results will appear here.</p></div>')+
 '<div class="classroom-push-settings" id="classroom-push-settings"></div><div class="classroom-notice-foot">Notifications stay here, and phone alerts can be enabled on supported devices.</div>';
 renderPushSettings();
}
async function load(force=false){
 const api=window.classroomTestUploads;if(!api||loading||(!force&&Date.now()-lastFetch<60000))return;
 loading=true;try{const data=await api.notifications();items=Array.isArray(data.notices)?data.notices:[];ready=true;lastFetch=Date.now();draw()}catch(err){if(open&&node())node().innerHTML='<div class="classroom-notice-empty"><strong>Notifications unavailable</strong><p>'+E(api.error(err))+'</p><button data-notice-retry type="button">Retry</button></div>'}finally{loading=false}
}
function toggle(){open=!open;draw();if(open){load(true);pushStatus()}}
function close(){if(open){open=false;draw()}}
async function markRead(id){
 const n=items.find(x=>x.id===id);if(!n||n.read)return;
 try{await window.classroomTestUploads.readNotification(id);n.read=true;draw()}catch(err){console.warn('Unable to mark notice read',err)}
}
function navigate(id){const n=items.find(x=>x.id===id);if(!n)return;markRead(id);close();window.classroomSetSection?.(n.destination||'home')}
document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-push-toggle],[data-notice-open],[data-notice-read],[data-notice-close],[data-notice-retry],#classroom-notice-button');
 if(btn){if(btn.hasAttribute('data-push-toggle')){togglePhonePush();return}
 if(btn.id==='classroom-notice-button'){toggle();return}
 if(btn.hasAttribute('data-notice-close')){close();return}
 if(btn.hasAttribute('data-notice-retry')){load(true);return}
 if(btn.hasAttribute('data-notice-read')){markRead(btn.dataset.noticeRead);return}
 if(btn.hasAttribute('data-notice-open')){navigate(btn.dataset.noticeOpen);return}}
 if(open&&!e.target.closest('.classroom-notice-wrap'))close();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
window.addEventListener('classroom-test-uploads-ready',()=>load(true));
window.addEventListener('classroom-auth-ready',()=>load(true));
window.addEventListener('classroom-auth-ready',()=>pushStatus());
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(true)});
window.addEventListener('classroom-result-published',()=>load(true));
window.classroomNotificationsRefresh=()=>load(true);
window.classroomNotificationsStart=()=>{draw();load(true)};
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',event=>{if(event.data?.type==='classroom-push-received')load(true)});
window.setInterval(()=>{if(!document.hidden)load()},120000);
})();
