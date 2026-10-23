'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const base='http://127.0.0.1:8090/';
const shots='artifacts';fs.mkdirSync(shots,{recursive:true});
const check=async(browser,device)=>{
 const isMobile=device==='mobile';
 const context=await browser.newContext({viewport:isMobile?{width:390,height:844}:{width:1365,height:768},deviceScaleFactor:1,serviceWorkers:'block'});
 const page=await context.newPage(),errors=[];
 // Fake only the authenticated session; Firebase is tested separately with real accounts before release.
 await page.route(base+'firebase-auth.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* isolated UI smoke test */'}));
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.classroomTeacherPortal && window.classroomFoundationOutline && window.classroomGetSyllabus()?.length===2,{timeout:20000});
 await page.evaluate(()=>{
   document.body.classList.remove('classroom-locked','auth-checking');
   window.classroomTeacherDashboard=()=>window.classroomTeacherPortal.render();
   window.classroomSetTeacherRole(true);
   window.classroomSetSection('teacher');
   window.classroomTeacherPortal.setData([
     {uid:'student-test-1',email:'amelie@example.org',profile:{name:'Amélie Martin',email:'amelie@example.org',dob:'2001-02-03'},entries:{
       french_foundations_v1_0_complete:'1',
       french_foundations_v1_13_q_0:'bonjour',
       frenchportal_v2_week1_day1_completed:'yes',
       frenchportal_v2_week1_day1_score:'8'
     }},
     {uid:'student-test-2',email:'sam@example.org',profile:{name:'Sam Lee',email:'sam@example.org'},entries:{}}
   ]);
 });
 await page.locator('#teacher-portal').waitFor();
 assert.match(await page.locator('#teacher-portal').innerText(),/Teacher workspace/);
 assert.match(await page.locator('#teacher-portal').innerText(),/Student profiles|Students/);
 await page.screenshot({path:path.join(shots,'teacher-'+device+'.png'),fullPage:true});
 await page.locator('[data-tp-tab="students"]').first().click();
 await page.locator('#tp-search').fill('Amélie');
 assert.match(await page.locator('#tp-content').innerText(),/Amélie Martin/);
 assert.doesNotMatch(await page.locator('#tp-content').innerText(),/Sam Lee/);
 await page.locator('[data-tp-student="student-test-1"]').first().click();
 assert.match(await page.locator('#teacher-portal').innerText(),/Amélie Martin/);
 assert.match(await page.locator('#teacher-portal').innerText(),/Date of birth/);
 assert.match(await page.locator('#teacher-portal').innerText(),/French Foundations/);
 await page.locator('[data-tp-tab="students"]').first().click();
 assert.match(await page.locator('#teacher-portal').innerText(),/Student directory/);
 await page.evaluate(()=>{window.classroomSetTeacherRole(false);window.classroomSetSection('home')});
 assert.ok(await page.locator('.classroom-home').count()>0,'Student home should remain available');
 assert.equal(await page.locator('.classroom-ring').count(),1,'Weekly progress dial should appear');
 assert.equal(await page.locator('.app-quick-item').count(),5,'Home should have five real learning shortcuts');
 assert.equal(await page.locator('.app-quick-item').count(),5);
 assert.equal(await page.locator('.app-stats .app-stat').count(),3,'Streak, weekly, course progress must be shown');
 assert.ok(await page.locator('.app-student-illustration').evaluate(img=>img.complete&&img.naturalWidth>0),'Illustrated student asset must load');
 await page.screenshot({path:path.join(shots,'home-'+device+'.png'),fullPage:true});
 if(isMobile){
   const nav=page.locator('.mobile-learning-nav');
   assert.equal(await nav.isVisible(),true,'Five-tab mobile navigation should be visible');
   assert.equal(await nav.locator('.mobile-learn-tab').count(),5);
   await page.locator('[data-mobile-action="lessons"]').click();
   assert.match(await page.locator('#main').innerText(),/Weekly practice/);
   await page.locator('[data-mobile-action="home"]').click();
   assert.equal(await page.locator('.app-featured').count(),1,'Home should restore via app navigation');
 }
 await page.locator('[data-go="foundations"]').first().click();
 await page.locator('#foundation-week-select').waitFor();
 await page.locator('#foundation-week-select').selectOption('1');
 assert.match(await page.locator('#foundation-lesson').innerText(),/DAY 8/);
 await page.locator('#foundation-back-home').click();
 assert.ok(await page.locator('.classroom-home').count()>0,'Foundation back to home must work');
 await page.evaluate(()=>window.classroomSetSection('weekoverview'));
 assert.match(await page.locator('#main').innerText(),/Weekly practice/);
 await page.locator('[data-back-section="home"]').first().click();
 assert.ok(await page.locator('.classroom-home').count()>0);

// Guided study, vocabulary notebook, responsive navigation and refresh persistence.
await page.evaluate(()=>{window.classroomSetSection('weekoverview')});
await page.locator('[data-app-week="1"]').click();
assert.equal((await page.locator('.app-week-list .app-lesson-number').first().innerText()).trim(),'8','Week 2 should begin with global Day 8');
await page.locator('[data-app-week="0"]').click();
await page.locator('[data-day="4"]').first().click();
assert.ok(await page.locator('.app-daily-screen,.app-day-screen').count()>0,'Day lesson must open with focused activity layout');
assert.ok(await page.locator('.app-activity-step').count()>=3,'Day must render activities from its syllabus');
assert.equal(await page.locator('[data-daily-stage="vocab"]').count(),0,'Do not fabricate vocabulary sections on Days without vocabulary');
await page.screenshot({path:path.join(shots,'day-lesson-'+device+'.png'),fullPage:true});
await page.locator('[data-daily-stage="story"]').first().click();
assert.equal(await page.locator('.app-reading-screen').count(),1,'Story opens as an independent reading page');
assert.equal(await page.locator('.app-story-cover').count(),1,'Story cover artwork must render');
assert.match(await page.locator('.story-text').innerText(),/J'habite dans un appartement/);
await page.locator('[data-story-slow]').click();
assert.equal(await page.locator('[data-story-slow]').getAttribute('aria-pressed'),'true','Slow reading mode must activate');
await page.locator('[data-story-slow]').click();
await page.locator('#story-writing').fill('Je comprends cette histoire.');
await page.screenshot({path:path.join(shots,'story-reader-'+device+'.png'),fullPage:true});
assert.match(await page.evaluate(()=>location.hash),/section=story/,'Story reader route should be reflected in address');
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.classroomGetSyllabus()?.length===2,{timeout:20000});
await page.evaluate(()=>{document.body.classList.remove('classroom-locked','auth-checking');const gate=document.getElementById('auth-gate');if(gate){gate.hidden=true;gate.style.display='none'}});
await page.locator('.app-reading-screen').waitFor();
assert.equal(await page.locator('#story-writing').inputValue(),'Je comprends cette histoire.','Story writing survives a refresh on its own page');
await page.locator('[data-back-section="lessons"]').first().click();
await page.locator('[data-daily-stage="exercises"]').first().click();
assert.equal(await page.locator('.weekly-practice-nav').count(),1,'Practice uses a single weekly navigator');
assert.equal(await page.locator('.wp-week-tabs').count(),1,'Week picker must not be duplicated');
assert.equal(await page.locator('.wp-finish-card').count(),2,'Score and completion must be separate compact cards');
assert.ok(await page.locator('.wp-question').count()>0,'Syllabus exercises remain visible');
assert.ok(await page.locator('.wp-speaking-card').count()>0,'Existing speaking exercises remain available');
assert.equal(await page.locator('.wp-ai-help').count(),1,'Long AI instructions should be collapsible');
await page.locator('[data-practice-week="1"]').click();
assert.equal((await page.locator('.wp-day').first().innerText()).trim(),'Day 8','Week 2 must display global Day 8');
await page.locator('[data-practice-week="0"]').click();
await page.locator('[data-practice-day="4"]').click();
assert.match(await page.locator('#main').innerText(),/Weekly practice/);
await page.locator('#response_recall_0').fill('test draft in French');
await page.locator('[data-oral-done="0"]').check();
await page.locator('#daily-score').fill('3.5');
await page.locator('[data-save-score]').click();
assert.equal(await page.locator('#daily-score').inputValue(),'3.5','Saved score remains visible');
if(isMobile){await page.screenshot({path:path.join(shots,'weekly-practice-mobile.png'),fullPage:true});await page.setViewportSize({width:320,height:740});const narrowPractice=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();const c=getComputedStyle(el);return r.width>0&&r.height>0&&r.right>innerWidth+4&&c.position!=='fixed'&&c.display!=='none'}).slice(0,18).map(el=>{const r=el.getBoundingClientRect();return {tag:el.tagName,cls:String(el.className).slice(0,90),right:Math.round(r.right),width:Math.round(r.width),scrollWidth:el.scrollWidth}})}));console.log('Narrow practice overflow:',JSON.stringify(narrowPractice));
const overflowDetails=await page.evaluate(()=>({html:{width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,css:getComputedStyle(document.documentElement).overflowX},body:{width:document.body.clientWidth,scroll:document.body.scrollWidth,css:getComputedStyle(document.body).overflowX},regions:['header','.topline','.layout','main','.panel','.weekly-practice-nav','.wp-days','.wp-activity-grid','.wp-question-section','.wp-speaking-section','.ai-homework','.wp-finish'].map(sel=>{const x=document.querySelector(sel);if(!x)return null;const r=x.getBoundingClientRect(),c=getComputedStyle(x);return {selector:sel,width:Math.round(r.width),left:Math.round(r.left),right:Math.round(r.right),scroll:x.scrollWidth,client:x.clientWidth,overflow:c.overflowX}}),scrollable:[...document.querySelectorAll('body *')].filter(x=>x.scrollWidth>x.clientWidth+8&&getComputedStyle(x).display!=='none').slice(0,15).map(x=>({tag:x.tagName,cls:String(x.className).slice(0,90),scroll:x.scrollWidth,client:x.clientWidth,overflow:getComputedStyle(x).overflowX}))}));console.log('Narrow practice region diagnostic:',JSON.stringify(overflowDetails));assert.ok(narrowPractice.scroll<=narrowPractice.width+3,'Practice must fit 320px screen: '+JSON.stringify(narrowPractice));await page.setViewportSize({width:390,height:844})}
else await page.screenshot({path:path.join(shots,'weekly-practice-desktop.png'),fullPage:true});
await page.locator('#daily-story').waitFor();
const storyWord=page.locator('.story-word').first();
await storyWord.click();
await page.locator('#story-lookup button').last().click();
await page.locator('#story-writing').fill('Je comprends cette histoire.');
assert.equal(await page.evaluate(()=>localStorage.getItem('frenchportal_v2_story_week1_day5_writing')),'Je comprends cette histoire.');
const lessonHash=await page.evaluate(()=>location.hash);
assert.match(lessonHash,/section=practice/);
await page.reload({waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.classroomGetSyllabus()?.length===2,{timeout:20000});
await page.evaluate(()=>{document.body.classList.remove('classroom-locked','auth-checking');const gate=document.getElementById('auth-gate');if(gate){gate.hidden=true;gate.style.display='none'}});
await page.locator('#daily-story').waitFor();
assert.equal(await page.locator('#story-writing').inputValue(),'Je comprends cette histoire.');
assert.equal(await page.locator('#response_recall_0').inputValue(),'test draft in French','Existing draft writing survives reload');
assert.equal(await page.locator('#daily-score').inputValue(),'3.5','Saved score survives reload');
assert.equal(await page.locator('[data-oral-done="0"]').isChecked(),true,'Saved speaking practice survives reload');
assert.match(await page.locator('#main').innerText(),/Weekly practice/);
await page.evaluate(()=>window.classroomSetSection('progress'));
const visibility=await page.evaluate(()=>{const el=document.querySelector('[data-progress-tab="words"]');const box=el?.getBoundingClientRect();const chain=[];for(let n=el;n&&chain.length<8;n=n.parentElement){const c=getComputedStyle(n);const r=n.getBoundingClientRect();chain.push({tag:n.tagName,cls:n.className,display:c.display,visibility:c.visibility,opacity:c.opacity,rect:{x:r.x,y:r.y,w:r.width,h:r.height}})}return {body:document.body.className,section:location.hash,scrollY:window.scrollY,viewport:{w:innerWidth,h:innerHeight},box:box?{x:box.x,y:box.y,w:box.width,h:box.height}:null,chain}});
console.log('Progress navigation diagnostic:',JSON.stringify(visibility));
await page.screenshot({path:path.join(shots,'progress-debug-'+device+'.png'),fullPage:true});
await page.locator('.study-tabs').waitFor({state:'visible',timeout:5000});
await page.locator('[data-progress-tab="words"]').click();
assert.match(await page.locator('#main').innerText(),/My vocabulary notebook/);
assert.ok(await page.locator('.my-word').count()>0,'Saved vocabulary word should be visible');
await page.locator('[data-progress-tab="revision"]').click();
assert.ok(await page.locator('.revision-card').count()>0,'Revision uses actual week questions');
await page.locator('#theme-toggle').click();
assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
await page.locator('#theme-toggle').click();
if(isMobile){
  assert.equal(await page.locator('.mobile-learning-nav').isVisible(),true);
  await page.locator('[data-mobile-action="home"]').click();
  assert.ok(await page.locator('.classroom-home').count()>0,'Mobile dock navigates home');
}
await page.screenshot({path:path.join(shots,'student-'+device+'.png'),fullPage:true});
 if(isMobile){await page.setViewportSize({width:320,height:740});await page.evaluate(()=>window.classroomSetSection('home'));const narrow=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));assert.ok(narrow.scroll<=narrow.width+3,'320px app layout must not overflow: '+JSON.stringify(narrow));await page.screenshot({path:path.join(shots,'home-narrow-'+device+'.png'),fullPage:true});await page.setViewportSize({width:390,height:844})}
 const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
 assert.ok(dimensions.scroll<=dimensions.width+3,'Unexpected horizontal overflow: '+JSON.stringify(dimensions));
 assert.equal(errors.length,0,'Uncaught first-party page errors: '+errors.join('; '));
 // Regression: simulate the screenshot's missing/outdated external stylesheet.
 // Core Home must still be attractive because its essential design is embedded in index.html.
 const fallback=await context.newPage();
 await fallback.route('**/classroom-polish.css*',route=>route.abort());
 await fallback.route('**/app-mobile.css*',route=>route.abort());
 await fallback.route(base+'firebase-auth.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* isolated auth test */'}));
 await fallback.goto(base,{waitUntil:'domcontentloaded'});
 await fallback.waitForFunction(()=>window.classroomGetSyllabus()?.length===2,{timeout:20000});
 const appearance=await fallback.evaluate(()=>{
   document.body.classList.remove('classroom-locked','auth-checking');
   document.getElementById('auth-gate')?.setAttribute('hidden','');
   window.classroomSetSection('home');
   const hero=document.querySelector('.classroom-hero');
   const ring=document.querySelector('.classroom-ring');
   return {gradient:getComputedStyle(hero).backgroundImage,ringWidth:ring.getBoundingClientRect().width,tools:document.querySelectorAll('.app-quick-item').length};
 });
 assert.match(appearance.gradient,/linear-gradient/,'Home hero must remain styled when external CSS fails');
 assert.ok(appearance.ringWidth>60,'Home progress ring must remain styled without external CSS');
 assert.equal(appearance.tools,5,'All five app study areas must remain present');
 assert.ok(await fallback.evaluate(()=>!!document.querySelector('link[href*="app-mobile.css"]')),'App stylesheet must be referenced');
 await fallback.screenshot({path:path.join(shots,'home-css-fallback-'+device+'.png'),fullPage:true});
 await fallback.close();
 await context.close();
};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.CI?'chrome':undefined,args:['--no-sandbox']});
 try{await check(browser,'desktop');await check(browser,'mobile');console.log('Desktop and mobile teacher/student browser smoke tests passed');}
 finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
