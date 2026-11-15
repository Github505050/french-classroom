/* Teacher-published notebook tests. Display questions only: no student answer entry, grading or answer keys. */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let tests=[],loaded=false,active=null;
function copyText(t){const lines=['FRENCH CLASSROOM — NOTEBOOK TEST REVIEW','Test: '+t.title,t.description||'','INSTRUCTIONS FOR AI EXAMINER:','I will attach photos of my handwritten notebook answers. Do not correct or grade until I say ALL PHOTOS UPLOADED.','Match each numbered handwritten response to the original questions below. Correct French grammar, vocabulary, gender, agreements, accents, spelling and sentence structure. Accept valid equivalents. Do not invent illegible answers. Give question-by-question feedback, corrections, a score only where scoring criteria exist, and targeted revision.','ORIGINAL TEST QUESTIONS:'];t.questions.forEach((q,i)=>{lines.push((i+1)+'. '+(q.prompt||''));(q.options||[]).forEach((o,j)=>lines.push('  '+String.fromCharCode(65+j)+'. '+o))});return lines.join('\n')}
function copyToClipboard(value,btn){if(navigator.clipboard?.writeText){navigator.clipboard.writeText(value).then(()=>{btn.textContent='✓ Copied'},()=>alert('Copy unavailable. Try a browser with clipboard permission.'))}else{const a=document.createElement('textarea');a.value=value;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();btn.textContent='✓ Copied'}}
window.classroomTestCopyText=copyText;
window.classroomCopyTestQuestions=(id,btn)=>{const t=tests.find(x=>x.id===id);if(t)copyToClipboard(copyText(t),btn)};

function entry(t){
 return '<article class="classroom-test-card"><div class="classroom-test-meta">'+esc(t.category||'Assessment')+' · '+t.questions.length+' questions'+(t.durationMinutes?' · '+esc(t.durationMinutes)+' min':'')+'</div><h3>'+esc(t.title)+'</h3><p>'+esc(t.description||'Complete this test in your notebook.')+'</p><div class="classroom-test-bottom"><span class="classroom-test-status">Notebook test</span><button class="btn primary" type="button" data-test-open="'+esc(t.id)+'">View questions</button></div></article>';
}
function list(){
 return '<section class="classroom-tests"><div class="classroom-tests-hero"><div class="eyebrow">FRENCH CLASSROOM</div><h2>Tests & Assessments</h2><p>Read the questions here. Write all your answers in your notebook.</p></div><div class="classroom-tests-toolbar"><strong>Available tests</strong><span>'+tests.length+' published</span></div>'+(tests.length?'<div class="classroom-tests-grid">'+tests.map(entry).join('')+'</div>':'<div class="classroom-tests-empty"><h3>No tests published yet</h3><p>Your teacher will add assessments here. Your lessons and progress remain available as usual.</p></div>')+'</section>';
}
function question(q,i){
 const choices=q.type==='multiple-choice'&&Array.isArray(q.options)?'<div class="classroom-test-options">'+q.options.map((op,j)=>'<div class="classroom-test-choice"><strong>'+String.fromCharCode(65+j)+'.</strong> '+esc(op)+'</div>').join('')+'</div>':'';
 return '<article class="classroom-test-question"><div class="classroom-test-meta">QUESTION '+(i+1)+(q.points!==undefined?' · '+esc(q.points)+' points':'')+'</div><h3>'+esc(q.prompt||'')+'</h3>'+choices+'</article>';
}
function detail(t){
 return '<section class="classroom-tests classroom-notebook-test"><div class="classroom-notebook-actions"><button class="btn" type="button" data-test-back>← All tests</button><button class="btn" type="button" data-test-print>Print questions</button><button class="btn" type="button" data-test-copy>Copy questions for AI</button></div><div class="classroom-tests-hero"><div class="eyebrow">'+esc(t.category||'Assessment')+'</div><h2>'+esc(t.title)+'</h2><p>'+esc(t.description||'')+'</p></div><div class="hint"><strong>Instructions:</strong> Answer every question in your notebook. Write the question number beside each answer. This test does not show correct answers or grade your work.</div><div class="classroom-test-questions">'+t.questions.map(question).join('')+'</div><div class="classroom-notebook-end">End of test · Upload your notebook photos to your teacher.</div><section class="classroom-test-upload"><h3>Submit notebook photos</h3><p>Upload 1–8 clear photos of your numbered answers (JPEG, PNG or WebP; maximum 8 MB each).</p><input class="field" type="file" id="test-photo-input" accept="image/jpeg,image/png,image/webp" multiple><p id="test-photo-count" class="muted"></p><button class="btn primary" type="button" data-test-upload>Upload my notebook</button><p role="status" id="test-upload-status" class="muted"></p><div id="test-upload-history"></div></section><button class="btn" type="button" data-test-copy>Copy questions for AI checking</button></section>';
}
function draw(){const el=document.getElementById('classroom-tests-root');if(el){el.innerHTML=active?detail(active):list();if(active)history(active.id)}}
async function load(){
 try{const r=await fetch('./tests.json',{cache:'no-store'});if(!r.ok)throw Error('Unavailable');const d=await r.json();tests=Array.isArray(d.tests)?d.tests.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&Array.isArray(x.questions)):[];loaded=true;draw()}
 catch{loaded=true;const el=document.getElementById('classroom-tests-root');if(el)el.innerHTML='<div class="notice">Tests could not be loaded. Please refresh this page.</div>'}
}
async function history(id){const el=document.getElementById('test-upload-history'),api=window.classroomTestUploads;if(!el)return;if(!api){el.textContent='Photo uploads require Firebase Storage setup.';return}try{const rows=await api.mine(id);if(el.isConnected&&active?.id===id)el.textContent=rows.length?rows.length+' notebook submission(s) received.':'No notebook photos submitted yet.'}catch(e){if(el.isConnected)el.textContent='Submissions unavailable: '+api.error(e)}}
window.addEventListener('classroom-test-uploads-ready',()=>{if(active)history(active.id)});
window.classroomTestsView=function(){active=null;queueMicrotask(()=>{if(!loaded)load();else draw()});return '<div id="classroom-tests-root" aria-live="polite"><p class="muted">Loading tests…</p></div>'};
document.addEventListener('change',e=>{if(e.target.id==='test-photo-input'){const el=document.getElementById('test-photo-count');if(el)el.textContent=(e.target.files?.length||0)+' selected photo(s)'}});
document.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-test-open],[data-test-back],[data-test-print],[data-test-copy],[data-test-upload]');if(!btn||!btn.closest('#classroom-tests-root'))return;
 if(btn.hasAttribute('data-test-back')){active=null;draw();return}
 if(btn.hasAttribute('data-test-open')){active=tests.find(t=>t.id===btn.dataset.testOpen)||null;draw();return}
 if(btn.hasAttribute('data-test-print')){window.print();return}
if(btn.hasAttribute('data-test-copy')&&active){copyToClipboard(copyText(active),btn);return}
if(btn.hasAttribute('data-test-upload')&&active){
 const api=window.classroomTestUploads,input=document.getElementById('test-photo-input'),label=document.getElementById('test-upload-status');
 if(!api){label.textContent='Firebase Storage is not ready.';return}
 if(!input?.files?.length){label.textContent='Please select your notebook photos.';return}
 btn.disabled=true;label.textContent='Uploading…';
 try{const result=await api.upload(active.id,input.files,(n,total)=>{label.textContent='Uploaded '+n+' of '+total+' photos…'});label.textContent='✓ '+result.pageCount+' notebook photos submitted.';input.value='';history(active.id)}
 catch(err){label.textContent='Upload failed: '+api.error(err)}
 finally{btn.disabled=false}
}
});
})();
