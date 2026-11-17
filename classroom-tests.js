/* Classroom notebook tests: question-only content; never bundle private marking keys. */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const sectionList=t=>Array.isArray(t.sections)?t.sections:[{id:'questions',title:'Questions',instructions:'',questions:t.questions||[]}];
const allQuestions=t=>sectionList(t).flatMap(s=>s.questions||[]);
let tests=[],loaded=false,active=null,uploadedCount=0,uploadBusy=false;
function copyText(t){
 const lines=['FRENCH CLASSROOM — HANDWRITTEN TEST CORRECTION','TEST: '+t.title,'TOTAL: '+(t.maxMarks??'Not specified')+' marks','QUESTIONS: '+allQuestions(t).length,'STUDENT INSTRUCTIONS: '+(t.studentInstructions||'Answer independently in a notebook.'),
 'AI EXAMINER: The student will attach notebook photographs. Do not examine, correct, grade or reveal answers until they explicitly say ALL PHOTOS UPLOADED. Read handwritten responses carefully and match each answer to its question ID and section below. Do not infer illegible answers. Preserve the marking criteria of each section; accept natural correct alternatives, and identify missed accents, articles, gender, agreements, verb endings, prepositions, spelling and sentence structure. For Test 2, assess oral-style prompts as written responses when the test instructions explicitly say so; otherwise assess oral sections from teacher-observed speaking performance. The full translation and story need human review. Show section scores, total out of '+(t.maxMarks??'the stated maximum')+', concise corrections, recurring patterns, and targeted practice. Do not present model answers before the student completes the test.','ORIGINAL QUESTIONS:'];
 for(const s of sectionList(t)){lines.push('SECTION: '+s.title+' — '+(s.maxMarks??'?')+' marks','INSTRUCTIONS: '+(s.instructions||''));for(const q of s.questions||[]){lines.push(q.id+' ('+(q.marks??q.points??'?')+' marks): '+(q.prompt||''));if(Array.isArray(q.options))q.options.forEach((v,i)=>lines.push('   '+String.fromCharCode(65+i)+'. '+v))}}
 return lines.join('\n');
}
function copyToClipboard(value,btn){
 const done=()=>{const old=btn.textContent;btn.textContent='✓ Copied';setTimeout(()=>{if(btn.isConnected)btn.textContent=old},2200)};
 if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).then(done,()=>fallback());
 else fallback();
 function fallback(){const a=document.createElement('textarea');a.value=value;a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();const ok=document.execCommand('copy');a.remove();if(ok)done();else alert('Unable to copy. Check your browser permissions.')}
}
window.classroomTestCopyText=copyText;
window.classroomCopyTestQuestions=(id,btn)=>{const t=tests.find(x=>x.id===id);if(t)copyToClipboard(copyText(t),btn)};
function entry(t){
 return '<article class="classroom-test-card"><div class="classroom-test-meta">'+sectionList(t).length+' sections · '+allQuestions(t).length+' questions'+(t.maxMarks?' · '+esc(t.maxMarks)+' marks':'')+'</div><h3>'+esc(t.title)+'</h3><p>'+esc(t.description||t.recommendedMode||'Complete the assessment using your notebook.')+'</p><div class="classroom-test-bottom"><span class="classroom-test-status">Notebook assessment</span><button class="btn primary" type="button" data-test-open="'+esc(t.id)+'">View test</button></div></article>';
}
function list(){return '<section class="classroom-tests"><div class="classroom-tests-hero"><div class="eyebrow">FRENCH CLASSROOM</div><h2>Tests & Assessments</h2><p>Read the questions here. Write the answers in your notebook.</p></div><div class="classroom-tests-toolbar"><strong>Available tests</strong><span>'+tests.length+' published</span></div>'+(tests.length?'<div class="classroom-tests-grid">'+tests.map(entry).join('')+'</div>':'<div class="classroom-tests-empty"><h3>No tests published yet</h3><p>Your teacher will add assessments here.</p></div>')+'</section>'}
function question(q,i){
 const choices=Array.isArray(q.options)?'<div class="classroom-test-options">'+q.options.map((o,j)=>'<div class="classroom-test-choice"><strong>'+String.fromCharCode(65+j)+'.</strong> '+esc(o)+'</div>').join('')+'</div>':'';
 return '<article class="classroom-test-question"><div class="classroom-test-meta">'+esc(q.id||'Question '+(i+1))+' · '+esc(q.marks??q.points??1)+' marks</div><h3 class="classroom-test-prompt">'+esc(q.prompt||'').replace(/\n/g,'<br>')+'</h3>'+choices+'</article>';
}
function section(s){
 return '<section class="classroom-test-section" id="classroom-test-section-'+esc(s.id)+'"><div class="classroom-test-section-head"><span class="classroom-test-meta">SECTION</span><h3>'+esc(s.title)+'</h3><span class="pill">'+esc(s.maxMarks)+' marks · '+(s.questions||[]).length+' questions</span><p>'+esc(s.instructions||'')+'</p></div><div class="classroom-test-questions">'+(s.questions||[]).map(question).join('')+'</div></section>';
}
function detail(t){
 const sections=sectionList(t);
 return '<section class="classroom-tests classroom-notebook-test"><div class="classroom-notebook-actions"><button class="btn" type="button" data-test-back>← All tests</button></div><div class="classroom-tests-hero"><div class="eyebrow">A1 ASSESSMENT · '+sections.length+' SECTIONS</div><h2>'+esc(t.title)+'</h2><p>'+allQuestions(t).length+' questions · '+esc(t.maxMarks||'')+' marks</p></div><div class="hint"><strong>Test instructions:</strong> '+esc(t.studentInstructions||'Write all answers in your notebook and use the exact question numbers.')+'<p class="small">'+esc(t.recommendedMode||'')+'</p></div><nav class="classroom-test-section-nav" aria-label="Test sections">'+sections.map((s,i)=>'<a href="#classroom-test-section-'+esc(s.id)+'">'+(i+1)+'. '+esc(s.title)+'</a>').join('')+'</nav>'+sections.map(section).join('')+'<div class="classroom-notebook-end">End of test · Submit the photos of your numbered notebook answers to your teacher.</div><section class="classroom-test-upload"><h3>Submit notebook photos</h3><p>Upload 1–8 clear photos of your numbered answers (JPEG, PNG or WebP; up to 8 MB each). You may add more photos later, up to 8 pages TOTAL for this test. Only your teacher can remove submitted photos.</p><input hidden type="file" id="test-photo-input" accept="image/jpeg,image/png,image/webp" multiple><button class="btn primary classroom-test-upload-action" type="button" data-test-upload>Upload notebook photos</button><p id="test-photo-count" class="muted">Choose 1–8 clear notebook photos; upload starts after selection.</p><p role="status" id="test-upload-status" class="muted"></p><div id="test-upload-history"></div></section><div class="classroom-test-results-note"><strong>Looking for your grades?</strong><span>Published marks and teacher feedback are available in the separate My Results section.</span></div></section>';
}
function draw(){const el=document.getElementById('classroom-tests-root');if(el){el.innerHTML=active?detail(active):list();if(active)history(active.id)}}
async function load(){try{const r=await fetch('./tests.json',{cache:'no-store'});if(!r.ok)throw Error('Unavailable');const d=await r.json();tests=Array.isArray(d.tests)?d.tests.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&(Array.isArray(x.sections)||Array.isArray(x.questions))):[];loaded=true;draw()}catch{loaded=true;const el=document.getElementById('classroom-tests-root');if(el)el.innerHTML='<div class="notice">Tests could not be loaded. Please refresh.</div>'}}
async function history(id){
 const el=document.getElementById('test-upload-history'),api=window.classroomTestUploads;
 if(!el)return;
 if(!api){el.textContent='The private upload service is unavailable.';return}
 try{
  const rows=await api.mine(id);
  if(!el.isConnected||active?.id!==id)return;
  const count=rows.reduce((n,r)=>n+(Number(r.pageCount)||0),0);
  uploadedCount=count;
  const button=document.querySelector('#classroom-tests-root [data-test-upload]');
  if(button){button.disabled=count>=8||uploadBusy;button.textContent=count>=8?'8 of 8 photos submitted':'Add notebook photos ('+Math.max(0,8-count)+' slots left)'}
  const hint=document.getElementById('test-photo-count');
  if(hint)hint.textContent=count+' / 8 photos submitted. '+(count>=8?'Limit reached. Ask your teacher to remove an old photo before uploading new ones.':'You can upload '+(8-count)+' more photo(s).');
  if(!rows.length){el.innerHTML='<p class="muted">No notebook photos submitted yet.</p>';return}
  el.innerHTML='<div class="classroom-upload-history-head"><strong>My submitted notebook photos</strong><span>'+count+' / 8 pages</span></div><p class="muted">Tap any photo to view the full page. Submitted photos cannot be deleted by students; contact your teacher if a page needs replacing.</p><div id="classroom-my-photo-grid" class="classroom-my-photo-grid"><p class="muted">Loading your submitted photos…</p></div>';
  const galleries=await Promise.all(rows.map(async(row)=>{
   try{return {row,urls:await api.urls(row)}}catch{return {row,urls:[]}}
  }));
  if(!el.isConnected||active?.id!==id)return;
  const grid=document.getElementById('classroom-my-photo-grid');
  if(!grid)return;
  let number=0;
  grid.innerHTML=galleries.map(({row,urls})=>(urls.length?urls.map(url=>{
   const page=++number;
   return '<a class="classroom-my-photo" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer"><img src="'+esc(url)+'" loading="lazy" alt="Your uploaded notebook page '+page+'"><span>Page '+page+' · View</span></a>'
  }).join(''):'<p class="muted">Some photos are temporarily unavailable. Refresh this page to retry.</p>')).join('');
 }catch(e){if(el.isConnected)el.textContent='Submissions unavailable: '+api.error(e)}
}
window.addEventListener('classroom-test-uploads-ready',()=>{if(active)history(active.id)});
window.addEventListener('focus',()=>{if(active&&document.getElementById('test-upload-history'))history(active.id)});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active&&document.getElementById('test-upload-history'))history(active.id)});


window.classroomTestsView=function(){active=null;queueMicrotask(()=>{if(!loaded)load();else draw()});return '<div id="classroom-tests-root" aria-live="polite"><p class="muted">Loading tests…</p></div>'};
async function uploadSelectedPhotos(input){
 const api=window.classroomTestUploads,status=document.getElementById('test-upload-status'),btn=document.querySelector('#classroom-tests-root [data-test-upload]');
 if(!status||!btn||!active)return;
 if(!api){status.textContent='The private upload service is not ready.';return}
 if(!input?.files?.length)return;
 if(uploadedCount+input.files.length>8){
  status.textContent='You have '+uploadedCount+' photos already. Select at most '+Math.max(0,8-uploadedCount)+' more. Only your teacher can remove previously submitted photos.';
  input.value='';return;
 }
 uploadBusy=true;
 btn.disabled=true;status.textContent='Uploading notebook photos…';
 try{
  const result=await api.upload(active.id,input.files,(n,total)=>{if(status.isConnected)status.textContent='Uploaded '+n+' of '+total+' photos…'});
  uploadedCount=Math.min(8,uploadedCount+result.pageCount);
  if(status.isConnected)status.textContent='✓ '+result.pageCount+' notebook photo(s) submitted securely.';
  input.value='';const counter=document.getElementById('test-photo-count');
  if(counter)counter.textContent='Upload complete. Updating your notebook gallery…';
  history(active.id);
 }catch(err){if(status.isConnected)status.textContent='Upload failed: '+api.error(err)}
 finally{uploadBusy=false;if(btn.isConnected)btn.disabled=uploadedCount>=8}
}
document.addEventListener('change',e=>{if(e.target.id==='test-photo-input')uploadSelectedPhotos(e.target)});
document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-test-open],[data-test-back],[data-test-upload]');
 if(!btn||!btn.closest('#classroom-tests-root'))return;
 if(btn.hasAttribute('data-test-back')){active=null;draw();return}
 if(btn.hasAttribute('data-test-open')){active=tests.find(t=>t.id===btn.dataset.testOpen)||null;draw();return}
 if(btn.hasAttribute('data-test-upload')&&active)document.getElementById('test-photo-input')?.click();
});
})();
