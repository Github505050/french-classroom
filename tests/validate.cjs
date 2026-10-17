'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const html=read('index.html'),teacher=read('teacher-dashboard.js'),found=read('foundations.js');
test('script integrity and PWA update',()=>{
  assert.match(html,/teacher-dashboard\.css/);
  assert.match(html,/<script src="\.\/teacher-dashboard\.js"><\/script>/);
  assert.match(html,/classroomGetSyllabus/);
  assert.match(found,/classroomFoundationOutline/);
  assert.match(read('sw.js'),/teacher-dashboard\.js/);
  assert.match(read('sw.js'),/teacher-dashboard\.css/);
  const core=JSON.parse(read('config.json'));
  assert.ok(core.weeks.length>0);
  core.weeks.forEach(path=>{
    const w=JSON.parse(read(path));
    assert.ok(w.id && w.title);
    assert.equal(w.days.length,7,'Exactly seven days per week');
    w.days.forEach((day,i)=>assert.ok(day.title,'Missing day title '+i));
  });
  assert.ok(JSON.parse(read('listening.json')));
  new vm.Script(teacher);
  new vm.Script(found);
  const inline=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(inline.length>=2);
  inline.forEach((x,i)=>new vm.Script(x[1],{filename:'inline-'+i+'.js'}));
});
function mock(){
  let events={},refreshes=0;
  const doc={addEventListener:(type,fn)=>events[type]=fn,querySelector:()=>({})};
  const outlines=Array.from({length:14},(_,i)=>({title:'Foundation lesson '+(i+1),questionCount:2,answerSets:[['bonjour'],['merci']]}));
  const weeks=[{id:'a1-week1',title:'A1 · Week 1',days:[{title:'Greetings',status:'ready',recall:Array(10).fill(['Word','Mot']),drills:[],sentences:[],changes:[],exit:[],oral:[['Speak']]}]}];
  while(weeks[0].days.length<7)weeks[0].days.push({title:'Day '+weeks[0].days.length,status:'coming_soon'});
  const window={classroomIsTeacher:true,classroomGetSyllabus:()=>weeks,classroomFoundationOutline:()=>outlines,classroomRefresh:()=>refreshes++};
  const env={window,document:doc,Date,Number,String,Object,Map,Array,Math,Set,Blob,URL,setTimeout,console};
  vm.runInNewContext(teacher,env);
  return {api:window.classroomTeacherPortal,window,events,getRefreshes:()=>refreshes};
}
test('teacher score calculations, foundation tracking and student data escaping',()=>{
  const {api}=mock();
  const entries={
    frenchportal_v2_a1-week1_day1_completed:'yes',
    frenchportal_v2_a1-week1_day1_score:'8',
    frenchportal_v1_a1-week1_day1_recall_0:'Bonjour.',
    frenchportal_v1_a1-week1_day1_oral_0:'1',
    french_foundations_v1_0_complete:'1',
    french_foundations_v1_13_q_0:'bonjour',
    french_foundations_v1_13_q_1:'Incorrect'
  };
  const row=api.compute({uid:'student-1',email:'student@school.ca',profile:{name:'<img src=x onerror=alert(1)>',email:'student@school.ca'},entries});
  assert.equal(row.completed,2);
  assert.equal(row.foundationDone,1);
  assert.equal(row.weeklyDone,1);
  assert.equal(row.scored,1);
  assert.equal(row.average,80);
  assert.equal(row.foundation[13].correct,1);
  assert.equal(row.weekly[0].lessons[0].answers,1);
  assert.equal(row.weekly[0].lessons[0].oral,1);
  api.setData([{uid:'student-1',email:'student@school.ca',profile:{name:'<img src=x onerror=alert(1)>'},entries}]);
  const rendered=api.render();
  assert.ok(rendered.includes('&lt;img'));
  assert.ok(!rendered.includes('<img src=x'));
  assert.ok(rendered.includes('Teacher workspace'));
  assert.ok(rendered.includes('2 / 21'));
});
test('no teacher UI for students, and invalid scores are excluded',()=>{
  const {api,window}=mock();
  const r=api.compute({uid:'x',profile:{name:'Student'},entries:{frenchportal_v2_a1-week1_day1_score:'900',french_foundations_v1_0_complete:'1'}});
  assert.equal(r.scored,0);
  assert.equal(r.average,null);
  window.classroomIsTeacher=false;
  assert.match(api.render(),/Teacher access required/);
  api.setData([{uid:'secret',profile:{name:'Hidden'},entries:{}}]);
  assert.doesNotMatch(api.render(),/Hidden/);
});
test('Firestore rules keep teacher reads and prevent student cross-account reads',()=>{
  const rules=read('firestore.rules');
  assert.match(rules,/function teacher\(\)/);
  assert.match(rules,/match \/profiles\/\{uid\}/);
  assert.match(rules,/match \/progress\/\{uid\}/);
  assert.match(rules,/allow list: if teacher\(\)/);
  assert.match(rules,/request\.auth\.uid == uid/);
  assert.match(rules,/allow write: if false/);
});
