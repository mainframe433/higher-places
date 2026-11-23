/* ======================= circles: a tiny Supabase client (no library needed) ======================= */
function hpDB(URL,KEY,store){
  const SK='hp_sb';let S=null,refreshing=null;
  try{S=JSON.parse(store.getItem(SK)||'null')}catch(e){S=null}
  const save=()=>{try{S?store.setItem(SK,JSON.stringify(S)):store.removeItem(SK)}catch(e){}};
  const keep=j=>{if(!j||!j.access_token)throw new Error('no session');S={a:j.access_token,r:j.refresh_token,e:j.expires_at||Math.floor(Date.now()/1000)+(j.expires_in||3600),u:j.user&&j.user.id||(S&&S.u)};save()};
  async function req(path,o={}){
    const h=Object.assign({apikey:KEY},o.headers||{});let body=o.body;
    if(o.auth!==false){await fresh();h.Authorization='Bearer '+S.a}
    if(body!==undefined&&!(typeof Blob!=='undefined'&&body instanceof Blob)&&!(body instanceof Uint8Array)){h['Content-Type']='application/json';body=JSON.stringify(body)}
    let r;try{r=await fetch(URL+path,{method:o.method||'GET',headers:h,body})}catch(e){const er=new Error('offline');er.offline=true;throw er}
    const txt=await r.text();let j=null;try{j=txt?JSON.parse(txt):null}catch(e){j=txt}
    if(!r.ok){const er=new Error((j&&(j.message||j.msg||j.error_description||j.error))||('HTTP '+r.status));er.status=r.status;er.body=j;throw er}
    return j}
  async function fresh(){
    if(!S)throw new Error('not signed in');
    if(S.e-90>Date.now()/1000)return;
    refreshing=refreshing||req('/auth/v1/token?grant_type=refresh_token',{method:'POST',auth:false,body:{refresh_token:S.r}})
      .then(keep,e=>{if(e.status>=400&&e.status<500){S=null;save()}throw e}).finally(()=>{refreshing=null});
    await refreshing}
  const row=j=>Array.isArray(j)?j[0]||null:j;
  return{
    me:()=>S&&S.u,
    signedIn:()=>!!S,
    async signIn(){if(S)return S.u;keep(await req('/auth/v1/signup',{method:'POST',auth:false,body:{data:{}}}));return S.u},
    forget(){S=null;save()},
    sel:(t,q)=>req('/rest/v1/'+t+'?'+q),
    ins:(t,r,q='')=>req('/rest/v1/'+t+(q?'?'+q:''),{method:'POST',body:r,headers:{Prefer:'return=representation'}}).then(row),
    upsert:(t,r)=>req('/rest/v1/'+t,{method:'POST',body:r,headers:{Prefer:'resolution=merge-duplicates,return=representation'}}).then(row),
    del:(t,q)=>req('/rest/v1/'+t+'?'+q,{method:'DELETE',headers:{Prefer:'return=representation'}}),
    rpc:(f,a)=>req('/rest/v1/rpc/'+f,{method:'POST',body:a}).then(j=>{j=row(j);return j&&j.id?j:null}),
    upload:(b,p,blob,type)=>req('/storage/v1/object/'+b+'/'+p,{method:'POST',body:blob,headers:{'Content-Type':type||blob.type,'x-upsert':'false'}}),
    sign:(b,paths,sec)=>req('/storage/v1/object/sign/'+b,{method:'POST',body:{expiresIn:sec,paths}}).then(a=>{const m={};(a||[]).forEach(x=>{if(x&&x.signedURL)m[x.path]=URL+'/storage/v1'+x.signedURL});return m}),
    unlink:(b,paths)=>req('/storage/v1/object/'+b,{method:'DELETE',body:{prefixes:paths}})
  }}
