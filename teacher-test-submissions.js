/* Teacher notebook review and marking. Access checks are enforced by backend. */
(function(){
'use strict';
const E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let submissions=[],tests=[],ready=false,loading=false,error='',selected='',filter='all',search='',photoUrls={};
let pendingReport=null,pendingDigital=null;
const test=id=>tests.find(t=>t.id===id);
const current=()=>submissions.find(s=>s.id===selected);
const date=s=>s.submittedAt?.seconds?new Date(s.submittedAt.seconds*1000).toLocaleString():'Date unavailable';
const status=s=>s.result?.status||'unmarked';
const chip=s=>'<span class="assessment-chip '+status(s)+'">'+({unmarked:'To review',draft:'Draft',published:'Published'}[status(s)])+'</span>';
function metrics(){
 const unique=type=>new Set(submissions.filter(s=>status(s)===type).map(s=>s.ownerUid+'|'+s.testId)).size;
 return '<div class="assessment-metrics">'+[['Submissions',submissions.length],['To review',unique('unmarked')],['Drafts',unique('draft')],['Published',unique('published')]].map(x=>'<div><small>'+x[0]+'</small><strong>'+x[1]+'</strong></div>').join('')+'</div>';
}
function card(s){
 return '<button type="button" data-assessment-select="'+E(s.id)+'" class="assessment-submission '+(selected===s.id?'selected':'')+'"><span class="assessment-card-top"><strong>'+E(s.studentEmail||'Student')+'</strong>'+chip(s)+'</span><span class="assessment-card-title">'+E(test(s.testId)?.title||s.testId)+'</span><span class="assessment-card-meta">'+E(date(s))+' · '+E(s.pageCount)+' pages</span></button>';
}
const filtered=()=>submissions.filter(s=>(filter==='all'||status(s)===filter)&&(!search||[s.studentEmail,s.testId,test(s.testId)?.title].some(x=>String(x||'').toLowerCase().includes(search))));
function list(){
 return '<aside class="assessment-list"><div class="assessment-list-head"><strong>Student submissions</strong><button class="btn" type="button" data-assessment-refresh>Refresh</button></div><label for="assessment-search">Search students or tests</label><input id="assessment-search" class="field" type="search" value="'+E(search)+'" placeholder="Search by student or test"><div class="assessment-filters">'+[['all','All'],['unmarked','To review'],['draft','Drafts'],['published','Published']].map(x=>'<button type="button" data-assessment-filter="'+x[0]+'" class="'+(filter===x[0]?'active':'')+'">'+x[1]+'</button>').join('')+'</div><div class="assessment-list-items">'+(filtered().length?filtered().map(card).join(''):'<p class="muted">No matching submissions.</p>')+'</div></aside>';
}
function grade(s,t){
 const scores=s.result?.sectionScores||{},max=t.maxMarks;
 return '<section class="assessment-grading"><div class="assessment-section-heading"><h3>Section marking</h3><p>Enter marks for the original eight sections. Save a private draft or publish the verified result.</p></div><div class="assessment-marks">'+t.sections.map(section=>'<label class="assessment-mark"><span>'+E(section.title)+'</span><span><input type="number" inputmode="numeric" min="0" max="'+E(section.maxMarks)+'" step="0.5" data-grade-section="'+E(section.id)+'" value="'+E(scores[section.id]??'')+'" placeholder="—"> <strong>/ '+E(section.maxMarks)+'</strong></span></label>').join('')+'</div><div class="assessment-report-upload"><h3>Student correction report</h3><p>Attach the AI-checked report as a PDF, Word document or TXT file (up to 10 MB). The student can download it after you publish the grade.</p><label class="assessment-report-picker" for="assessment-report-file">Choose correction report</label><input id="assessment-report-file" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"><div class="assessment-selected-file"><div id="assessment-report-name" class="assessment-report-name">'+E(pendingReport?.name||(s.result?.hasReport?(s.result.reportName||'Correction report already attached'):'No report selected'))+'</div>'+(pendingReport?'<button type="button" class="assessment-file-clear" data-assessment-clear-file="pdf" aria-label="Remove selected correction PDF or document" title="Remove selected file">×</button>':'')+'</div>'+(s.result?.hasReport?'<button type="button" class="btn" data-assessment-report-download>Download current report</button>':'')+'</div><div class="assessment-report-upload"><h3>Digital marked test · all questions</h3><p>Optional: upload the complete correction JSON. Students will see ticks and explanations beside the original questions in My Results.</p><label class="assessment-report-picker" for="assessment-digital-file">Choose marked test (.json)</label><input id="assessment-digital-file" type="file" accept=".json,application/json"><div class="assessment-selected-file"><div class="assessment-report-name" id="assessment-digital-name">'+E(pendingDigital?"Ready: "+pendingDigital.filename:s.result?.hasDigitalCorrections?"Digital correction already attached":"No digital test selected")+'</div>'+(pendingDigital?'<button type="button" class="assessment-file-clear" data-assessment-clear-file="json" aria-label="Remove selected JSON file" title="Remove selected file">×</button>':'')+'</div></div><label class="assessment-feedback-label" for="assessment-feedback">Feedback for student</label><textarea class="field" id="assessment-feedback" rows="5" maxlength="5000" placeholder="Strengths, recurring errors and what to revise…">'+E(s.result?.feedback||'')+'</textarea><div class="assessment-grade-footer"><div><small>Total marks</small><strong id="assessment-total">'+E(s.result?.total??0)+' / '+E(max)+'</strong></div><div><button type="button" class="btn" data-assessment-save="draft">Save draft</button><button type="button" class="btn primary" data-assessment-save="published">Publish result</button></div></div><p id="assessment-save-status" role="status" class="assessment-message"></p>'+(status(s)==='published'?'<p class="small muted">Publishing again updates the visible student result.</p>':'')+'</section>';
}
function review(){
 const s=current();if(!s)return '<section class="assessment-review assessment-placeholder"><h3>Select a submission</h3><p>Choose a student to review notebook photographs and record assessment marks.</p></section>';
 const t=test(s.testId);
 const photos=photoUrls[s.id]?'<div class="assessment-photo-download-bar"><p>Download every submitted notebook page together, or open individual pages below.</p><button type="button" class="btn primary" data-assessment-photo-zip="'+E(s.id)+'">↓ Download all photos (ZIP)</button></div><div class="assessment-photo-grid">'+photoUrls[s.id].map((u,i)=>'<div class="assessment-photo-tile"><a href="'+E(u)+'" target="_blank" rel="noopener noreferrer"><img src="'+E(u)+'" loading="lazy" alt="Notebook photo '+(i+1)+'"><span>Page '+(i+1)+' · Open full size</span></a><button type="button" class="btn assessment-remove-photo" data-assessment-remove-photo="'+i+'" data-assessment-remove-submission="'+E(s.id)+'">Remove page '+(i+1)+'</button></div>').join('')+'</div>':'<div class="assessment-photo-prompt"><span>'+E(s.pageCount)+' pages available</span><button class="btn primary" data-assessment-view="'+E(s.id)+'" type="button">Open notebook photos</button><button class="btn" data-assessment-photo-zip="'+E(s.id)+'" type="button">↓ Download all photos (ZIP)</button></div>';
 return '<section class="assessment-review"><div class="assessment-review-head"><span class="tp-kicker">SUBMISSION REVIEW</span><h3>'+E(s.studentEmail||'Student')+'</h3><p>'+E(t?.title||s.testId)+'</p><div class="assessment-review-meta"><span>'+E(date(s))+'</span><span>'+E(s.pageCount)+' photos</span>'+chip(s)+'</div></div><div class="assessment-section"><div class="assessment-section-heading"><h3>Handwritten answers</h3><p>Review each submitted page at full resolution.</p></div>'+photos+'</div><div class="assessment-ai-panel"><div><h3>Check with AI</h3><p>Copy the original questions and marking guidance. Attach notebook photos separately to your AI checker.</p></div><button type="button" class="btn" data-assessment-copy="'+E(s.testId)+'">Copy questions + AI instructions</button></div>'+(t?grade(s,t):'<div class="notice">This test is not available for marking.</div>')+'</section>';
}
function catalogue(){
 return '<section class="assessment-library"><div class="assessment-section-heading"><h3>Published test library</h3><p>Copy original tests for AI-assisted manual review</p></div>'+tests.map(t=>'<div class="assessment-library-row"><div><strong>'+E(t.title)+'</strong><small>'+E(t.maxMarks)+' marks · '+(t.sections||[]).length+' sections</small></div><button class="btn" type="button" data-assessment-copy="'+E(t.id)+'">Copy for AI</button></div>').join('')+'</section>';
}
function draw(){
 const el=document.getElementById('teacher-tests-content');if(!el)return;
 if(error){el.innerHTML='<div class="notice">'+E(error)+' <button type="button" class="btn" data-assessment-refresh>Retry</button></div>';return}
 el.innerHTML='<div class="teacher-assessments"><header class="assessment-hero"><span class="tp-kicker">TEACHER WORKSPACE / ASSESSMENTS</span><h2>Tests & submissions</h2><p>Review student work, mark the original sections and publish verified results.</p></header>'+metrics()+'<div class="assessment-workspace">'+list()+review()+'</div>'+catalogue()+'</div>';
}
async function refresh(){
 const el=document.getElementById('teacher-tests-content'),api=window.classroomTestUploads;
 if(!el||!window.classroomIsTeacher||loading)return;
 if(!api){el.innerHTML='<p class="muted">Connecting to assessment storage…</p>';return}
 loading=true;el.innerHTML='<p class="muted">Loading student submissions…</p>';
 try{
  const [rows,source]=await Promise.all([api.teacherList(),fetch('./tests.json',{cache:'no-store'}).then(r=>r.json())]);
  submissions=rows||[];tests=source.tests||[];ready=true;error='';
  if(selected&&!submissions.some(s=>s.id===selected))selected='';
  pendingReport=null;
 }catch(e){error=api.error(e);ready=false}
 finally{loading=false;draw()}
}
window.classroomTeacherTestsView=()=>{queueMicrotask(()=>{if(!ready)refresh();else draw()});return '<div id="teacher-tests-content"><p class="muted">Loading assessment records…</p></div>'};
window.addEventListener('classroom-test-uploads-ready',()=>{if(document.getElementById('teacher-tests-content')&&!ready)refresh()});
async function mark(btn,gradeStatus){
 const s=current(),t=test(s?.testId);if(!s||!t)return;
 const score={},fields=Array.from(document.querySelectorAll('#teacher-tests-content [data-grade-section]'));
 const msg=document.getElementById('assessment-save-status');
 for(const field of fields){
  if(field.value.trim()==='')continue;
  const max=t.sections.find(x=>x.id===field.dataset.gradeSection)?.maxMarks;
  const n=Number(field.value);
  if(!Number.isFinite(n)||n<0||n>max||Math.round(n*2)!==n*2){msg.textContent='Enter marks in 0.5 increments from 0 to '+max+' for '+field.dataset.gradeSection+'.';return}
  score[field.dataset.gradeSection]=n;
 }
 if(gradeStatus==='published'&&Object.keys(score).length!==t.sections.length){msg.textContent='Mark every section before publishing.';return}
 if(gradeStatus==='draft'&&status(s)==='published'){msg.textContent='A published result must be updated by publishing again.';return}
 if(gradeStatus==='published'&&!confirm('Publish these section marks and feedback to the student?'))return;
 const feedback=document.getElementById('assessment-feedback').value;
 btn.disabled=true;msg.textContent='Saving assessment…';
 try{
  let uploaded=null;
  if(pendingReport){
   msg.textContent='Uploading correction report…';
   uploaded=await window.classroomTestUploads.uploadReport(s.id,pendingReport);
  }
  msg.textContent='Saving assessment…';
  const result=await window.classroomTestUploads.grade(s.id,score,feedback,gradeStatus,uploaded?.path,uploaded?.name,pendingDigital?.data);
  pendingReport=null;pendingDigital=null;
  submissions.forEach(row=>{if(row.ownerUid===s.ownerUid&&row.testId===s.testId)row.result={...result}});
  draw();const label=document.getElementById('assessment-save-status');if(label)label.textContent=gradeStatus==='published'?'✓ Result published to student.':'✓ Private draft saved.';
 }catch(e){btn.disabled=false;msg.textContent='Save failed: '+window.classroomTestUploads.error(e)}
}
async function openPhotos(btn,id){
 const s=submissions.find(x=>x.id===id);if(!s)return;
 btn.disabled=true;btn.textContent='Loading pages…';
 try{photoUrls[id]=await window.classroomTestUploads.urls(s);if(selected===id)draw()}
 catch(e){btn.disabled=false;btn.textContent='Retry opening pages';alert('Cannot view pages: '+window.classroomTestUploads.error(e))}
}
async function teacherRemovePhoto(btn,id,index){
 if(!Number.isInteger(index)||index<0)return;
 if(!confirm('Permanently remove page '+(index+1)+' from this student submission? This cannot be undone. The student will regain one upload slot.'))return;
 btn.disabled=true;btn.textContent='Removing…';
 try{
  await window.classroomTestUploads.removePhoto(id,index);
  delete photoUrls[id];
  await refresh();
 }catch(e){alert('Unable to remove page: '+window.classroomTestUploads.error(e));if(btn.isConnected){btn.disabled=false;btn.textContent='Remove page '+(index+1)}}
}
async function downloadPhotosZip(btn,id){
 const api=window.classroomTestUploads;
 const s=submissions.find(v=>v.id===id);if(!s)return;
 btn.disabled=true;const previous=btn.textContent;btn.textContent='Preparing ZIP…';
 try{
  const blob=await api.photoZip(id);
  const url=URL.createObjectURL(blob);
  const name='French_Notebook_'+s.testId+'_'+id.slice(0,8)+'.zip';
  const link=document.createElement('a');link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),120000);
 }catch(e){alert('Unable to download notebook photos: '+api.error(e))}
 finally{if(btn.isConnected){btn.disabled=false;btn.textContent=previous}}
}
async function downloadReport(){
 const s=current();if(!s)return;
 const api=window.classroomTestUploads;
 try{
  const data=await api.reportUrl(s.testId,s.id);
  const link=document.createElement('a');link.href=data.url;link.target='_blank';link.rel='noopener noreferrer';link.download=data.name||'Correction report';document.body.appendChild(link);link.click();link.remove();
 }catch(e){alert('Unable to download report: '+api.error(e))}
}
function instructionsForAI(t){
 const base=window.classroomTestCopyText?.(t)||'';
 return [
  'AI CORRECTION INSTRUCTIONS — READ FIRST',
  'Act as a careful French A1 teacher reviewing the student handwritten test photos. The original questions and maximum marks are below. No answer key is provided: determine correctness using reliable French knowledge, the question wording and context; accept any valid alternative answers.',
  'Wait until ALL PHOTOS UPLOADED before beginning. Match each written answer to the original section and exact question ID, including the questions answered correctly. Do not invent handwriting, unseen answers, missing pages or missing question numbers.',
  'IMPORTANT: Assess the SPEAKING QUESTIONS section AS WRITTEN FRENCH, as instructed by the teacher. Evaluate written answers and language accuracy, not oral pronunciation or spoken fluency.',
  'Use whole or 0.5-point marks as appropriate, within each question maximum. Correct minor spelling, accents, articles, gender, agreement, verbs, prepositions and sentence order. Explain only genuine errors; do not penalize other valid wording.',
  'CREATE A COMPLETE, CLEAN AND SIMPLE STUDENT CORRECTION REPORT suitable for PDF or Word, with clear bold section titles and easy-to-read numbered rows. Include EVERY ORIGINAL QUESTION in the ORIGINAL ORDER, even if correct. Never skip a question or replace the full checklist with a summary.',
  'REPORT FORMAT:',
  'TITLE: French Classroom — Assessment Correction Report',
  'Student: [student name or teacher-provided identifier] | Test: [original test title] | Date: [date]',
  'SCORE SUMMARY: List all section totals earned / maximum, then overall earned / maximum and percentage.',
  'COMPLETE QUESTION CHECKLIST: One entry for EVERY question ID grouped by its original section:',
  'For a fully correct answer: ✓ [Question ID] — Correct — [marks earned / maximum]. Optionally show a very short answer. NO explanation for a correct answer.',
  'For a partially correct answer: ◐ [Question ID] — Partially correct — [marks earned / maximum]. Student wrote: [exact visible answer]. Correct answer: [natural correct French]. Why: [one or two simple sentences explaining precisely what needs correction].',
  'For an incorrect answer: ✗ [Question ID] — Incorrect — [marks earned / maximum]. Student wrote: [exact visible answer]. Correct answer: [natural correct French]. Why: [one or two short sentences explaining the mistake].',
  'For a blank/unreadable/unavailable answer: ? [Question ID] — Missing / Unreadable / Needs teacher review — [appropriate marks]. State what is visible or missing. Give a correct model answer only if reliably determined from the original question; never invent what the student wrote.',
  'For the long story question, show one question ID with its marks and a short list of specific corrections, then include a natural corrected story if useful. Do NOT invent extra scored question IDs or double-count its subparts.',
  'FINAL REVISION: List at most five recurring mistakes and a short practical exercise for each.',
  'QUALITY CHECK: Every original question ID appears exactly once in the checklist; statuses match student work; all individual and section marks add up correctly; 0.5 marks are permitted; no score exceeds its maximum; oral skills were not graded from photos.',
  'Write concisely and clearly for an A1 learner. The teacher verifies the report before publishing. Do not reveal model answers before the student completes the test.',
  '',
  '====== ORIGINAL TEST QUESTIONS ======',
  base
 ].join('\n');
}
async function copy(btn,id){
 const t=test(id),val=t&&instructionsForAI(t);
 if(!val){alert('Test questions are unavailable.');return}
 try{await navigator.clipboard.writeText(val);const old=btn.textContent;btn.textContent='✓ Copied';setTimeout(()=>{if(btn.isConnected)btn.textContent=old},2300)}catch{alert('Clipboard access unavailable.')}
}
document.addEventListener('click',event=>{
 const btn=event.target.closest('[data-assessment-select],[data-assessment-refresh],[data-assessment-filter],[data-assessment-save],[data-assessment-view],[data-assessment-copy],[data-assessment-report-download],[data-assessment-photo-zip],[data-assessment-remove-photo],[data-assessment-clear-file]');
 if(!btn||!btn.closest('#teacher-portal')||!window.classroomIsTeacher)return;
 if(btn.hasAttribute('data-assessment-refresh')){ready=false;refresh();return}
 if(btn.hasAttribute('data-assessment-select')){selected=btn.dataset.assessmentSelect;pendingReport=null;pendingDigital=null;draw();return}
 if(btn.hasAttribute('data-assessment-filter')){filter=btn.dataset.assessmentFilter;draw();return}
 if(btn.hasAttribute('data-assessment-view')){openPhotos(btn,btn.dataset.assessmentView);return}
 if(btn.hasAttribute('data-assessment-photo-zip')){downloadPhotosZip(btn,btn.dataset.assessmentPhotoZip);return}
 if(btn.hasAttribute('data-assessment-remove-photo')){teacherRemovePhoto(btn,btn.dataset.assessmentRemoveSubmission,Number(btn.dataset.assessmentRemovePhoto));return}
 if(btn.hasAttribute('data-assessment-copy')){copy(btn,btn.dataset.assessmentCopy);return}
 if(btn.hasAttribute('data-assessment-clear-file')){
  const kind=btn.dataset.assessmentClearFile;
  if(kind==='pdf'){pendingReport=null;const input=document.getElementById('assessment-report-file');if(input)input.value='';}
  if(kind==='json'){pendingDigital=null;const input=document.getElementById('assessment-digital-file');if(input)input.value='';}
  // Only reset the pending selection; never remove an already saved report or change marks.
  const row=btn.closest('.assessment-selected-file');
  if(row){const name=row.querySelector('.assessment-report-name');const saved=current()?.result;
   if(name)name.textContent=kind==='pdf'?(saved?.hasReport?(saved.reportName||'Correction report already attached'):'No report selected'):(saved?.hasDigitalCorrections?'Digital correction already attached':'No digital test selected');
   btn.remove();
  }
  return;
 }
 if(btn.hasAttribute('data-assessment-report-download')){downloadReport();return}
 if(btn.hasAttribute('data-assessment-save'))mark(btn,btn.dataset.assessmentSave);
});
document.addEventListener('change',async event=>{
 if(event.target.id==='assessment-digital-file'&&event.target.closest('#teacher-tests-content')){
  const file=event.target.files?.[0],out=document.getElementById('assessment-digital-name');
  pendingDigital=null;
  if(!file){if(out)out.textContent='No digital test selected';return}
  try{
   if(!file.name.toLowerCase().endsWith('.json')||file.size>180000)throw Error('Choose a marked-test JSON file under 180 KB.');
   const data=JSON.parse(await file.text()),t=test(current()?.testId);
   if(!t||data.testId!==t.id||!Array.isArray(data.questions)||data.questions.length!==t.sections.reduce((n,s)=>n+s.questions.length,0))throw Error('This digital correction file does not match the selected test.');
   const ids=t.sections.flatMap(s=>s.questions.map(q=>q.id));
   if(data.questions.some((q,i)=>q.id!==ids[i]))throw Error('Question IDs or order do not match the original test.');
   const tallies=Object.fromEntries(t.sections.map(s=>[s.id,0]));
   for(const q of data.questions){
    if(typeof q.awarded!=='number'||!Number.isFinite(q.awarded)||typeof q.sectionId!=='string'||!(q.sectionId in tallies))throw Error('Invalid question scores in this file.');
    tallies[q.sectionId]+=q.awarded;
   }
   for(const section of t.sections){
    const f=document.querySelector('#teacher-tests-content [data-grade-section="'+section.id+'"]');
    if(f&&f.value.trim()!==''&&Math.abs(Number(f.value)-tallies[section.id])>0.001)
     throw Error('Question marks disagree with the '+section.title+' section score.');
   }
   pendingDigital={data,filename:file.name};
   if(out)out.textContent='Ready: '+file.name+' · '+data.questions.length+' questions · '+Object.values(tallies).reduce((a,b)=>a+b,0)+' marks';
   const row=out?.closest('.assessment-selected-file');
   if(row&&!row.querySelector('[data-assessment-clear-file]'))row.insertAdjacentHTML('beforeend','<button type="button" class="assessment-file-clear" data-assessment-clear-file="json" aria-label="Remove selected JSON file" title="Remove selected file">×</button>');
  }catch(err){event.target.value='';if(out)out.textContent='Cannot use this file: '+err.message}
  return;
 }
 if(event.target.id!=='assessment-report-file'||!event.target.closest('#teacher-tests-content'))return;
 const file=event.target.files?.[0]||null,display=document.getElementById('assessment-report-name');
 if(!file){pendingReport=null;if(display)display.textContent='No report selected';return}
 const ext=file.name.split('.').pop()?.toLowerCase();
 if(!['pdf','docx','txt'].includes(ext)||file.size<1||file.size>10*1024*1024){
  pendingReport=null;event.target.value='';
  if(display)display.textContent='Choose a PDF, DOCX or TXT under 10 MB.';
  return;
 }
 pendingReport=file;
 if(display)display.textContent='Ready to upload: '+file.name;
 const row=display?.closest('.assessment-selected-file');
 if(row&&!row.querySelector('[data-assessment-clear-file]'))row.insertAdjacentHTML('beforeend','<button type="button" class="assessment-file-clear" data-assessment-clear-file="pdf" aria-label="Remove selected correction PDF or document" title="Remove selected file">×</button>');
});
document.addEventListener('input',event=>{
 if(!event.target.closest('#teacher-tests-content'))return;
 if(event.target.id==='assessment-search'){
  search=event.target.value.toLowerCase().trim();const area=document.querySelector('.assessment-list-items');
  if(area)area.innerHTML=filtered().length?filtered().map(card).join(''):'<p class="muted">No matching submissions.</p>';
 }
 if(event.target.matches('[data-grade-section]')){
  let sum=0;document.querySelectorAll('#teacher-tests-content [data-grade-section]').forEach(x=>{if(x.value.trim()!=='')sum+=Number(x.value)||0});
  const total=document.getElementById('assessment-total'),t=test(current()?.testId);
  if(total&&t)total.textContent=sum+' / '+t.maxMarks;
 }
});
})();