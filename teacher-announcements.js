/* Teacher-only announcement composer. Authorization enforced server-side. */
(function(){
'use strict';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let posts=[],busy=false;
const root=()=>document.getElementById('teacher-announcements-root');
function draw(){
 const el=root();if(!el)return;
 const archive=posts.map(p=>'<article class="teacher-notice-row"><div><small>'+E(p.kind)+' · '+new Date(p.created_at).toLocaleDateString()+' · '+(p.active?'Published':'Archived')+'</small><strong>'+E(p.title)+'</strong><p>'+E(p.body)+'</p></div>'+(p.active?'<button type="button" class="btn" data-teacher-notice-archive="'+E(p.id)+'">Archive</button>':'')+'</article>').join('');
 el.innerHTML='<div class="teacher-notices-shell"><header class="teacher-notices-head"><span class="tp-kicker">CLASSROOM COMMUNICATION</span><h2>Announcements</h2><p>Send news, test reminders and classroom updates to students.</p></header><div class="teacher-notices-grid"><section class="teacher-notices-compose"><h3>New announcement</h3><form id="teacher-notice-form"><label>Title<input id="teacher-notice-title" class="field" maxlength="120" required placeholder="e.g. New French test available"></label><label>Message<textarea id="teacher-notice-body" class="field" maxlength="1200" rows="5" required placeholder="Write your message for students…"></textarea></label><div class="teacher-notices-fields"><label>Category<select id="teacher-notice-kind" class="field"><option value="general">Class announcement</option><option value="test">New test</option><option value="reminder">Reminder</option></select></label><label>Open page<select id="teacher-notice-destination" class="field"><option value="home">Homepage</option><option value="tests">Tests</option><option value="myresults">My Results</option></select></label></div><div class="teacher-notices-tools"><button class="btn" type="button" data-notice-template="test">New test template</button><button class="btn" type="button" data-notice-template="reminder">Reminder template</button><button class="btn" type="button" data-notice-template="results">Results available template</button><button class="btn primary" type="submit">Publish to students</button></div><p id="teacher-notice-status" role="status"></p></form></section><section class="teacher-notices-published"><div class="teacher-notices-list-head"><h3>Message history</h3><button class="btn" type="button" data-teacher-notice-refresh>Refresh</button></div><div>'+ (archive||'<p class="muted">No announcements published yet.</p>') +'</div></section></div><p class="teacher-notices-disclaimer">Published marks generate private result notifications automatically. Class announcements go to all signed-in students. These are in-app notices, not phone push notifications.</p></div>';
}
async function load(){
 if(!root()||!window.classroomIsTeacher||busy)return;
 const el=root(),api=window.classroomTestUploads;busy=true;el.innerHTML='<p class="muted">Loading announcements…</p>';
 try{if(!api)throw Error('Connection is loading');posts=(await api.teacherAnnouncements()).posts||[];draw()}
 catch(err){el.innerHTML='<div class="notice">Unable to load announcements: '+E(api?.error(err)||String(err))+' <button class="btn" data-teacher-notice-refresh>Retry</button></div>'}
 finally{busy=false}
}
window.classroomTeacherAnnouncementsView=()=>{queueMicrotask(load);return '<div id="teacher-announcements-root">Loading announcements…</div>'};
window.addEventListener('classroom-test-uploads-ready',()=>{if(root())load()});
document.addEventListener('click',e=>{
 const b=e.target.closest('[data-notice-template],[data-teacher-notice-refresh],[data-teacher-notice-archive]');if(!b||!b.closest('#teacher-portal')||!window.classroomIsTeacher)return;
 if(b.hasAttribute('data-teacher-notice-refresh')){load();return}
 if(b.hasAttribute('data-notice-template')){
  const kind=b.dataset.noticeTemplate;
  const templates={
   test:{title:'New French test available',body:'A new assessment is available in Tests. Complete it in your notebook, then upload clear photos of your answers.',category:'test',destination:'tests'},
   reminder:{title:'Reminder: Complete your French test',body:'Please finish your assigned French test and upload your notebook photos in Tests.',category:'reminder',destination:'tests'},
   results:{title:'French test results are available',body:'Your latest French test results are now available. Open My Results to view your marks, teacher feedback and corrections. Review your mistakes before the next lesson.',category:'general',destination:'myresults'}
  };
  const template=templates[kind];if(!template)return;
  document.getElementById('teacher-notice-title').value=template.title;
  document.getElementById('teacher-notice-body').value=template.body;
  document.getElementById('teacher-notice-kind').value=template.category;
  document.getElementById('teacher-notice-destination').value=template.destination;
 }
 if(b.hasAttribute('data-teacher-notice-archive')){
  if(!confirm('Archive this announcement? Students will no longer see it.'))return;
  b.disabled=true;window.classroomTestUploads.retireAnnouncement(b.dataset.teacherNoticeArchive).then(()=>{window.classroomNotificationsRefresh?.();load()}).catch(err=>{b.disabled=false;alert(window.classroomTestUploads.error(err))});
 }
});
document.addEventListener('submit',async e=>{
 if(e.target.id!=='teacher-notice-form'||!window.classroomIsTeacher)return;e.preventDefault();
 const btn=e.target.querySelector('[type=submit]'),status=document.getElementById('teacher-notice-status');
 const title=document.getElementById('teacher-notice-title').value,body=document.getElementById('teacher-notice-body').value,kind=document.getElementById('teacher-notice-kind').value,destination=document.getElementById('teacher-notice-destination').value;
 btn.disabled=true;status.textContent='Publishing…';
 try{await window.classroomTestUploads.publishAnnouncement(title,body,kind,destination);window.classroomNotificationsRefresh?.();await load()}
 catch(err){btn.disabled=false;status.textContent='Unable to publish: '+window.classroomTestUploads.error(err)}
});
})();
