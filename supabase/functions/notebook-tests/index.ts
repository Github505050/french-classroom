import { createClient } from 'npm:@supabase/supabase-js@2';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5';
import webpush from 'npm:web-push@3.6.7';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const PROJECT_ID=Deno.env.get('FIREBASE_PROJECT_ID')||'french-classroom';
const ORIGIN='https://github505050.github.io';
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{autoRefreshToken:false,persistSession:false}});
const allowed=/^[A-Za-z0-9_-]{1,75}$/;
const bucket='notebook-tests';
function safeError(e:unknown){console.error(e);return reply({error:'Unable to complete request. Contact your teacher if the problem continues.'},500)}
type PushPayload={title:string,body:string,destination:'home'|'tests'|'myresults',tag:string};
let pushKeysPromise:Promise<string>|null=null;
async function pushPublicKey(){
 if(pushKeysPromise)return pushKeysPromise;
 pushKeysPromise=(async()=>{
  const {data:current,error}=await client.from('classroom_push_settings').select('public_key').eq('singleton',1).maybeSingle();
  if(error)throw error;
  if(current?.public_key)return current.public_key as string;
  const keys=webpush.generateVAPIDKeys();
  const hook=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
  const {data:created,error:err}=await client.rpc('classroom_push_initialize',{p_private:keys.privateKey,p_public:keys.publicKey,p_hook:hook});
  if(err)throw err;
  return created as string;
 })().catch(err=>{pushKeysPromise=null;throw err});
 return pushKeysPromise;
}
const trustedPushHost=(value:string)=>{
 try{const u=new URL(value);const h=u.hostname.toLowerCase();return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&
   (h==='fcm.googleapis.com'||h==='fcmregistrations.googleapis.com'||h==='web.push.apple.com'||h.endsWith('.push.apple.com')||
    h==='updates.push.services.mozilla.com'||h==='push.services.mozilla.com'||h.endsWith('.notify.windows.com'))&&value.length<=2048}
 catch{return false}
};
async function sendPush(toUid:string|null,payload:PushPayload){
 const {data:privateKey,error:secretError}=await client.rpc('classroom_push_secret',{secret_name:'classroom_push_vapid_private'});
 if(secretError||!privateKey)throw secretError||new Error('VAPID key not ready');
 const publicKey=await pushPublicKey();
 webpush.setVapidDetails('https://github505050.github.io/french-classroom/',publicKey,privateKey);
 let q=client.from('classroom_push_subscriptions').select('endpoint,owner_uid,p256dh,auth').limit(500);
 if(toUid)q=q.eq('owner_uid',toUid);
 const {data:rows,error}=await q;if(error)throw error;
 let sent=0;
 for(let i=0;i<(rows||[]).length;i+=8){
  const batch=(rows||[]).slice(i,i+8);
  await Promise.allSettled(batch.map(async row=>{
   try{
    await webpush.sendNotification({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},
     JSON.stringify({title:payload.title,body:payload.body,destination:payload.destination,tag:payload.tag}),
     {TTL:86400,urgency:'normal'});
    sent++;
   }catch(e){
    const code=Number((e as {statusCode?:number})?.statusCode||0);
    if(code===404||code===410)await client.from('classroom_push_subscriptions').delete().eq('endpoint',row.endpoint);
    else console.warn('Push delivery failed',code||'network');
   }
  }));
 }
 return sent;
}
function equalToken(a:string,b:string){if(a.length!==b.length)return false;let delta=0;for(let i=0;i<a.length;i++)delta|=a.charCodeAt(i)^b.charCodeAt(i);return delta===0}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply({error:'Method not supported'},405);
 // Database-triggered publish push is authenticated independently of Firebase.
 if(req.headers.get('x-classroom-push-hook')){
  try{
   const received=req.headers.get('x-classroom-push-hook')||'';
   const {data:secret,error:se}=await client.rpc('classroom_push_secret',{secret_name:'classroom_push_hook'});
   if(se||!secret||!equalToken(received,secret))return reply({error:'Unauthorized webhook'},403);
   const msg=await req.json();
   if(msg.action!=='internalTestPush'||!allowed.test(msg.testId)||typeof msg.title!=='string')return reply({error:'Invalid push event'},400);
   const {data:published,error:pe}=await client.from('notebook_test_definitions').select('test_id,title').eq('test_id',msg.testId).maybeSingle();
   if(pe||!published)return reply({error:'Test unavailable'},404);
   const sent=await sendPush(null,{title:'New French test available',body:published.title.slice(0,100)+' — Open Tests to begin.',destination:'tests',tag:'test:'+published.test_id});
   return reply({ok:true,delivered:sent});
  }catch(e){return safeError(e)}
 }
 if(req.headers.get('origin')!==ORIGIN)return reply({error:'Invalid origin'},403);
 try{
  const jwt=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(!jwt)return reply({error:'Sign in first'},401);
  const {payload}=await jwtVerify(jwt,googleKeys,{issuer:'https://securetoken.google.com/'+PROJECT_ID,audience:PROJECT_ID,algorithms:['RS256']});
  const uid=String(payload.sub||''),email=String(payload.email||'');
  if(!uid||!email)return reply({error:'Firebase account required'},403);
  // Read the signed-in user's own Firebase role document using their Firebase ID token.
  // Firestore security rules allow an account to get its own role, never to edit it.
  const roleUrl='https://firestore.googleapis.com/v1/projects/'+PROJECT_ID+'/databases/(default)/documents/roles/'+encodeURIComponent(uid);
  const roleResponse=await fetch(roleUrl,{headers:{Authorization:'Bearer '+jwt}});
  if(!roleResponse.ok && roleResponse.status!==404)return reply({error:'Unable to verify teacher permissions'},403);
  const roleDocument=roleResponse.ok?await roleResponse.json():null;
  const teacher=roleDocument?.fields?.role?.stringValue==='teacher';
  if(!teacher&&payload.email_verified!==true)return reply({error:'Verify your student email before accessing tests'},403);
  const contentType=req.headers.get('content-type')||'';
  let action='',testId='',submissionId='',files:File[]=[], sectionScores:Record<string,unknown>={}, feedback='',gradeStatus='draft',noticeId='',noticeTitle='',noticeBody='',noticeKind='general',noticeDestination='home';let pushSubscription:any=null,pushEndpoint='';
  if(contentType.includes('multipart/form-data')){
   const form=await req.formData();action=String(form.get('action')||'');testId=String(form.get('testId')||'');
   files=form.getAll('photos').filter((f):f is File=>f instanceof File);
  }else{
   const body=await req.json();action=String(body.action||'');testId=String(body.testId||'');submissionId=String(body.submissionId||'');sectionScores=body.sectionScores||{};feedback=String(body.feedback||'');gradeStatus=String(body.gradeStatus||'draft');noticeId=String(body.noticeId||'');noticeTitle=String(body.title||'');noticeBody=String(body.body||'');noticeKind=String(body.kind||'general');noticeDestination=String(body.destination||'home');pushSubscription=body.pushSubscription||null;pushEndpoint=String(body.pushEndpoint||'');
  }
  if(action==='pushConfig'){
   const publicKey=await pushPublicKey();
   return reply({publicKey});
  }
  if(action==='registerPush'){
   const entry=pushSubscription;
   if(!entry||typeof entry!=='object'||Array.isArray(entry))return reply({error:'Invalid push subscription'},400);
   const endpoint=String(entry.endpoint||''),p256dh=String(entry.keys?.p256dh||''),authKey=String(entry.keys?.auth||'');
   if(!trustedPushHost(endpoint)||!/^[A-Za-z0-9_-]{40,256}$/.test(p256dh)||!/^[A-Za-z0-9_-]{10,256}$/.test(authKey))return reply({error:'Unrecognized push subscription'},400);
   await pushPublicKey();
   const {error}=await client.from('classroom_push_subscriptions').upsert({endpoint,owner_uid:uid,p256dh,auth:authKey,updated_at:new Date().toISOString()},{onConflict:'endpoint'});
   if(error)throw error;
   return reply({ok:true});
  }
  if(action==='unregisterPush'){
   if(typeof pushEndpoint!=='string'||pushEndpoint.length>2048)return reply({error:'Invalid subscription'},400);
   const {error}=await client.from('classroom_push_subscriptions').delete().eq('owner_uid',uid).eq('endpoint',pushEndpoint);
   if(error)throw error;
   return reply({ok:true});
  }
  if(action==='pushStatus'){
   const {count,error}=await client.from('classroom_push_subscriptions').select('endpoint',{head:true,count:'exact'}).eq('owner_uid',uid);
   if(error)throw error;
   return reply({devices:count||0});
  }
  if(action==='notifications'){
   const [posts,results,reads,availableTests]=await Promise.all([
     client.from('classroom_announcements').select('id,title,body,kind,destination,created_at').eq('active',true).order('created_at',{ascending:false}).limit(80),
     client.from('notebook_test_results').select('test_id,published_at').eq('owner_uid',uid).eq('status','published').order('published_at',{ascending:false}).limit(80),
     client.from('classroom_notification_reads').select('notice_id').eq('owner_uid',uid).limit(300),
     client.from('notebook_test_definitions').select('test_id,title,published_at').order('published_at',{ascending:false}).limit(80)
   ]);
   if(posts.error)throw posts.error;
   if(results.error)throw results.error;
   if(reads.error)throw reads.error;
   if(availableTests.error)throw availableTests.error;
   const seen=new Set((reads.data||[]).map(r=>r.notice_id));
   const notices=[
     ...(posts.data||[]).map(p=>({id:'post:'+p.id,title:p.title,body:p.body,kind:p.kind,destination:p.destination,createdAt:p.created_at})),
     ...(availableTests.data||[]).map(t=>({id:'test:'+t.test_id,title:'French test available: '+t.title,body:'Your teacher has assigned a classroom assessment. Open Tests to read the questions and submit your notebook answers.',kind:'test',destination:'tests',createdAt:t.published_at})),
     ...(results.data||[]).filter(r=>r.published_at).map(r=>({id:'result:'+r.test_id,title:'Your test results are available',body:'Your teacher has published the marks and feedback for a completed assessment. Open My Results to see your report.',kind:'result',destination:'myresults',createdAt:r.published_at}))
   ].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,100);
   return reply({notices:notices.map(n=>({...n,read:seen.has(n.id)}))});
  }
  if(action==='readNotification'){
   if(!/^(post:[0-9a-f-]{36}|result:[A-Za-z0-9_-]{1,75}|test:[A-Za-z0-9_-]{1,75})$/.test(noticeId))return reply({error:'Invalid notice'},400);
   if(noticeId.startsWith('post:')){
     const {data,error}=await client.from('classroom_announcements').select('id').eq('id',noticeId.slice(5)).eq('active',true).maybeSingle();
     if(error)throw error;if(!data)return reply({error:'Notice unavailable'},404);
   }else if(noticeId.startsWith('test:')){
     const test=noticeId.slice(5);
     const {data,error}=await client.from('notebook_test_definitions').select('test_id').eq('test_id',test).maybeSingle();
     if(error)throw error;if(!data)return reply({error:'Notice unavailable'},404);
   }else{
     const test=noticeId.slice(7);
     const {data,error}=await client.from('notebook_test_results').select('test_id').eq('owner_uid',uid).eq('test_id',test).eq('status','published').maybeSingle();
     if(error)throw error;if(!data)return reply({error:'Notice unavailable'},404);
   }
   const {error}=await client.from('classroom_notification_reads').upsert({owner_uid:uid,notice_id:noticeId},{onConflict:'owner_uid,notice_id',ignoreDuplicates:true});
   if(error)throw error;return reply({ok:true});
  }
  if(action==='publishAnnouncement'){
   if(!teacher)return reply({error:'Teacher access required'},403);
   noticeTitle=noticeTitle.trim();noticeBody=noticeBody.trim();
   if(!noticeTitle||noticeTitle.length>120||!noticeBody||noticeBody.length>1200)return reply({error:'Enter a title (up to 120 characters) and a message (up to 1200 characters)'},400);
   if(!['general','test','reminder'].includes(noticeKind)||!['home','tests','myresults'].includes(noticeDestination))return reply({error:'Invalid announcement category'},400);
   const {data,error}=await client.from('classroom_announcements').insert({title:noticeTitle,body:noticeBody,kind:noticeKind,destination:noticeDestination,created_by:uid}).select('id').single();
   if(error)throw error;
   let pushDelivered=0;
   try{pushDelivered=await sendPush(null,{title:noticeTitle,body:noticeBody.slice(0,180),destination:noticeDestination as PushPayload['destination'],tag:'post:'+data.id})}
   catch(pushError){console.error('Announcement published but push delivery failed',pushError)}
   return reply({ok:true,id:data.id,pushDelivered});
  }
  if(action==='retireAnnouncement'){
   if(!teacher)return reply({error:'Teacher access required'},403);
   if(!/^[0-9a-f-]{36}$/.test(noticeId))return reply({error:'Invalid notice'},400);
   const {error}=await client.from('classroom_announcements').update({active:false}).eq('id',noticeId);
   if(error)throw error;return reply({ok:true});
  }
  if(action==='teacherAnnouncements'){
   if(!teacher)return reply({error:'Teacher access required'},403);
   const {data,error}=await client.from('classroom_announcements').select('id,title,body,kind,destination,created_at,active').order('created_at',{ascending:false}).limit(100);
   if(error)throw error;return reply({posts:data||[]});
  }
  if(action==='upload'){
   if(teacher)return reply({error:'Student account required'},403);
   if(!allowed.test(testId))return reply({error:'Invalid test ID'},400);
   if(files.length<1||files.length>8)return reply({error:'Choose 1–8 photos'},400);
   if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size<1||f.size>8*1024*1024))return reply({error:'Each image must be a JPEG, PNG or WebP smaller than 8 MB'},400);
   const id=crypto.randomUUID(),images:string[]=[];
   for(let i=0;i<files.length;i++){
    const f=files[i],extension=f.type==='image/png'?'png':f.type==='image/webp'?'webp':'jpg';
    const path=uid+'/'+testId+'/'+id+'/page'+(i+1)+'.'+extension;
    const {error}=await client.storage.from(bucket).upload(path,await f.arrayBuffer(),{contentType:f.type,upsert:false});
    if(error){if(images.length)await client.storage.from(bucket).remove(images);throw error}
    images.push(path);
   }
   const {error}=await client.from('notebook_submissions').insert({id,owner_uid:uid,student_email:email,test_id:testId,images,page_count:images.length});
   if(error){await client.storage.from(bucket).remove(images);throw error}
   return reply({submissionId:id,pageCount:images.length});
  }
  if(action==='mine'){
   if(!allowed.test(testId))return reply({error:'Invalid test'},400);
   const {data,error}=await client.from('notebook_submissions').select('id,owner_uid,student_email,test_id,page_count,submitted_at').eq('owner_uid',uid).eq('test_id',testId).order('submitted_at',{ascending:false}).limit(100);
   if(error)throw error;return reply({submissions:(data||[]).map(s=>({id:s.id,ownerUid:s.owner_uid,studentEmail:s.student_email,testId:s.test_id,pageCount:s.page_count,submittedAt:{seconds:Math.floor(new Date(s.submitted_at).getTime()/1000)}}))});
  }
  if(action==='myResults'){
   // One authenticated read for the student's own submissions and published grades.
   // Draft grades and other students' records are deliberately excluded.
   const [submissionRows,gradeRows]=await Promise.all([
    client.from('notebook_submissions').select('id,test_id,page_count,submitted_at').eq('owner_uid',uid).order('submitted_at',{ascending:false}).limit(300),
    client.from('notebook_test_results').select('test_id,section_scores,total,feedback,published_at').eq('owner_uid',uid).eq('status','published').limit(300)
   ]);
   if(submissionRows.error)throw submissionRows.error;
   if(gradeRows.error)throw gradeRows.error;
   const counts:Record<string,{count:number,pages:number,latestSubmittedAt:string}>={};
   for(const row of submissionRows.data||[]){
    if(!counts[row.test_id])counts[row.test_id]={count:0,pages:0,latestSubmittedAt:row.submitted_at};
    counts[row.test_id].count++;
    counts[row.test_id].pages+=row.page_count;
   }
   return reply({submissions:counts,results:(gradeRows.data||[]).map(g=>({
    testId:g.test_id,sectionScores:g.section_scores,total:g.total,
    feedback:g.feedback,publishedAt:g.published_at,status:'published'
   }))});
  }
  if(action==='result'){
   if(!allowed.test(testId))return reply({error:'Invalid test'},400);
   const {data,error}=await client.from('notebook_test_results')
     .select('test_id,section_scores,total,feedback,published_at,status')
     .eq('owner_uid',uid).eq('test_id',testId).eq('status','published').maybeSingle();
   if(error)throw error;
   return reply({result:data?{testId:data.test_id,sectionScores:data.section_scores,total:data.total,feedback:data.feedback,publishedAt:data.published_at,status:'published'}:null});
  }
  if(action==='grade'){
   if(!teacher)return reply({error:'Teacher access required'},403);
   if(!/^[0-9a-f-]{36}$/.test(submissionId))return reply({error:'Invalid submission'},400);
   const {data:sub,error:subErr}=await client.from('notebook_submissions').select('owner_uid,test_id').eq('id',submissionId).maybeSingle();
   if(subErr)throw subErr;
   if(!sub)return reply({error:'Submission not found'},404);
   const {data:def,error:defErr}=await client.from('notebook_test_definitions').select('section_limits,max_marks').eq('test_id',sub.test_id).maybeSingle();
   if(defErr)throw defErr;
   if(!def)return reply({error:'Test grading rubric not configured'},400);
   if(sectionScores===null||typeof sectionScores!=='object'||Array.isArray(sectionScores))return reply({error:'Invalid marks'},400);
   const limits=def.section_limits as Record<string,number>;
   const given=Object.keys(sectionScores);
   if(given.some(key=>!(key in limits)))return reply({error:'Unknown grading section'},400);
   for(const [section,points] of Object.entries(sectionScores)){
    if(!Number.isInteger(points)||Number(points)<0||Number(points)>limits[section])return reply({error:'Score out of range for '+section},400);
   }
   const total=Object.values(sectionScores).reduce((n,p)=>n+Number(p),0);
   if(total>def.max_marks)return reply({error:'Score exceeds test maximum'},400);
   if(feedback.length>5000)return reply({error:'Feedback is too long'},400);
   const status=action==='grade'&&gradeStatus==='published'?'published':'draft';
   if(status==='published'&&given.length!==Object.keys(limits).length)return reply({error:'Mark every section before publishing'},400);
   const {data:existing,error:exErr}=await client.from('notebook_test_results').select('status').eq('owner_uid',sub.owner_uid).eq('test_id',sub.test_id).maybeSingle();
   if(exErr)throw exErr;
   if(existing?.status==='published'&&status!=='published')return reply({error:'Published grades can only be changed by publishing an updated result'},409);
   const record={owner_uid:sub.owner_uid,test_id:sub.test_id,section_scores:sectionScores,feedback,status,total,graded_by:uid,graded_at:new Date().toISOString(),published_at:status==='published'?new Date().toISOString():null};
   const {error}=await client.from('notebook_test_results').upsert(record,{onConflict:'owner_uid,test_id'});
   if(error)throw error;
   if(status==='published'){
    try{await sendPush(sub.owner_uid,{title:'Your French test results are ready',body:'Your teacher has published your marks and feedback. Tap to view My Results.',destination:'myresults',tag:'result:'+sub.test_id})}
    catch(pushError){console.error('Grades published but push delivery failed',pushError)}
   }
   return reply({result:{status,total,sectionScores,feedback}});
  }
  if(action==='teacherList'){
   if(!teacher)return reply({error:'Teacher access required'},403);
   const {data,error}=await client.from('notebook_submissions').select('id,owner_uid,student_email,test_id,page_count,submitted_at').order('submitted_at',{ascending:false}).limit(200);
   if(error)throw error;
   const {data:grades,error:gradeErr}=await client.from('notebook_test_results').select('owner_uid,test_id,section_scores,feedback,total,status,published_at');
   if(gradeErr)throw gradeErr;
   const results=new Map((grades||[]).map(g=>[g.owner_uid+'|'+g.test_id,{sectionScores:g.section_scores,feedback:g.feedback,total:g.total,status:g.status,publishedAt:g.published_at}]));
   return reply({submissions:(data||[]).map(s=>({id:s.id,ownerUid:s.owner_uid,studentEmail:s.student_email,testId:s.test_id,pageCount:s.page_count,submittedAt:{seconds:Math.floor(new Date(s.submitted_at).getTime()/1000)},result:results.get(s.owner_uid+'|'+s.test_id)||null}))});
  }
  if(action==='photoUrls'){
   if(!/^[0-9a-f-]{36}$/.test(submissionId))return reply({error:'Invalid submission'},400);
   const {data:s,error}=await client.from('notebook_submissions').select('images,owner_uid').eq('id',submissionId).single();
   if(error||!s)return reply({error:'Submission not found'},404);
   if(s.owner_uid!==uid&&!teacher)return reply({error:'Access denied'},403);
   const {data,error:signError}=await client.storage.from(bucket).createSignedUrls(s.images,300);
   if(signError||!data||data.some(item=>item.error))throw signError||new Error('Cannot sign all images');
   return reply({urls:data.map(x=>x.signedUrl)});
  }
  return reply({error:'Unknown operation'},400);
 }catch(e){return safeError(e)}
});
