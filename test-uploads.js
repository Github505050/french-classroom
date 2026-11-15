/* Supabase notebook uploads use a protected Edge Function; Firebase remains the login provider. */
import { firebaseConfig } from './firebase-config.js';
import { getApp,getApps,initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
const app=getApps().length?getApp():initializeApp(firebaseConfig),auth=getAuth(app);
const error=e=>String(e?.message||e?.code||'Supabase upload unavailable');
let config;
async function endpoint(){
 if(!config){const r=await fetch('./supabase-config.json',{cache:'no-store'});if(!r.ok)throw Error('Supabase configuration missing');config=await r.json()}
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url||''))throw Error('Supabase project not connected. Ask your teacher to complete Supabase setup.');
 return config.url+'/functions/v1/notebook-tests';
}
async function call(action,{testId,files,submissionId,sectionScores,feedback,gradeStatus}={},onProgress){
 const user=auth.currentUser;if(!user)throw Error('Sign in to upload notebook photos.');
 const token=await user.getIdToken();const url=await endpoint();
 const request={method:'POST',headers:{Authorization:'Bearer '+token}};
 if(action==='upload'){
  const photos=Array.from(files||[]);if(!/^[A-Za-z0-9_-]{1,75}$/.test(testId||''))throw Error('Invalid test ID.');
  if(!photos.length||photos.length>8)throw Error('Choose 1 to 8 photos.');
  for(const f of photos){if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>8*1024*1024)throw Error('Use JPEG, PNG or WebP images smaller than 8 MB each.')}
  const form=new FormData();form.append('action',action);form.append('testId',testId);photos.forEach(f=>form.append('photos',f));
  request.body=form;
 }else{
  request.headers['Content-Type']='application/json';request.body=JSON.stringify({action,testId,submissionId,sectionScores,feedback,gradeStatus});
 }
 const result=await fetch(url,request);
 const data=await result.json().catch(()=>({error:'Invalid server response'}));
 if(!result.ok)throw Error(data.error||'Server error '+result.status);
 if(action==='upload')onProgress?.(data.pageCount||0,data.pageCount||0);
 return data;
}
window.classroomTestUploads={
 upload:async(testId,files,progress)=>call('upload',{testId,files},progress),
 mine:async testId=>(await call('mine',{testId})).submissions,
 teacherList:async()=>(await call('teacherList')).submissions,
 urls:async sub=>(await call('photoUrls',{submissionId:sub.id})).urls,
 result:async testId=>(await call('result',{testId})).result,
 grade:async(submissionId,sectionScores,feedback,gradeStatus)=> (await call('grade',{submissionId,sectionScores,feedback,gradeStatus})).result,
 error
};
window.dispatchEvent(new Event('classroom-test-uploads-ready'));
