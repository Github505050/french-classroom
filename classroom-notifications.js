/* Private, in-app classroom notification centre. No browser push or background messaging. */
(function(){
'use strict';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let items=[],open=false,loading=false,lastFetch=0,ready=false;
const node=()=>document.getElementById('classroom-notice-popover');
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
 '<div class="classroom-notice-foot">Notices appear while you use the classroom. Browser push is not enabled.</div>';
}
async function load(force=false){
 const api=window.classroomTestUploads;if(!api||loading||(!force&&Date.now()-lastFetch<60000))return;
 loading=true;try{const data=await api.notifications();items=Array.isArray(data.notices)?data.notices:[];ready=true;lastFetch=Date.now();draw()}catch(err){if(open&&node())node().innerHTML='<div class="classroom-notice-empty"><strong>Notifications unavailable</strong><p>'+E(api.error(err))+'</p><button data-notice-retry type="button">Retry</button></div>'}finally{loading=false}
}
function toggle(){open=!open;draw();if(open)load(true)}
function close(){if(open){open=false;draw()}}
async function markRead(id){
 const n=items.find(x=>x.id===id);if(!n||n.read)return;
 try{await window.classroomTestUploads.readNotification(id);n.read=true;draw()}catch(err){console.warn('Unable to mark notice read',err)}
}
function navigate(id){const n=items.find(x=>x.id===id);if(!n)return;markRead(id);close();window.classroomSetSection?.(n.destination||'home')}
document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-notice-open],[data-notice-read],[data-notice-close],[data-notice-retry],#classroom-notice-button');
 if(btn){if(btn.id==='classroom-notice-button'){toggle();return}
 if(btn.hasAttribute('data-notice-close')){close();return}
 if(btn.hasAttribute('data-notice-retry')){load(true);return}
 if(btn.hasAttribute('data-notice-read')){markRead(btn.dataset.noticeRead);return}
 if(btn.hasAttribute('data-notice-open')){navigate(btn.dataset.noticeOpen);return}}
 if(open&&!e.target.closest('.classroom-notice-wrap'))close();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
window.addEventListener('classroom-test-uploads-ready',()=>load(true));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load(true)});
window.addEventListener('classroom-result-published',()=>load(true));
window.classroomNotificationsRefresh=()=>load(true);
window.classroomNotificationsStart=()=>{draw();load(true)};
window.setInterval(()=>{if(!document.hidden)load()},120000);
})();
