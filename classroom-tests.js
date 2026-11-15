/* Teacher-published notebook tests. Display questions only: no student answer entry, grading or answer keys. */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let tests=[],loaded=false,active=null;
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
 return '<section class="classroom-tests classroom-notebook-test"><div class="classroom-notebook-actions"><button class="btn" type="button" data-test-back>← All tests</button><button class="btn" type="button" data-test-print>Print questions</button></div><div class="classroom-tests-hero"><div class="eyebrow">'+esc(t.category||'Assessment')+'</div><h2>'+esc(t.title)+'</h2><p>'+esc(t.description||'')+'</p></div><div class="hint"><strong>Instructions:</strong> Answer every question in your notebook. Write the question number beside each answer. This test does not show correct answers or grade your work.</div><div class="classroom-test-questions">'+t.questions.map(question).join('')+'</div><div class="classroom-notebook-end">End of test · Submit your notebook to your teacher for correction.</div></section>';
}
function draw(){const el=document.getElementById('classroom-tests-root');if(el)el.innerHTML=active?detail(active):list()}
async function load(){
 try{const r=await fetch('./tests.json',{cache:'no-store'});if(!r.ok)throw Error('Unavailable');const d=await r.json();tests=Array.isArray(d.tests)?d.tests.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'&&Array.isArray(x.questions)):[];loaded=true;draw()}
 catch{loaded=true;const el=document.getElementById('classroom-tests-root');if(el)el.innerHTML='<div class="notice">Tests could not be loaded. Please refresh this page.</div>'}
}
window.classroomTestsView=function(){active=null;queueMicrotask(()=>{if(!loaded)load();else draw()});return '<div id="classroom-tests-root" aria-live="polite"><p class="muted">Loading tests…</p></div>'};
document.addEventListener('click',e=>{
 const btn=e.target.closest('[data-test-open],[data-test-back],[data-test-print]');if(!btn||!btn.closest('#classroom-tests-root'))return;
 if(btn.hasAttribute('data-test-back')){active=null;draw();return}
 if(btn.hasAttribute('data-test-open')){active=tests.find(t=>t.id===btn.dataset.testOpen)||null;draw();return}
 if(btn.hasAttribute('data-test-print'))window.print();
});
})();
