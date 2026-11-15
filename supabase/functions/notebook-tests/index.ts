import { createClient } from 'npm:@supabase/supabase-js@2';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5';
const googleKeys=createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
const PROJECT_ID=Deno.env.get('FIREBASE_PROJECT_ID')||'french-classroom';
const ORIGIN='https://github505050.github.io';
const cors={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{autoRefreshToken:false,persistSession:false}});
const allowed=/^[A-Za-z0-9_-]{1,75}$/;
const bucket='notebook-tests';
function safeError(e:unknown){console.error(e);return reply({error:'Unable to complete request. Contact your teacher if the problem continues.'},500)}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply({error:'Method not supported'},405);
 if(req.headers.get('origin')!==ORIGIN)return reply({error:'Invalid origin'},403);
 try{
  const jwt=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(!jwt)return reply({error:'Sign in first'},401);
  const {payload}=await jwtVerify(jwt,googleKeys,{issuer:'https://securetoken.google.com/'+PROJECT_ID,audience:PROJECT_ID,algorithms:['RS256']});
  const uid=String(payload.sub||''),email=String(payload.email||'');
  if(!uid||!email||payload.email_verified!==true)return reply({error:'Verified Firebase account required'},403);
  // Read the signed-in user's own Firebase role document using their Firebase ID token.
  // Firestore security rules allow an account to get its own role, never to edit it.
  const roleUrl='https://firestore.googleapis.com/v1/projects/'+PROJECT_ID+'/databases/(default)/documents/roles/'+encodeURIComponent(uid);
  const roleResponse=await fetch(roleUrl,{headers:{Authorization:'Bearer '+jwt}});
  if(!roleResponse.ok && roleResponse.status!==404)return reply({error:'Unable to verify teacher permissions'},403);
  const roleDocument=roleResponse.ok?await roleResponse.json():null;
  const teacher=roleDocument?.fields?.role?.stringValue==='teacher';
  const contentType=req.headers.get('content-type')||'';
  let action='',testId='',submissionId='',files:File[]=[], sectionScores:Record<string,unknown>={}, feedback='',gradeStatus='draft';
  if(contentType.includes('multipart/form-data')){
   const form=await req.formData();action=String(form.get('action')||'');testId=String(form.get('testId')||'');
   files=form.getAll('photos').filter((f):f is File=>f instanceof File);
  }else{
   const body=await req.json();action=String(body.action||'');testId=String(body.testId||'');submissionId=String(body.submissionId||'');sectionScores=body.sectionScores||{};feedback=String(body.feedback||'');gradeStatus=String(body.gradeStatus||'draft');
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
