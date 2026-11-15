/* Teacher assessment submissions are only queried after teacher authentication. */
(function(){
'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let submissions=[],tests=[],loaded=false,loading=false,error='';
async function refresh(){
 const el=document.getElementById('teacher-tests-content'),api=window.classroomTestUploads;
 if(!el||!window.classroomIsTeacher)return;
 if(!api){el.innerHTML='<p class="muted">Firebase connection is loading…</p>';return}
 if(loading)return;
 loading=true;el.innerHTML='<p class="muted">Loading notebook submissions…</p>';
 try{
  const [items,source]=await Promise.all([api.teacherList(),fetch('./tests.json',{cache:'no-store'}).then(r=>r.json())]);
  submissions=items;tests=Array.isArray(source.tests)?source.tests:[];error='';loaded=true;
 }catch(e){error=api.error(e);loaded=false}
 finally{loading=false;draw()}
}
function draw(){
 const el=document.getElementById('teacher-tests-content');if(!el)return;
 if(error){el.innerHTML='<p class="notice">Submissions unavailable: '+E(error)+'. Verify Firebase Storage and Firestore rules are published.</p>';return}
 const library='<section class="tp-card"><h3>Published tests</h3><p class="muted">Copy the original questions and AI correction instructions for notebook checking.</p>'+(tests.length?tests.map(t=>'<div class="teacher-test-row"><strong>'+E(t.title)+'</strong> <button type="button" class="btn" data-teacher-copy="'+E(t.id)+'">Copy questions for AI</button></div>').join(''):'<p>No tests published yet.</p>')+'</section>';
 const cards=submissions.length?submissions.map(s=>'<article class="tp-card teacher-submission"><div class="teacher-submission-title"><div><span class="tp-kicker">NOTEBOOK SUBMISSION</span><h3>'+E(tests.find(t=>t.id===s.testId)?.title||s.testId)+'</h3><p>'+E(s.studentEmail||'Student')+' · '+E(s.pageCount||0)+' photo(s) · '+E(s.submittedAt?.toDate?.()?.toLocaleString()||'Recently submitted')+'</p></div><button class="btn" data-teacher-copy="'+E(s.testId)+'">Copy questions for AI</button></div><div class="teacher-submission-photos" data-teacher-photos="'+E(s.id)+'"><button type="button" class="btn" data-teacher-view="'+E(s.id)+'">View notebook photos</button></div></article>').join(''):'<section class="tp-card"><p>No notebook photo submissions yet.</p></section>';
 el.innerHTML='<div class="teacher-tests-toolbar"><h3>Notebook submissions ('+submissions.length+')</h3><button class="btn" type="button" data-teacher-tests-refresh>Refresh submissions</button></div>'+cards+library;
}
window.addEventListener('classroom-test-uploads-ready',()=>{if(document.getElementById('teacher-tests-content'))refresh()});
window.classroomTeacherTestsView=function(){queueMicrotask(()=>{if(!loaded)refresh();else draw()});return '<div class="teacher-tests-area" id="teacher-tests-content"><p class="muted">Loading notebook submissions…</p></div>'};
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-teacher-tests-refresh],[data-teacher-copy],[data-teacher-view]');if(!b||!b.closest('#teacher-portal')||!window.classroomIsTeacher)return;
 if(b.hasAttribute('data-teacher-tests-refresh')){loaded=false;refresh();return}
 if(b.hasAttribute('data-teacher-copy')){
  const test=tests.find(t=>t.id===b.dataset.teacherCopy);if(!test){alert('Test questions are not published.');return}
  const make=window.classroomTestCopyText;
  const copy=make?make(test):['Notebook test: '+test.title,'Wait until ALL PHOTOS UPLOADED before correcting. Compare numbered notebook answers to the questions; correct errors and give targeted feedback.',...test.questions.map((q,i)=>(i+1)+'. '+q.prompt)].join('\n');
  try{await navigator.clipboard.writeText(copy);b.textContent='✓ Copied'}catch{alert('Clipboard permission unavailable.')}
  return;
 }
 if(b.hasAttribute('data-teacher-view')){
  const s=submissions.find(row=>row.id===b.dataset.teacherView),target=b.parentElement;
  if(!s||!target)return;
  b.disabled=true;b.textContent='Opening photos…';
  try{const urls=await window.classroomTestUploads.urls(s);target.innerHTML=urls.map((url,i)=>'<a href="'+E(url)+'" target="_blank" rel="noopener noreferrer" class="teacher-notebook-photo"><img src="'+E(url)+'" loading="lazy" alt="Notebook page '+(i+1)+'"><span>Open page '+(i+1)+' in full size</span></a>').join('')}
  catch(err){b.disabled=false;b.textContent='Retry opening photos';alert('Unable to read notebook images: '+window.classroomTestUploads.error(err))}
 }
});
})();
