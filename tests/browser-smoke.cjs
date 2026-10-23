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
 if(isMobile){
   const nav=page.locator('#navigation');
   assert.equal(await nav.isVisible(),false,'Mobile nav should be collapsed');
   await page.locator('#mobile-menu-toggle').click();
   assert.equal(await nav.isVisible(),true,'Mobile menu must open');
   await page.locator('.navbtn[data-section="home"]').click();
   assert.equal(await nav.isVisible(),false,'Mobile menu must close after selection');
 }
 await page.locator('[data-go="foundations"]').first().click();
 await page.locator('#foundation-week-select').waitFor();
 await page.locator('#foundation-week-select').selectOption('1');
 assert.match(await page.locator('#foundation-lesson').innerText(),/DAY 8/);
 await page.locator('#foundation-back-home').click();
 assert.ok(await page.locator('.classroom-home').count()>0,'Foundation back to home must work');
 await page.locator('[data-go="lessons"]').first().click();
 assert.match(await page.locator('#main').innerText(),/Choose a week and day/);
 await page.locator('[data-back-section="home"]').first().click();
 assert.ok(await page.locator('.classroom-home').count()>0);

// Guided study, vocabulary notebook, responsive navigation and refresh persistence.
await page.evaluate(()=>{window.classroomSetSection('weekoverview')});
await page.locator('#weekselect').selectOption('0');
await page.locator('[data-day="4"]').first().click();
await page.locator('[data-go="practice"]').first().click();
assert.match(await page.locator('#main').innerText(),/Today's learning journey/);
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
assert.match(await page.locator('#main').innerText(),/Today's learning journey/);
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
  await page.locator('[data-mobile-section="home"]').click();
  assert.ok(await page.locator('.classroom-home').count()>0,'Mobile dock navigates home');
}
await page.screenshot({path:path.join(shots,'student-'+device+'.png'),fullPage:true});
 const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
 assert.ok(dimensions.scroll<=dimensions.width+3,'Unexpected horizontal overflow: '+JSON.stringify(dimensions));
 assert.equal(errors.length,0,'Uncaught first-party page errors: '+errors.join('; '));
 await context.close();
};
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{await check(browser,'desktop');await check(browser,'mobile');console.log('Desktop and mobile teacher/student browser smoke tests passed');}
 finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
