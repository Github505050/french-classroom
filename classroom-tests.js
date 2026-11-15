/* Classroom notebook tests: question-only content; never bundle private marking keys. */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const sectionList=t=>Array.isArray(t.sections)?t.sections:[{id:'questions',title:'Questions',instructions:'',questions:t.questions||[]}];
const allQuestions=t=>sectionList(t).flatMap(s=>s.questions||[]);
let tests=[],loaded=false,active=null;
function copyText(t){
 const lines=['FRENCH CLASSROOM — HANDWRITTEN TEST CORRECTION','TEST: '+t.title,'TOTAL: '+(t.maxMarks??'Not specified')+' marks','QUESTIONS: '+allQuestions(t).length,'STUDENT INSTRUCTIONS: '+(t.studentInstructions||'Answer independently in a notebook.'),
 'AI EXAMINER: The student will attach notebook photographs. Do not examine, correct, grade or reveal answers until they explicitly say ALL PHOTOS UPLOADED. Read handwritten responses carefully and match each answer to its question ID and section below. Do not infer illegible answers. Preserve the marking criteria of each section; accept natural correct alternatives, and identify missed accents, articles, gender, agreements, verb endings, prepositions, spelling and sentence structure. The oral section must be assessed from teacher-observed oral performance, not merely handwritten responses. The full translation and story need human review. Show section scores, total out of '+(t.maxMarks??'the stated maximum')+', concise corrections, recurring patterns, and targeted practice. Do not present model answers before the student completes the test.','ORIGINAL QUESTIONS:'];
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
 return '<section class="classroom-tests classroom-notebook-test"><div class="classroom-notebook-actions"><button class="btn" type="button" data-test-back>← All tests</button></div><div class="classroom-tests-hero"><div class="eyebrow">A1 ASSESSMENT · '+sections.length+' SECTIONS</div><h2>'+esc(t.title)+'</h2><p>'+allQuestions(t).length+' questions · '+esc(t.maxMarks||'')+' marks</p></div><div class="hint"><strong>Test instructions:</strong> '+esc(t.studentInstructions||'Write all answers in your notebook and use the exact question numbers.')+'<p class="small">'+esc(t.recommendedMode||'')+'</p></div><nav class="classroom-test-section-nav" aria-label="Test sections">'+sections.map((s,i)=>'<a href="#classroom-test-section-'+esc(s.id)+'">'+(i+1)+'. '+esc(s.title)+'</a>').join('')+'</nav>'+sections.map(section).join('')+'<div class="classroom-notebook-end">End of test · Submit the photos of your numbered notebook answers to your teacher.</div><section class="classroom-test-upload"><h3>Submit notebook photos</h3><p>Upload 1–8 clear photos of your numbered answers (JPEG, PNG or WebP; up to 8 MB each). You can send additional pages in another submission.</p><input hidden type="file" id="test-photo-input" accept="image/jpeg,image/png,image/webp" multiple><button class="btn primary classroom-test-upload-action" type="button" data-test-upload>Upload notebook photos</button><p id="test-photo-count" class="muted">Choose 1–8 clear notebook photos; upload starts after selection.</p><p role="status" id="test-upload-status" class="muted"></p><div id="test-upload-history"></div></section><section id="test-student-result" class="classroom-student-result" aria-live="polite"><p class="muted">Checking for a published result…</p></section></section>';
}
function draw(){const el=document.getElementById('classroom-tests-root');if(el){el.innerHTML=active?detail(active):list();if(active){history(active.id);showResult(active)}}}
async function load(){try{const r=await fetch('./tests.json',{cache:'no-store'});if(!r.ok)throw Error('Unavailable');const d=await r.json();tests=Array.isArray(d.tests)?d.tests.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&(Array.isArray(x.sections)||Array.isArray(x.questions))):[];loaded=true;draw()}catch{loaded=true;const el=document.getElementById('classroom-tests-root');if(el)el.innerHTML='<div class="notice">Tests could not be loaded. Please refresh.</div>'}}
async function history(id){const el=document.getElementById('test-upload-history'),api=window.classroomTestUploads;if(!el)return;if(!api){el.textContent='The private upload service is unavailable.';return}try{const rows=await api.mine(id);if(el.isConnected&&active?.id===id)el.textContent=rows.length?rows.length+' notebook submission(s) received.':'No notebook photos submitted yet.'}catch(e){if(el.isConnected)el.textContent='Submissions unavailable: '+api.error(e)}}
async function showResult(test){
 const box=document.getElementById('test-student-result');if(!box)return;
 const api=window.classroomTestUploads;
 if(!api){box.innerHTML='<p class="muted">Your results will appear here after teacher review.</p>';return}
 try{
  const result=await api.result(test.id);
  if(!box.isConnected||active?.id!==test.id)return;
  if(!result||result.status!=='published'){
   box.innerHTML='<div class="classroom-result-pending"><span class="classroom-result-icon">◷</span><div><strong>Teacher review pending</strong><p>Your verified marks will appear here after your teacher publishes them.</p></div></div>';return
  }
  const sections=sectionList(test);
  const max=test.maxMarks||sections.reduce((n,s)=>n+(s.maxMarks||0),0);
  const percentage=max?Math.round(result.total/max*100):0;
  box.innerHTML='<div class="classroom-result-published"><span class="classroom-test-meta">TEACHER-VERIFIED RESULTS</span><h3>Your test results</h3><div class="classroom-result-score"><strong>'+esc(result.total)+' / '+esc(max)+'</strong><span>'+percentage+'%</span></div><div class="classroom-result-rows">'+sections.map(s=>'<div><span>'+esc(s.title)+'</span><strong>'+esc(result.sectionScores?.[s.id]??'—')+' / '+esc(s.maxMarks)+'</strong></div>').join('')+'</div>'+(result.feedback?'<div class="classroom-result-feedback"><strong>Teacher feedback</strong><p>'+esc(result.feedback).replace(/\\n/g,'<br>')+'</p></div>':'')+'<p class="muted small">Published by your teacher.</p></div>';
 }catch(err){if(box.isConnected)box.innerHTML='<p class="muted">Results are unavailable right now. '+esc(api.error(err))+'</p>'}
}
window.addEventListener('classroom-test-uploads-ready',()=>{if(active){history(active.id);showResult(active)}});

window.classroomTestsView=function(){active=null;queueMicrotask(()=>{if(!loaded)load();else draw()});return '<div id="classroom-tests-root" aria-live="polite"><p class="muted">Loading tests…</p></div>'};
async function uploadSelectedPhotos(input){
 const api=window.classroomTestUploads,status=document.getElementById('test-upload-status'),btn=document.querySelector('#classroom-tests-root [data-test-upload]');
 if(!status||!btn||!active)return;
 if(!api){status.textContent='The private upload service is not ready.';return}
 if(!input?.files?.length)return;
 btn.disabled=true;status.textContent='Uploading notebook photos…';
 try{
  const result=await api.upload(active.id,input.files,(n,total)=>{if(status.isConnected)status.textContent='Uploaded '+n+' of '+total+' photos…'});
  if(status.isConnected)status.textContent='✓ '+result.pageCount+' notebook photo(s) submitted securely.';
  input.value='';const counter=document.getElementById('test-photo-count');
  if(counter)counter.textContent='Upload complete. You may submit additional pages if needed.';
  history(active.id);
 }catch(err){if(status.isConnected)status.textContent='Upload failed: '+api.error(err)}
 finally{if(btn.isConnected)btn.disabled=false}
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
