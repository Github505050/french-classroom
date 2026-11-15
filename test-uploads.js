/* Private notebook-test submissions; imports use the site's existing Firebase app. */
import { firebaseConfig } from './firebase-config.js';
import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';
const app=getApps().length?getApp():initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),storage=getStorage(app);
const studentPath=(uid,test,submission,file)=>'notebookTests/'+uid+'/'+test+'/'+submission+'/'+file;
const err=e=>String(e?.code||e?.message||'Upload unavailable');
function ready(){
 const u=auth.currentUser;
 if(!u||!u.emailVerified)throw Error('Please sign in with a verified student account.');
 return u;
}
function sanitize(value){return String(value||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,75)}
async function upload(testId,files,onProgress){
 const user=ready(),test=sanitize(testId);if(!test||test!==testId)throw Error('Invalid test ID.');
 const array=Array.from(files||[]);
 if(!array.length||array.length>8)throw Error('Select 1 to 8 notebook photos.');
 for(const f of array){if(!['image/jpeg','image/png','image/webp'].includes(f.type))throw Error('Only JPEG, PNG or WebP photos are supported.');if(f.size>8*1024*1024)throw Error('Each photo must be smaller than 8 MB.')}
 const submissionId='s'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10),paths=[];
 try{
  for(let i=0;i<array.length;i++){
   const f=array[i],ext=f.type==='image/png'?'png':f.type==='image/webp'?'webp':'jpg';
   const path=studentPath(user.uid,test,submissionId,'page'+(i+1)+'.'+ext);
   await uploadBytes(ref(storage,path),f,{contentType:f.type,customMetadata:{testId:test}});
   paths.push(path);onProgress?.(i+1,array.length);
  }
  await setDoc(doc(db,'testSubmissions',submissionId),{
   ownerUid:user.uid,testId:test,images:paths,pageCount:paths.length,status:'submitted',
   submittedAt:serverTimestamp(),studentEmail:user.email||''
  });
  return {submissionId,pageCount:paths.length};
 }catch(e){
  await Promise.allSettled(paths.map(path=>deleteObject(ref(storage,path))));
  throw e;
 }
}
async function mine(testId){
 const u=ready(),snap=await getDocs(query(collection(db,'testSubmissions'),where('ownerUid','==',u.uid)));
 return snap.docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.ownerUid===u.uid&&s.testId===testId).sort((a,b)=>(b.submittedAt?.seconds||0)-(a.submittedAt?.seconds||0));
}
async function teacherList(){
 const u=ready(),role=await getDoc(doc(db,'roles',u.uid));
 if(role.data()?.role!=='teacher')throw Error('Teacher access required.');
 const snap=await getDocs(collection(db,'testSubmissions'));
 return snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.submittedAt?.seconds||0)-(a.submittedAt?.seconds||0));
}
async function urls(sub){
 return Promise.all((sub.images||[]).map(path=>getDownloadURL(ref(storage,path))));
}
window.classroomTestUploads={upload,mine,teacherList,urls,error:err};
window.dispatchEvent(new Event('classroom-test-uploads-ready'));
