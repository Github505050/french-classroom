/* Student My Results: a read-only private view of teacher-published test grades. */
(function(){
'use strict';
const E=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bounded=(n,a,b)=>Math.min(b,Math.max(a,n));
let tests=[],submissions={},grades={},selected=null,busy=false,loaded=false,error='',requestSerial=0;
const testFor=id=>tests.find(t=>t.id===id);
const points=t=>Number(t.maxMarks)||((t.sections||[]).reduce((n,s)=>n+(Number(s.maxMarks)||0),0));
const stamp=d=>{if(!d)return 'Date unavailable';const date=new Date(d);return Number.isNaN(date.getTime())?'Date unavailable':date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})};
const percentage=(n,total)=>total?bounded(Math.round(n/total*100),0,100):0;
const submission=id=>submissions[id]||null;
const grade=id=>grades[id]||null;
const completed=()=>tests.filter(t=>grade(t.id));
const cardState=t=>grade(t.id)?'graded':submission(t.id)?.count?'pending':'not-started';
const stateLabel=s=>({graded:'Results published',pending:'Awaiting review','not-started':'Not submitted'}[s]);
function icon(name){
 const common='stroke="currentColor" stroke-width="1.85" fill="none" stroke-linecap="round" stroke-linejoin="round"';
 const paths={award:'<path d="M12 15l-3.5 6-1-4-4 .5 4-7"/><path d="m12 15 3.5 6 1-4 4 .5-4-7"/><circle cx="12" cy="8" r="5"/>',check:'<path d="M20 6 9 17l-5-5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',file:'<path d="M7 3h7l5 5v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h5M9 13h6m-6 4h6"/>',trend:'<path d="m3 17 6-6 4 4 8-8M15 7h6v6"/>',arrow:'<path d="M5 12h14m-7-7 7 7-7 7"/>',left:'<path d="M19 12H5m7-7-7 7 7 7"/>',spark:'<path d="m12 2 1.8 7 7.2 3-7.2 3-1.8 7-1.8-7L3 12l7.2-3z"/>'};
 return '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" '+common+'>'+paths[name]+'</svg>';
}
function summary(){
 const graded=completed(),scores=graded.map(t=>percentage(grade(t.id).total,points(t))),average=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):null;
 const pending=tests.filter(t=>!grade(t.id)&&submission(t.id)?.count).length;
 const latest=graded.slice().sort((a,b)=>new Date(grade(b.id).publishedAt||0)-new Date(grade(a.id).publishedAt||0))[0];
 const latestPct=latest?percentage(grade(latest.id).total,points(latest)):null;
 const metrics=[['Published results',String(graded.length),icon('file')],['Average score',average===null?'—':average+'%',icon('trend')],['Awaiting review',String(pending),icon('clock')],['Latest score',latestPct===null?'—':latestPct+'%',icon('award')]];
 return '<div class="my-results-stats">'+metrics.map(m=>'<div class="my-results-stat"><div class="my-results-stat-label"><span>'+E(m[0])+'</span><span class="my-results-stat-icon">'+m[2]+'</span></div><strong>'+E(m[1])+'</strong></div>').join('')+'</div>';
}
function testCard(t){
 const r=grade(t.id),info=submission(t.id),status=cardState(t),max=points(t),pct=r?percentage(r.total,max):0;
 return '<article class="my-results-test-card '+status+'"><div class="my-results-card-top"><span class="my-results-status '+status+'">'+(status==='graded'?icon('check'):status==='pending'?icon('clock'):icon('file'))+' '+stateLabel(status)+'</span><span class="my-results-card-date">'+E(r?stamp(r.publishedAt):info?.count?'Last submitted '+stamp(info.latestSubmittedAt):'')+'</span></div><h3>'+E(t.title)+'</h3><p class="my-results-card-desc">'+((t.sections||[]).length?((t.sections||[]).length+' assessment sections · '):'')+E(max)+' possible marks</p>'+
 (r?'<div class="my-results-card-score"><strong>'+E(r.total)+' <span>/ '+E(max)+'</span></strong><b>'+pct+'%</b></div><div class="my-results-track"><span style="width:'+pct+'%"></span></div>':info?.count?'<p class="my-results-card-note">'+E(info.count)+' notebook submission'+(info.count===1?'':'s')+' received. Your teacher is reviewing your work.</p>':'<p class="my-results-card-note">Your report will appear after you complete this test and your teacher publishes a grade.</p>')+
 '<button type="button" class="my-results-open" data-results-open="'+E(t.id)+'">'+(r?'View detailed report':status==='pending'?'View submission status':'View test information')+icon('arrow')+'</button></article>';
}
function overview(){
 const graded=completed().sort((a,b)=>new Date(grade(b.id).publishedAt||0)-new Date(grade(a.id).publishedAt||0));
 const latest=graded[0];
 return '<div class="my-results-main"><div class="my-results-section-header"><div><h2>Assessment history</h2><p>All your classroom tests and published results, in one place.</p></div><span class="my-results-count">'+tests.length+' test'+(tests.length===1?'':'s')+'</span></div>'+
 (latest?'<div class="my-results-latest"><div class="my-results-latest-details"><span class="my-results-latest-tag">'+icon('spark')+' MOST RECENT RESULT</span><h3>'+E(latest.title)+'</h3><p>Published '+E(stamp(grade(latest.id).publishedAt))+'</p><button type="button" class="my-results-latest-link" data-results-open="'+E(latest.id)+'">Open my report '+icon('arrow')+'</button></div><div class="my-results-latest-score"><strong>'+percentage(grade(latest.id).total,points(latest))+'%</strong><span>'+E(grade(latest.id).total)+' / '+E(points(latest))+' marks</span></div></div>':'')+
 (tests.length?'<div class="my-results-test-grid">'+tests.map(testCard).join('')+'</div>':'<div class="my-results-empty"><div class="my-results-empty-icon">'+icon('file')+'</div><h3>No assessments published yet</h3><p>Your teacher will add tests here. When results are released, you’ll be able to review every section.</p></div>')+'</div>';
}
function detailed(t){
 const r=grade(t.id),info=submission(t.id),max=points(t),sections=t.sections||[];
 const pct=r?percentage(r.total,max):null;
 const breakdown=r?sections.map(s=>{
  const val=Number(r.sectionScores?.[s.id]??0),sectionPct=percentage(val,s.maxMarks);
  return '<div class="my-results-break-row"><div class="my-results-break-header"><strong>'+E(s.title)+'</strong><span>'+E(val)+' <span>/ '+E(s.maxMarks)+'</span></span></div><div class="my-results-break-track"><span style="width:'+sectionPct+'%"></span></div><small>'+sectionPct+'% of available marks</small></div>';
 }).join(''):'';
 const weakest=r?sections.map(s=>({title:s.title,percent:percentage(Number(r.sectionScores?.[s.id]??0),s.maxMarks)})).sort((a,b)=>a.percent-b.percent).slice(0,2):[];
 return '<div class="my-results-detail"><button type="button" class="my-results-back" data-results-back>'+icon('left')+' All results</button><header class="my-results-detail-head"><div><span class="my-results-kicker">PERSONAL ASSESSMENT REPORT</span><h2>'+E(t.title)+'</h2><p>'+E(sections.length)+' sections · '+E(max)+' possible marks</p></div><span class="my-results-status '+cardState(t)+'">'+stateLabel(cardState(t))+'</span></header>'+
 (r?'<section class="my-results-grade-hero"><div class="my-results-grade-copy"><span>YOUR VERIFIED SCORE</span><div class="my-results-grade-numbers"><strong>'+E(r.total)+' <small>/ '+E(max)+'</small></strong><b>'+pct+'%</b></div><p>Published '+E(stamp(r.publishedAt))+' by your teacher</p></div><div class="my-results-grade-gauge" role="img" aria-label="'+pct+' percent" style="--result-percent:'+pct+'"><div><strong>'+pct+'%</strong><span>Overall</span></div></div></section><section class="my-results-report-panel"><div class="my-results-panel-heading"><h3>Section-by-section marks</h3><p>See exactly where you earned marks across the assessment.</p></div><div class="my-results-break-list">'+breakdown+'</div></section><section class="my-results-report-panel my-results-feedback-panel"><div class="my-results-panel-heading"><h3>Feedback from your teacher</h3><p>Review the comments from your marked assessment.</p></div>'+(r.feedback?'<div class="my-results-teacher-feedback">'+E(r.feedback).replace(/\\n/g,'<br>')+'</div>':'<p class="my-results-no-feedback">Your teacher has not added written feedback for this result.</p>')+'</section>'+(weakest.length?'<section class="my-results-revise"><span>'+icon('spark')+'</span><div><strong>Suggested revision focus</strong><p>Based on your lowest-scoring sections: '+weakest.map(x=>E(x.title)).join(' and ')+'. Practise these areas before your next assessment.</p></div></section>':''):
 '<section class="my-results-pending-panel"><span>'+icon('clock')+'</span><h3>'+(info?.count?'Teacher review in progress':'No notebook submitted yet')+'</h3><p>'+(info?.count?E(info.count)+' submission(s) received. Your teacher will publish your marks when the review is complete.':'Once you complete and upload this assessment, its marks will appear here after teacher review.')+'</p><button type="button" class="my-results-go-test" data-results-go-test>Open Tests '+icon('arrow')+'</button></section>')+
 '</div>';
}
function render(){
 const el=document.getElementById('classroom-results-root');if(!el)return;
 if(error){el.innerHTML='<div class="my-results-error"><strong>Results could not be loaded</strong><p>'+E(error)+'</p><button type="button" data-results-reload>Try again</button></div>';return}
 el.innerHTML='<div class="my-results">'+(window.classroomIsTeacher?'<div class="my-results-teacher-note"><strong>Teacher preview</strong><span>This section shows results for the currently signed-in account only. To see and grade your students’ tests, open <b>Teacher → Tests & Submissions</b>. Students see their own published results here.</span></div>':'')+'<header class="my-results-hero"><div><span class="my-results-kicker">MY LEARNING / ASSESSMENTS</span><h1>My Results<span>.</span></h1><p>Track your progress, review your teacher’s feedback, and know what to practise next.</p></div><span class="my-results-hero-art">'+icon('award')+'</span></header>'+summary()+(selected&&testFor(selected)?detailed(testFor(selected)):overview())+'</div>';
}
async function load(){
 if(busy)return;
 const el=document.getElementById('classroom-results-root'),api=window.classroomTestUploads;
 if(!el)return;
 if(!api){el.innerHTML='<div class="my-results-loading">Connecting to your private results…</div>';return}
 busy=true;const serial=++requestSerial;
 el.innerHTML='<div class="my-results-loading"><span class="my-results-spinner"></span>Loading your test results…</div>';
 try{
  const [raw,own]=await Promise.all([fetch('./tests.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Unable to load test definitions');return r.json()}),api.myResults()]);
  if(serial!==requestSerial)return;
  tests=Array.isArray(raw.tests)?raw.tests.filter(t=>t&&typeof t.id==='string'&&Array.isArray(t.sections)):[];submissions=own.submissions||{};
  grades=Object.fromEntries((own.results||[]).filter(r=>r.status==='published'&&typeof r.testId==='string').map(r=>[r.testId,r]));
  loaded=true;error='';render();
 }catch(e){error=api.error(e);loaded=false;render()}
 finally{busy=false}
}
window.classroomMyResultsView=()=>{selected=null;queueMicrotask(()=>load());return '<div id="classroom-results-root"><div class="my-results-loading">Loading your test results…</div></div>'};
window.addEventListener('classroom-test-uploads-ready',()=>{if(document.getElementById('classroom-results-root')&&!loaded)load()});
document.addEventListener('click',event=>{
 const btn=event.target.closest('[data-results-open],[data-results-back],[data-results-reload],[data-results-go-test]');
 if(!btn||!btn.closest('#classroom-results-root'))return;
 if(btn.hasAttribute('data-results-open')){selected=btn.dataset.resultsOpen;render();document.getElementById('classroom-results-root')?.scrollIntoView({block:'start',behavior:'smooth'});return}
 if(btn.hasAttribute('data-results-back')){selected=null;render();return}
 if(btn.hasAttribute('data-results-reload')){error='';load();return}
 if(btn.hasAttribute('data-results-go-test'))window.classroomSetSection?.('tests');
});
})();