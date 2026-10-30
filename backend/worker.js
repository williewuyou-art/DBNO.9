const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_EXT = new Set(["pdf","doc","docx","xls","xlsx","zip","png","jpg","jpeg","webp"]);
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = env.ALLOWED_ORIGIN || "*";
    const cors = {"Access-Control-Allow-Origin": allowed === "*" ? "*" : (origin === allowed ? allowed : allowed), "Access-Control-Allow-Methods":"GET,POST,OPTIONS", "Access-Control-Allow-Headers":"Content-Type", "Vary":"Origin"};
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:cors});
    const url = new URL(request.url);
    try {
      if (url.pathname === "/health" && request.method === "GET") return reply({ok:true,service:"DabenNo9 Report API"},200,cors);
      if (url.pathname === "/public-list" && request.method === "GET") {
        const manifest = await getManifest(env);
        return reply({files:manifest.files.filter(x=>x.published !== false)},200,cors);
      }
      if (url.pathname === "/upload" && request.method === "POST") return await upload(request,env,cors);
      if (url.pathname === "/manage" && request.method === "POST") return await manage(request,env,cors);
      return reply({error:"Not found"},404,cors);
    } catch (e) { return reply({error:e.message || "伺服器錯誤"},500,cors); }
  }
};
function reply(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{...headers,"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}})}
function ghHeaders(env){return {"Authorization":`Bearer ${env.GITHUB_TOKEN}`,"Accept":"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"}}
function repoUrl(env,path=""){return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}`}
async function getManifest(env){const r=await fetch(repoUrl(env,"reports.json"),{headers:ghHeaders(env)});if(!r.ok){if(r.status===404)return {files:[]};throw new Error("讀取 reports.json 失敗："+r.status)}const d=await r.json();let parsed;try{parsed=JSON.parse(atob((d.content||"").replace(/\n/g,"")))}catch{throw new Error("reports.json 格式錯誤，請先修正檔案內容")};if(!Array.isArray(parsed.files))parsed.files=[];return {...parsed,_sha:d.sha}}
function encodeUtf8Base64(str){const bytes=new TextEncoder().encode(str);let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(binary)}
async function saveManifest(env,manifest,message){const body={message,content:encodeUtf8Base64(JSON.stringify({files:manifest.files},null,2))};if(manifest._sha)body.sha=manifest._sha;const r=await fetch(repoUrl(env,"reports.json"),{method:"PUT",headers:ghHeaders(env),body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error("更新報告清單失敗："+(d.message||r.status));return d}
async function upload(request,env,cors){const form=await request.formData();if(!auth(String(form.get("password")||""),env))return reply({error:"管理密碼錯誤"},401,cors);const file=form.get("file"),name=String(form.get("name")||"").trim();if(!(file instanceof File)||!name)return reply({error:"缺少檔案或報告名稱"},400,cors);if(file.size>MAX_FILE_SIZE)return reply({error:"單一檔案上限為 20 MB"},413,cors);const ext=(file.name.split('.').pop()||'').toLowerCase();if(!ALLOWED_EXT.has(ext))return reply({error:"不支援的檔案格式"},415,cors);if(!env.GITHUB_OWNER||!env.GITHUB_REPO||!env.GITHUB_TOKEN)return reply({error:"後端 GitHub 設定不完整"},500,cors);
 const safe=file.name.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g,"_").replace(/^\.+/,"").slice(-100)||`report.${ext}`;const path=`reports/${Date.now()}_${safe}`;const bytes=new Uint8Array(await file.arrayBuffer());let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));const r=await fetch(repoUrl(env,path),{method:"PUT",headers:ghHeaders(env),body:JSON.stringify({message:`Upload report: ${safe}`,content:btoa(binary)})});const d=await r.json();if(!r.ok)throw new Error("GitHub 上傳失敗："+(d.message||r.status));
 const manifest=await getManifest(env);manifest.files.unshift({id:crypto.randomUUID(),name,description:String(form.get("description")||"").trim(),date:String(form.get("date")||"").trim(),category:String(form.get("category")||"其他").trim(),file:path,published:true,uploadedAt:new Date().toISOString()});await saveManifest(env,manifest,`Add report: ${name}`);return reply({ok:true,path},200,cors)}
function auth(password,env){return !!env.ADMIN_PASSWORD && password===env.ADMIN_PASSWORD}
async function manage(request,env,cors){const body=await request.json();if(!auth(String(body.password||""),env))return reply({error:"管理密碼錯誤"},401,cors);const action=String(body.action||"");const manifest=await getManifest(env);if(action==="list")return reply({files:manifest.files},200,cors);const id=String(body.id||"");const idx=manifest.files.findIndex(x=>x.id===id || x.file===id);if(idx<0)return reply({error:"找不到這份報告，請重新整理清單"},404,cors);const item=manifest.files[idx];
 if(action==="unpublish"||action==="publish"){item.published=action==="publish";await saveManifest(env,manifest,`${action} report: ${item.name}`);return reply({ok:true,published:item.published},200,cors)}
 if(action==="update"){for(const key of ["name","description","date","category"]){if(typeof body[key]==="string")item[key]=body[key].trim()}if(!item.name)return reply({error:"報告名稱不可空白"},400,cors);await saveManifest(env,manifest,`Edit report: ${item.name}`);return reply({ok:true},200,cors)}
 if(action==="delete"){const path=String(item.file||"");if(!path.startsWith("reports/")||path.includes(".."))return reply({error:"檔案路徑不安全，拒絕刪除"},400,cors);const fr=await fetch(repoUrl(env,path),{headers:ghHeaders(env)});if(fr.ok){const fd=await fr.json();const dr=await fetch(repoUrl(env,path),{method:"DELETE",headers:ghHeaders(env),body:JSON.stringify({message:`Delete report: ${item.name}`,sha:fd.sha})});if(!dr.ok){const dd=await dr.json();throw new Error("刪除 GitHub 檔案失敗："+(dd.message||dr.status))}}else if(fr.status!==404)throw new Error("無法確認 GitHub 檔案狀態："+fr.status);manifest.files.splice(idx,1);await saveManifest(env,manifest,`Remove report from listing: ${item.name}`);return reply({ok:true},200,cors)}
 return reply({error:"不支援的管理操作"},400,cors)}
