/* Supabase notebook uploads use a protected Edge Function; Firebase remains the login provider. */
import { firebaseConfig } from './firebase-config.js';
import { getApp,getApps,initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
const app=getApps().length?getApp():initializeApp(firebaseConfig),auth=getAuth(app);
const error=e=>String(e?.message||e?.code||'Supabase upload unavailable');
let config;
async function endpoint(){
 if(!config){const r=await fetch('./supabase-config.json',{cache:'no-store'});if(!r.ok)throw Error('Supabase configuration missing');config=await r.json()}
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url||''))throw Error('Supabase project not connected. Ask your teacher to complete Supabase setup.');
 return config.url+'/functions/v1/notebook-tests';
}
async function shrinkPhoto(file){
 // Resize camera photos before transmission to preserve legible handwriting with less mobile data.
 // Never increase resolution. Use white background for transparent images.
 if(file.size<550000)return file;
 const url=URL.createObjectURL(file);
 try{
  const img=await new Promise((resolve,reject)=>{const el=new Image();el.onload=()=>resolve(el);el.onerror=()=>reject(Error('Cannot read image '+file.name));el.src=url});
  const scale=Math.min(1,2200/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Image processing unavailable');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));
  if(!blob||blob.size>=file.size)return file;
  return new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg'});
 }finally{URL.revokeObjectURL(url)}
}
async function call(action,{testId,files,submissionId,sectionScores,feedback,gradeStatus,noticeId,title,body,kind,destination,pushSubscription,pushEndpoint,reportPath,reportName,reportFile,reportMode,photoIndex}={},onProgress){
 const user=auth.currentUser;if(!user)throw Error('Sign in to upload notebook photos.');
 const token=await user.getIdToken();const url=await endpoint();
 const request={method:'POST',headers:{Authorization:'Bearer '+token}};
 if(action==='uploadReport'){
  if(!(reportFile instanceof File))throw Error('Choose a correction report.');
  const extension=reportFile.name.split('.').pop()?.toLowerCase();
  if(!['pdf','docx','txt'].includes(extension)||reportFile.size<1||reportFile.size>10*1024*1024)throw Error('Use a PDF, DOCX or TXT report smaller than 10 MB.');
  if(!/^[0-9a-f-]{36}$/.test(submissionId||''))throw Error('Choose a student submission.');
  const form=new FormData();form.append('action',action);form.append('submissionId',submissionId);form.append('report',reportFile);
  request.body=form;
 }else if(action==='upload'){
  const photos=Array.from(files||[]);if(!/^[A-Za-z0-9_-]{1,75}$/.test(testId||''))throw Error('Invalid test ID.');
  if(!photos.length||photos.length>8)throw Error('Choose 1 to 8 photos.');
  for(const f of photos){if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>8*1024*1024)throw Error('Use JPEG, PNG or WebP images smaller than 8 MB each.')}
  const optimized=[];for(const photo of photos)optimized.push(await shrinkPhoto(photo));
  const bytes=optimized.reduce((n,f)=>n+f.size,0);
  if(bytes>16*1024*1024)throw Error('The selected photos are too large together. Upload fewer pages at a time.');
  const form=new FormData();form.append('action',action);form.append('testId',testId);optimized.forEach(f=>form.append('photos',f));
  request.body=form;
 }else{
  request.headers['Content-Type']='application/json';request.body=JSON.stringify({action,testId,submissionId,sectionScores,feedback,gradeStatus,noticeId,title,body,kind,destination,pushSubscription,pushEndpoint,reportPath,reportName,reportMode,photoIndex});
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
 myResults:async()=>call('myResults'),
 notifications:async()=>call('notifications'),
 pushConfig:async()=>call('pushConfig'),
 registerPush:async pushSubscription=>call('registerPush',{pushSubscription}),
 unregisterPush:async pushEndpoint=>call('unregisterPush',{pushEndpoint}),
 pushStatus:async()=>call('pushStatus'),
 readNotification:async noticeId=>call('readNotification',{noticeId}),
 publishAnnouncement:async(title,body,kind,destination)=>call('publishAnnouncement',{title,body,kind,destination}),
 teacherAnnouncements:async()=>call('teacherAnnouncements'),
 retireAnnouncement:async noticeId=>call('retireAnnouncement',{noticeId}),
 uploadReport:async(submissionId,reportFile)=>call('uploadReport',{submissionId,reportFile}),
 reportUrl:async(testId,submissionId,reportMode='download')=>call('reportUrl',{testId,submissionId,reportMode}),
 removePhoto:async(submissionId,photoIndex)=>call('removePhoto',{submissionId,photoIndex}),
 photoZip:async submissionId=>{
  const user=auth.currentUser;if(!user)throw Error('Sign in to download notebook photos.');
  const token=await user.getIdToken();
  const response=await fetch(await endpoint(),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action:'photoZip',submissionId})});
  if(!response.ok){const info=await response.json().catch(()=>({}));throw Error(info.error||'Photo download failed.');}
  const blob=await response.blob();
  if(blob.type!=='application/zip'||blob.size<1)throw Error('Invalid notebook photo archive received.');
  return blob;
 },
 grade:async(submissionId,sectionScores,feedback,gradeStatus,reportPath,reportName)=> (await call('grade',{submissionId,sectionScores,feedback,gradeStatus,reportPath,reportName})).result,
 error
};
window.dispatchEvent(new Event('classroom-test-uploads-ready'));
onAuthStateChanged(auth,user=>{window.dispatchEvent(new CustomEvent('classroom-auth-state',{detail:{uid:user?.uid||null}}));if(user)window.dispatchEvent(new Event('classroom-auth-ready'))});
