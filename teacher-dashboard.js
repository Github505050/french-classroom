/* Teacher Portal Pro — read-only Firestore reporting. No student data is stored outside the signed-in session. */
(function () {
  'use strict';
  var records = [], sourceRows = [], state = {tab:'overview', query:'', status:'all', sort:'name', selected:null};
  var note = 'Loading student records…', lastRefresh = null;
  var E = function(v){return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]})};
  var pct = function(a,b){return b ? Math.round(a/b*100) : 0};
  var num = function(v){if(v === '' || v === null || v === undefined)return null;var n=Number(v);return Number.isFinite(n)&&n>=0?n:null};
  function fmtDate(value){
    if(!value)return 'Not available';
    var d=value.toDate ? value.toDate() : value.seconds ? new Date(value.seconds*1000) : new Date(value);
    return Number.isNaN(d.getTime()) ? 'Not available' : d.toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric'});
  }
  function daysAgo(value){
    if(!value)return Infinity;
    var d=value.toDate ? value.toDate() : value.seconds ? new Date(value.seconds*1000) : new Date(value);
    return Number.isNaN(d.getTime()) ? Infinity : Math.max(0,(Date.now()-d.getTime())/86400000);
  }
  function syllabus(){return typeof window.classroomGetSyllabus==='function' ? window.classroomGetSyllabus()||[] : []}
  function foundations(){return typeof window.classroomFoundationOutline==='function' ? window.classroomFoundationOutline()||[] : []}
  function scoreMax(day){return ['recall','drills','sentences','changes','exit'].reduce(function(n,k){return n+(day[k]||[]).length},0)}
  function compute(row){
    var p=row.profile||{}, values=row.entries||{}, weekRows=[], foundRows=[], totalCompleted=0, totalPossible=0, scoreSum=0, scoreMaximum=0, scored=0;
    var outline=foundations();
    for(var f=0;f<14;f++){
      var base='french_foundations_v1_'+f, done=values[base+'_complete']==='1';
      var questionTotal=outline[f] ? outline[f].questionCount : null;
      var answered=Object.keys(values).filter(function(k){return k.indexOf(base+'_q_')===0 && String(values[k]).trim()!==''}).length;
      var correct=0;
      if(outline[f] && outline[f].answerSets)outline[f].answerSets.forEach(function(accepted,j){
        var answer=String(values[base+'_q_'+j]||'').trim().toLowerCase().normalize('NFC').replace(/[’]/g,"'").replace(/[.!?]/g,'').replace(/\s+/g,' ');
        if(answer && accepted.some(function(valid){return String(valid).trim().toLowerCase().normalize('NFC').replace(/[’]/g,"'").replace(/[.!?]/g,'').replace(/\s+/g,' ')===answer}))correct++;
      });
      foundRows.push({day:f+1,title:outline[f] ? outline[f].title : 'Foundation day '+(f+1),done:done,answered:answered,correct:correct,total:questionTotal});
      if(done)totalCompleted++;
    }
    syllabus().forEach(function(w){
      var lessons=[];
      (w.days||[]).forEach(function(d,i){
        var prefix='frenchportal_v2_'+w.id+'_day'+(i+1)+'_', old='frenchportal_v1_'+w.id+'_day'+(i+1)+'_';
        var done=values[prefix+'completed']==='yes', maximum=scoreMax(d), score=num(values[prefix+'score']);
        if(score!==null && score>maximum)score=null;
        var answers=0, oral=0, fields=[];
        ['recall','drills','sentences','changes','exit'].forEach(function(kind){
          (d[kind]||[]).forEach(function(q,j){
            var answer=values[old+kind+'_'+j];
            if(typeof answer==='string' && answer.trim()){
              answers++;
              var prompt=Array.isArray(q)?q[0]:q.prompt;
              fields.push({label:kind+' '+(j+1),prompt:prompt||'',answer:answer});
            }
          });
        });
        (d.oral||[]).forEach(function(_,j){if(values[old+'oral_'+j]==='1')oral++});
        lessons.push({day:Number.isInteger(d.day)?d.day:i+1,title:d.title||'Lesson '+(i+1),ready:d.status==='ready',done:done,completedAt:typeof values[prefix+'completedAt']==='string'?values[prefix+'completedAt']:'',
          score:score,max:maximum,answers:answers,oral:oral,fields:fields,storyNotes:typeof values['frenchportal_v2_story_'+w.id+'_day'+(i+1)+'_writing']==='string'?values['frenchportal_v2_story_'+w.id+'_day'+(i+1)+'_writing']:''});
        if(d.status==='ready')totalPossible++;
        if(done)totalCompleted++;
        if(score!==null && maximum>0){scored++;scoreSum+=score;scoreMaximum+=maximum}
      });
      weekRows.push({id:w.id,title:w.title||w.id,lessons:lessons});
    });
    return Object.assign({},row,{name:String(p.name||row.name||row.email||'Unnamed student'),email:String(p.email||row.email||''),
      dob:p.dob||'', lastSeen:p.lastSeen||null,updatedAt:row.updatedAt||null,
      weekly:weekRows, foundation:foundRows, completed:totalCompleted,foundationDone:foundRows.filter(function(x){return x.done}).length,
      weeklyDone:totalCompleted-foundRows.filter(function(x){return x.done}).length,
      possible:totalPossible+14,scored:scored,average:scoreMaximum ? pct(scoreSum,scoreMaximum) : null, scoreSum:scoreSum,scoreMaximum:scoreMaximum
    });
  }
  function setData(rows){
    if(!window.classroomIsTeacher)return;
    sourceRows=Array.isArray(rows)?rows:[];
    records=sourceRows.map(compute);
    lastRefresh=new Date();note=records.length?'Student progress is synced from Firestore.':'No student records yet.';
    refresh();
  }
  function setStatus(message){if(!window.classroomIsTeacher)return;note=message;refresh()}
  function recompute(){records=sourceRows.map(compute);refresh()}
  function clear(){records=[];sourceRows=[];state={tab:'overview',query:'',status:'all',sort:'name',selected:null};note='Loading student records…';lastRefresh=null}
  function refresh(){if(window.classroomIsTeacher && document.querySelector('#teacher-portal'))window.classroomRefresh?.()}
  function total(k){return records.reduce(function(n,r){return n+r[k]},0)}
  function icon(name){return '<span class="tp-symbol" aria-hidden="true">'+name+'</span>'}
  function metrics(){
    var active=records.filter(function(r){return daysAgo(r.lastSeen)<=7}).length;
    var totalScores=records.reduce(function(n,r){return n+r.scored},0);
    var weightedMax=total('scoreMaximum');
    return '<div class="tp-metrics" aria-label="Classroom statistics">'+
      metric('Students',records.length,'Registered profiles','▦')+
      metric('Active this week',active,'Signed in within 7 days','◷')+
      metric('Lessons completed',total('completed'),'Foundation + weekly','✓')+
      metric('Scores recorded',totalScores,weightedMax?pct(total('scoreSum'),weightedMax)+'% weighted average':'No marks yet','◫')+'</div>';
  }
  function metric(label,value,detail,symbol){return '<article class="tp-stat"><div class="tp-stat-top">'+E(label)+icon(symbol)+'</div><strong>'+E(value)+'</strong><small>'+E(detail)+'</small></article>'}
  function avatar(s){var initials=s.name.trim().split(/\s+/).slice(0,2).map(function(w){return w.charAt(0).toUpperCase()}).join('')||'S';return '<span class="tp-avatar" aria-hidden="true">'+E(initials)+'</span>'}
  function progressBar(a,b){return '<span class="tp-track"><span style="width:'+pct(a,b)+'%"></span></span>'}
  function grade(r){return r.average===null?'<span class="tp-faint">Not recorded</span>':'<strong>'+r.average+'%</strong><small class="tp-faint">Self-entered</small>'}
  function studentStatus(r){return daysAgo(r.lastSeen)<=7?'<span class="tp-chip active">Active recently</span>':r.completed?'<span class="tp-chip">In progress</span>':'<span class="tp-chip muted">Not started</span>'}
  function filtered(){
    var q=state.query.toLowerCase().trim(), rows=records.filter(function(r){
      if(q && (r.name+' '+r.email).toLowerCase().indexOf(q)===-1)return false;
      if(state.status==='active' && daysAgo(r.lastSeen)>7)return false;
      if(state.status==='progress' && !r.completed)return false;
      if(state.status==='unstarted' && r.completed)return false;
      if(state.status==='scored' && !r.scored)return false;
      return true;
    });
    rows.sort(function(a,b){
      if(state.sort==='completed')return b.completed-a.completed||a.name.localeCompare(b.name);
      if(state.sort==='score')return (b.average===null?-1:b.average)-(a.average===null?-1:a.average)||a.name.localeCompare(b.name);
      if(state.sort==='recent')return daysAgo(a.lastSeen)-daysAgo(b.lastSeen);
      return a.name.localeCompare(b.name);
    });
    return rows;
  }
  function toolbar(){
    return '<div class="tp-toolbar"><label class="tp-search-label">Search students<input id="tp-search" type="search" placeholder="Search by name or email" autocomplete="off" value="'+E(state.query)+'"></label>'+
      '<label>Show<select id="tp-status"><option value="all">All students</option><option value="active">Active (7 days)</option><option value="progress">With completions</option><option value="unstarted">Not started</option><option value="scored">With scores</option></select></label>'+
      '<label>Sort by<select id="tp-sort"><option value="name">Name (A–Z)</option><option value="completed">Lessons completed</option><option value="score">Average score</option><option value="recent">Recently active</option></select></label></div>';
  }
  function summaryTable(rows){
    if(!rows.length)return '<div class="tp-empty"><strong>No matching students</strong><p>Try another search or filter. If this is a new class, share the registration link.</p></div>';
    return '<div class="tp-table-wrap"><table class="tp-table tp-directory-table"><thead><tr><th scope="col">Student</th><th scope="col">Activity</th><th scope="col">Lessons</th><th scope="col">Progress</th><th scope="col">Scores</th><th scope="col"></th></tr></thead><tbody>'+
      rows.map(function(r){return '<tr><td><div class="tp-person">'+avatar(r)+'<div><strong>'+E(r.name)+'</strong><small>'+E(r.email||'No email in profile')+'</small></div></div></td><td>'+studentStatus(r)+'</td><td><strong>'+r.completed+' / '+r.possible+'</strong><small class="tp-faint">'+r.foundationDone+' Foundation · '+r.weeklyDone+' Weekly</small></td><td><div class="tp-progress-value">'+pct(r.completed,r.possible)+'%</div>'+progressBar(r.completed,r.possible)+'</td><td>'+grade(r)+'</td><td><button type="button" class="tp-link" data-tp-student="'+E(r.uid)+'">View profile →</button></td></tr>'}).join('')+'</tbody></table></div>';
  }
  function studentsContent(){var rows=filtered();return '<div class="tp-section-head"><div><h3>Student directory</h3><p>'+rows.length+' of '+records.length+' students</p></div></div>'+summaryTable(rows)}
  function resultsContent(){var rows=filtered();return '<div class="tp-section-head"><div><h3>Results and performance</h3><p>Scores are entered by students after external correction; they are not verified grades.</p></div></div>'+
    (rows.length?'<div class="tp-table-wrap"><table class="tp-table tp-results-table"><thead><tr><th>Student</th><th>Submitted scores</th><th>Weighted average</th><th>Points earned</th><th>Foundation</th><th></th></tr></thead><tbody>'+
    rows.map(function(r){return '<tr><td>'+avatar(r)+' <strong>'+E(r.name)+'</strong></td><td>'+r.scored+'</td><td>'+grade(r)+'</td><td>'+r.scoreSum+' / '+r.scoreMaximum+'</td><td>'+r.foundationDone+' / 14</td><td><button type="button" class="tp-link" data-tp-student="'+E(r.uid)+'">Details →</button></td></tr>'}).join('')+'</tbody></table></div>':
    '<div class="tp-empty">No results match these filters.</div>');
  }
  function overview(){
    var rows=records.slice().sort(function(a,b){return daysAgo(a.lastSeen)-daysAgo(b.lastSeen)}).slice(0,5);
    var completionTotal=total('completed'), possible=total('possible');
    return '<div class="tp-overview-grid"><section class="tp-card"><div class="tp-section-head"><div><h3>Learning progress</h3><p>Across all registered students</p></div><span class="tp-emphasis">'+pct(completionTotal,possible)+'%</span></div>'+
    progressBar(completionTotal,possible)+'<div class="tp-split"><div><strong>'+total('foundationDone')+'</strong><span>Foundation lessons</span></div><div><strong>'+total('weeklyDone')+'</strong><span>Weekly lessons</span></div></div></section>'+
    '<section class="tp-card"><div class="tp-section-head"><div><h3>Quick actions</h3><p>Your classroom tools</p></div></div><div class="tp-action-grid"><button type="button" data-tp-tab="students">⌕ <span>Student directory</span> →</button><button type="button" data-tp-tab="results">▤ <span>View scores</span> →</button><button type="button" id="tp-export-overview">↓ <span>Export CSV</span> →</button><button type="button" id="teacher-copy-link">↗ <span>Copy student registration link</span> →</button></div></section></div>'+
    '<section class="tp-card"><div class="tp-section-head"><div><h3>Classroom announcements</h3><p>Publish a short message for students on their home screen</p></div></div><p class="tp-faint">Announcements are currently managed as a GitHub Pages content file. Only published messages appear to students.</p><a class="tp-link" href="https://github.com/Github505050/french-classroom/edit/main/announcements.json" target="_blank" rel="noopener noreferrer">Edit announcements on GitHub ↗</a></section>'+ 
    '<section class="tp-card"><div class="tp-section-head"><div><h3>Recently active students</h3><p>Sorted by last recorded sign-in</p></div><button class="tp-link" data-tp-tab="students">View all →</button></div>'+summaryTable(rows)+'</section>';
  }
  function detail(){
    var r=records.find(function(x){return x.uid===state.selected});
    if(!r)return '<div class="tp-card">Student record unavailable. <button type="button" class="tp-link" data-tp-tab="students">Back to students</button></div>';
    var foundation=r.foundation.map(function(d){
      return '<div class="tp-lesson '+(d.done?'is-done':'')+'"><span class="tp-lesson-index">'+d.day+'</span><div class="tp-lesson-info"><strong>'+E(d.title)+'</strong><small>'+E(d.total==null?d.answered+' answers saved':d.answered+' / '+d.total+' responses saved · '+d.correct+' correct')+'</small></div><span class="tp-chip '+(d.done?'active':'muted')+'">'+(d.done?'Completed':'Not complete')+'</span></div>';
    }).join('');
    var weekly=r.weekly.map(function(w){
      return '<section class="tp-card"><div class="tp-section-head"><div><h3>'+E(w.title)+'</h3><p>'+w.lessons.filter(function(d){return d.done}).length+' of '+w.lessons.length+' lessons completed</p></div></div><div class="tp-lesson-grid">'+w.lessons.map(function(d){
        var score=d.score===null?'No score':d.score+' / '+d.max;var completedDate='';if(d.done&&d.completedAt){var dt=new Date(d.completedAt);if(!Number.isNaN(dt.getTime()))completedDate=dt.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
        return '<article class="tp-lesson '+(d.done?'is-done':'')+'"><span class="tp-lesson-index">'+d.day+'</span><div class="tp-lesson-info"><strong>'+E(d.title)+'</strong><small>'+E(score)+' · '+d.answers+' written answers · '+d.oral+' speaking tasks</small>'+
        (d.storyNotes?'<details class="tp-responses"><summary>View daily story notes</summary><div class="tp-response"><p>'+E(d.storyNotes)+'</p></div></details>':'')+(d.fields.length?'<details class="tp-responses"><summary>View '+d.fields.length+' saved written answer'+(d.fields.length===1?'':'s')+'</summary>'+d.fields.map(function(f){
          return '<div class="tp-response"><small>'+E(f.label)+' · '+E(f.prompt)+'</small><p>'+E(f.answer)+'</p></div>';
        }).join('')+'</details>':'')+'</div><span class="tp-chip '+(d.done?'active':'muted')+'">'+(d.done?(completedDate?'Completed on '+E(completedDate):'Completed · date not recorded'):d.ready?'Not complete':'Not released')+'</span></article>';
      }).join('')+'</div></section>';
    }).join('');
    return '<button type="button" class="tp-back" data-tp-tab="students">← Back to students</button>'+
    '<section class="tp-card tp-profile"><div class="tp-profile-heading">'+avatar(r)+'<div><span class="tp-kicker">STUDENT PROFILE</span><h2>'+E(r.name)+'</h2><p>'+E(r.email||'Email unavailable')+'</p></div>'+studentStatus(r)+'</div>'+
    '<dl class="tp-detail-grid"><div><dt>Date of birth</dt><dd>'+E(r.dob||'Not provided')+'</dd></div><div><dt>Last activity</dt><dd>'+E(fmtDate(r.lastSeen))+'</dd></div><div><dt>Progress synced</dt><dd>'+E(fmtDate(r.updatedAt))+'</dd></div><div><dt>Student ID</dt><dd class="tp-uid">'+E(r.uid)+'</dd></div></dl></section>'+
    '<div class="tp-metrics">'+metric('Completed lessons',r.completed,'Out of '+r.possible+' Foundation + Weekly','✓')+
    metric('Foundation progress',r.foundationDone+'/14','Two beginner weeks','✦')+metric('Recorded scores',r.scored,'Student-entered results','▤')+
    metric('Weighted average',r.average===null?'—':r.average+'%',r.average===null?'No scores recorded':'Across recorded scores','◫')+'</div>'+
    '<section class="tp-card"><div class="tp-section-head"><div><h3>French Foundations</h3><p>Days 1–14 · Foundation Week 1 and 2</p></div><span class="tp-emphasis">'+r.foundationDone+' / 14</span></div>'+
    progressBar(r.foundationDone,14)+'<div class="tp-lesson-grid">'+foundation+'</div></section>'+weekly;
  }
  function render(){
    if(!window.classroomIsTeacher)return '<section class="panel">Teacher access required.</section>';
    return '<div class="teacher-portal" id="teacher-portal"><section class="tp-hero"><div><span class="tp-kicker">MON ESPACE FRANÇAIS / EDUCATOR CONSOLE</span>'+
      '<h2>Teacher workspace<span>.</span></h2><p>Student records, learning progress and results in one place.</p></div>'+
      '<div class="tp-hero-action"><button type="button" id="teacher-reload">↻ Refresh records</button><small>'+E(lastRefresh?'Updated '+fmtDate(lastRefresh):'Secure Firestore reporting')+'</small></div></section>'+
      (state.tab==='student'?detail():metrics()+'<div class="tp-tabbar" role="group" aria-label="Teacher workspace sections">'+
      [['overview','Overview'],['students','Students'],['results','Results']].map(function(item){return '<button type="button" data-tp-tab="'+item[0]+'" class="'+(state.tab===item[0]?'selected':'')+'" aria-pressed="'+(state.tab===item[0])+'">'+item[1]+'</button>'}).join('')+'</div>'+
      '<div class="tp-banner" role="status">'+E(note)+'</div>'+
      (state.tab==='overview'?overview():'<section class="tp-card">'+toolbar()+'<div id="tp-content">'+(state.tab==='students'?studentsContent():resultsContent())+'</div></section>'))+
      '<p class="tp-disclaimer">Only authorized teacher accounts can retrieve these records. Scores shown here are student-entered, not independently verified. Student records are not saved to this device by the teacher portal.</p></div>';
  }
  function updateContent(){
    var el=document.getElementById('tp-content');
    if(el)el.innerHTML=state.tab==='students'?studentsContent():resultsContent();
  }
  function changeTab(tab){
    if(!window.classroomIsTeacher)return;
    state.tab=tab;state.selected=null;window.classroomRefresh?.();
  }
  function csvCell(v){
    var s=String(v==null?'':v);
    if(/^[\s]*[=+\-@\t\r]/.test(s))s="'"+s;
    return '"'+s.replace(/"/g,'""')+'"';
  }
  function exportCsv(){
    if(!window.classroomIsTeacher)return;
    var columns=['Student name','Email','Last activity','Foundation completed','Weekly completed','Total completed','Lessons available','Recorded scores','Weighted average %','Points earned','Points possible'];
    var data=records.map(function(r){return [r.name,r.email,fmtDate(r.lastSeen),r.foundationDone,r.weeklyDone,r.completed,r.possible,r.scored,r.average===null?'':r.average,r.scoreSum,r.scoreMaximum]});
    var csv='\uFEFF'+[columns].concat(data).map(function(row){return row.map(csvCell).join(',')}).join('\r\n');
    var url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    var anchor=document.createElement('a');anchor.href=url;anchor.download='french-classroom-student-report.csv';document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(function(){URL.revokeObjectURL(url)},1000);
  }
  document.addEventListener('click',function(event){
    if(!window.classroomIsTeacher || !event.target.closest('#teacher-portal'))return;
    var button=event.target.closest('button');if(!button)return;
    if(button.dataset.tpTab){changeTab(button.dataset.tpTab);return}
    if(button.dataset.tpStudent){state.selected=button.dataset.tpStudent;state.tab='student';window.classroomRefresh?.();window.scrollTo({top:0,behavior:'smooth'});return}
    if(button.id==='teacher-reload'){window.classroomLoadStudents?.();return}
    if(button.id==='tp-export-overview'){exportCsv();return}
    if(button.id==='teacher-copy-link'){
      var url='https://github505050.github.io/french-classroom/';
      if(navigator.clipboard?.writeText){navigator.clipboard.writeText(url).then(function(){button.textContent='✓ Link copied'},function(){button.textContent=url})}
      else button.textContent=url;
    }
  });
  document.addEventListener('input',function(event){
    if(!window.classroomIsTeacher || event.target.id!=='tp-search')return;
    state.query=event.target.value;updateContent();
  });
  document.addEventListener('change',function(event){
    if(!window.classroomIsTeacher)return;
    if(event.target.id==='tp-status'){state.status=event.target.value;updateContent()}
    if(event.target.id==='tp-sort'){state.sort=event.target.value;updateContent()}
  });
  window.classroomTeacherPortal={render:render,setData:setData,setStatus:setStatus,clear:clear,recompute:recompute,exportCsv:exportCsv,compute:compute};
})();