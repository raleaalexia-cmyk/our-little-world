(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const config = window.APP_CONFIG || {};
  const configured = config.supabaseUrl && config.supabaseAnonKey && !config.supabaseUrl.includes("YOUR_") && !config.supabaseAnonKey.includes("YOUR_");
  const supabase = configured && window.supabase ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
  const categoryNames = {date:"Date idea",travel:"Place to go",food:"Food & drink",adventure:"Adventure",little:"Little thing"};
  const prompts = ["Make a playlist for a drive with nowhere in particular to go.","Pick a new bakery and rate each other's pastry choices.","Take a photo together in the same spot every season.","Plan a surprise date for each other with a tiny budget.","Watch the sunset without looking at your phones.","Cook a meal neither of you has tried making before.","Write down three things you want to do together this year.","Go for a walk and take turns choosing every next turn."];
  let authMode="login",selectedProfile="you",user=null,profileName="",items=[],filter="all",categoryFilter="all",query="";
  let demoItems=[
    {id:"demo-1",title:"Watch the sunrise together",description:"Bring coffee and a blanket. No rushing.",category:"little",priority:"soon",dream_date:null,completed:false,created_at:"2025-01-01"},
    {id:"demo-2",title:"Have a picnic somewhere pretty",description:"Homemade snacks, a shared playlist, and no plans after.",category:"date",priority:"must",dream_date:null,completed:false,created_at:"2025-01-02"},
    {id:"demo-3",title:"Take a weekend trip with no itinerary",description:"Choose a place, book the stay, and see what happens.",category:"travel",priority:"someday",dream_date:null,completed:false,created_at:"2025-01-03"},
    {id:"demo-4",title:"Make homemade pizza from scratch",description:"Let the kitchen get a little messy.",category:"food",priority:"someday",dream_date:null,completed:true,created_at:"2025-01-04"}
  ];
  const demoStore={async getItems(){try{return JSON.parse(localStorage.getItem("olw-items"))||demoItems;}catch{return demoItems;}},async saveItems(data){localStorage.setItem("olw-items",JSON.stringify(data));}};
  const toast=(message)=>{const el=$("#toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2300);};
  const safe=(v="")=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const prettyDate=(value)=>{if(!value)return "";const d=new Date(value+"T12:00:00");return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:d.getFullYear()!==new Date().getFullYear()?"numeric":undefined});};
  const dbReady=()=>!!supabase;
  async function loadItems(){if(!dbReady()){items=await demoStore.getItems();return;}const {data,error}=await supabase.from("bucket_items").select("*").order("completed",{ascending:true}).order("created_at",{ascending:true});if(error)throw error;items=data||[];}
  async function saveItem(item){
    if(!dbReady()){const i=items.findIndex(x=>x.id===item.id);if(i<0)items.push(item);else items[i]=item;await demoStore.saveItems(items);return item;}
    const payload={...item,user_id:user.id};delete payload.id;
    if(item.id&&!String(item.id).startsWith("demo-")){const {data,error}=await supabase.from("bucket_items").update(payload).eq("id",item.id).select().single();if(error)throw error;return data;}
    const {data,error}=await supabase.from("bucket_items").insert(payload).select().single();if(error)throw error;return data;
  }
  async function deleteItem(item){if(!dbReady()){items=items.filter(x=>x.id!==item.id);await demoStore.saveItems(items);return;}const {error}=await supabase.from("bucket_items").delete().eq("id",item.id);if(error)throw error;}
  function showAuth(){$("#auth-screen").classList.remove("hidden");$("#app-screen").classList.add("hidden");}
  async function showApp(){
    $("#auth-screen").classList.add("hidden");$("#app-screen").classList.remove("hidden");$("#sync-status").textContent=dbReady()?"● Private account":"● Preview mode";
    $("#account-email").textContent=(profileName?profileName+" · ":"")+(user?.email||"Preview mode — data stays in this browser");
    document.body.classList.toggle("theme-him",selectedProfile==="him");document.body.classList.toggle("theme-her",selectedProfile!=="him");
    $("#user-greeting").textContent=profileName?"Hi, "+profileName:(selectedProfile==="him"?"His little world":"Your little world");
    $("#today-label").textContent=new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
    try{await loadItems();render();await loadPhotos();}catch(e){toast("Could not load your list. Check your setup.");console.error(e);}
  }
  function render(){
    const sorted=[...items].sort((a,b)=>Number(!!a.completed)-Number(!!b.completed)||new Date(a.created_at||0)-new Date(b.created_at||0));
    const activeCount=items.filter(x=>!x.completed).length,doneCount=items.length-activeCount;
    $("#remaining-count").textContent=activeCount;$("#completed-count").textContent=doneCount;
    const pct=items.length?Math.round(doneCount/items.length*100):0;$("#progress-percent").textContent=pct+"%";$("#progress-bar").style.width=pct+"%";
    const visible=sorted.filter(x=>(filter==="all"||(filter==="active"&&!x.completed)||(filter==="completed"&&x.completed))&&(categoryFilter==="all"||x.category===categoryFilter)&&(`${x.title} ${x.description||""}`.toLowerCase().includes(query)));
    const root=$("#bucket-list");root.innerHTML="";
    if(!visible.length){$("#empty-state").classList.remove("hidden");$("#completed-note").classList.add("hidden");return;}
    $("#empty-state").classList.add("hidden");$("#completed-note").classList.toggle("hidden",filter==="completed");
    let dividerAdded=false;
    visible.forEach(item=>{
      if(item.completed&&!dividerAdded&&filter==="all"){const divider=document.createElement("div");divider.className="completed-divider";divider.textContent="LITTLE MEMORIES MADE";root.appendChild(divider);dividerAdded=true;}
      const el=document.createElement("article");el.className="bucket-item"+(item.completed?" is-complete":"");
      const priority=item.priority==="must"?'<span class="tag must">♡ Must do</span>':item.priority==="soon"?'<span class="tag soon">Soon-ish</span>':'<span class="tag">Someday</span>';
      el.innerHTML=`<button class="check-button" data-action="toggle" data-id="${safe(item.id)}" aria-label="${item.completed?"Mark as not done":"Mark as done"}">${item.completed?"✓":""}</button>
      <div class="item-main"><div class="item-title">${safe(item.title)}</div>${item.description?`<div class="item-description">${safe(item.description)}</div>`:""}
      <div class="item-meta"><span class="tag">${safe(categoryNames[item.category]||"Little thing")}</span>${priority}${item.dream_date?`<span class="item-date">◷ ${safe(prettyDate(item.dream_date))}</span>`:""}${item.completed?'<span class="tag done">Made it happen ♡</span>':""}</div></div>
      <div class="item-actions"><button class="icon-button" data-action="edit" data-id="${safe(item.id)}" aria-label="Edit item">✎</button><button class="icon-button" data-action="delete" data-id="${safe(item.id)}" aria-label="Delete item">×</button></div>`;
      root.appendChild(el);
    });
  }
  async function handleListAction(e){
    const b=e.target.closest("button[data-action]");if(!b)return;const item=items.find(x=>String(x.id)===b.dataset.id);if(!item)return;
    try{
      if(b.dataset.action==="toggle"){const updated={...item,completed:!item.completed,completed_at:!item.completed?new Date().toISOString():null};const saved=await saveItem(updated);items=items.filter(x=>x.id!==item.id);items.push(saved);render();toast(saved.completed?"One more memory made ♡":"Back on the list");}
      else if(b.dataset.action==="delete"){if(!confirm(`Remove "${item.title}" from your list?`))return;await deleteItem(item);items=items.filter(x=>x.id!==item.id);render();toast("Removed from your list");}
      else if(b.dataset.action==="edit"){$("#item-title").value=item.title;$("#item-description").value=item.description||"";$("#item-category").value=item.category||"little";$("#item-priority").value=item.priority||"someday";$("#item-date").value=item.dream_date||"";$("#add-form").dataset.editId=item.id;$("#add-dialog h2").textContent="Edit your dream";$("#add-dialog").showModal();}
    }catch(err){console.error(err);toast("That didn't save. Please try again.");}
  }
  let photoFolder="Us",photoFolders=["Us","Trips","Date nights","Everyday"],photos=[];
  const openPhotoDB=()=>new Promise((resolve,reject)=>{const req=indexedDB.open("our-little-world-photos",1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains("photos"))db.createObjectStore("photos",{keyPath:"id"});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  async function photoDB(action,value){const db=await openPhotoDB();return new Promise((resolve,reject)=>{const tx=db.transaction("photos",action==="getAll"?"readonly":"readwrite"),store=tx.objectStore("photos");const req=action==="getAll"?store.getAll():action==="put"?store.put(value):store.delete(value);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);tx.onerror=()=>reject(tx.error);});}
  async function loadPhotos(){try{photos=await photoDB("getAll");}catch(e){photos=[];console.warn(e);}renderPhotos();}
  function renderPhotos(){const select=$("#photo-folder"),current=select.value||photoFolder;select.innerHTML=photoFolders.map(f=>'<option value="'+safe(f)+'">'+safe(f)+'</option>').join("");if(!photoFolders.includes(current))photoFolder=photoFolders[0]||"Us";else photoFolder=current;select.value=photoFolder;const grid=$("#photo-grid");grid.innerHTML="";const visible=photos.filter(p=>p.folder===photoFolder).sort((a,b)=>b.created-a.created);$("#gallery-status").textContent=visible.length?visible.length+" photo(s) in "+photoFolder:"Photos stay in this browser in preview mode.";if(!visible.length){grid.innerHTML='<div class="photo-empty">No photos here yet.<br>Add a memory to this folder.</div>';return;}visible.forEach(p=>{const tile=document.createElement("article");tile.className="photo-tile";tile.innerHTML='<img src="'+p.data+'" alt="'+safe(p.name)+'" loading="lazy"><div class="photo-caption">'+safe(p.name)+'</div><div class="photo-actions"><button data-photo-action="download" data-photo-id="'+safe(p.id)+'">↓ Download</button><button data-photo-action="delete" data-photo-id="'+safe(p.id)+'">×</button></div>';grid.appendChild(tile);});}
  $("#photo-folder").addEventListener("change",e=>{photoFolder=e.target.value;renderPhotos();});
  $("#new-folder").addEventListener("click",()=>{$("#folder-name").value="";$("#folder-dialog").showModal();});
  $("#close-folder").addEventListener("click",()=>$("#folder-dialog").close());
  $("#folder-form").addEventListener("submit",e=>{e.preventDefault();const name=$("#folder-name").value.trim();if(!name)return;if(photoFolders.some(f=>f.toLowerCase()===name.toLowerCase())){toast("That folder already exists.");return;}photoFolders.push(name);photoFolder=name;$("#folder-dialog").close();renderPhotos();toast("Folder created");});
  $("#photo-upload").addEventListener("change",async e=>{const files=[...e.target.files||[]];if(!files.length)return;try{for(const file of files){if(!file.type.startsWith("image/"))continue;if(file.size>12*1024*1024){toast(file.name+" is over 12 MB; skipped.");continue;}const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file);});const photo={id:crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random(),name:file.name,folder:photoFolder,data,created:Date.now()};await photoDB("put",photo);photos.push(photo);}renderPhotos();toast("Photos added to "+photoFolder);}catch(err){console.error(err);toast("Photo storage failed. Try fewer or smaller photos.");}finally{e.target.value="";}});
  $("#photo-grid").addEventListener("click",async e=>{const btn=e.target.closest("button[data-photo-action]");if(!btn)return;const photo=photos.find(p=>p.id===btn.dataset.photoId);if(!photo)return;if(btn.dataset.photoAction==="download"){const a=document.createElement("a");a.href=photo.data;a.download=photo.name||"our-little-world-photo";document.body.appendChild(a);a.click();a.remove();}else if(confirm("Delete this photo from this browser?")){await photoDB("delete",photo.id);photos=photos.filter(p=>p.id!==photo.id);renderPhotos();toast("Photo deleted");}});
  async function signOut(){if(dbReady())await supabase.auth.signOut();user=null;showAuth();}
  $$(".profile-pick").forEach(btn=>btn.addEventListener("click",()=>{selectedProfile=btn.dataset.profile;$$(".profile-pick").forEach(x=>x.classList.toggle("active",x===btn));$("#auth-message").textContent="";}));
  $$(".tab").forEach(btn=>btn.addEventListener("click",()=>{authMode=btn.dataset.authMode;$$(".tab").forEach(x=>x.classList.toggle("active",x===btn));$("#auth-submit").innerHTML=authMode==="login"?'Come on in <span>↗</span>':'Create my login <span>♡</span>';$("#auth-password").autocomplete=authMode==="login"?"current-password":"new-password";$("#auth-message").textContent="";$("#auth-name").required=true;}));
  $("#auth-form").addEventListener("submit",async e=>{
    e.preventDefault();const email=$("#auth-email").value.trim(),password=$("#auth-password").value,name=$("#auth-name").value.trim();
    if(password.length<8){$("#auth-message").textContent="Use a password with at least 8 characters.";return;}if(!name){$("#auth-message").textContent="Add your name first.";return;}
    profileName=name;$("#auth-submit").disabled=true;$("#auth-message").textContent="";
    try{
      if(!dbReady()){
        const profiles=JSON.parse(localStorage.getItem("olw-profiles")||"{}"),profileKey=selectedProfile;
        if(authMode==="signup"){if(profiles[profileKey]){$("#auth-message").textContent="This profile has already been set up in this browser. Choose Log in.";return;}profiles[profileKey]={name,email,password};localStorage.setItem("olw-profiles",JSON.stringify(profiles));localStorage.setItem("olw-current-profile",profileKey);}
        else{const existing=profiles[profileKey];if(existing&&(existing.email!==email||existing.password!==password)){$("#auth-message").textContent="Those details don't match this preview profile.";return;}if(!existing){profiles[profileKey]={name,email,password};localStorage.setItem("olw-profiles",JSON.stringify(profiles));}else{profileName=existing.name;$("#auth-name").value=existing.name;}localStorage.setItem("olw-current-profile",profileKey);}
        user={email};await showApp();return;
      }
      if(authMode==="signup"){const result=await supabase.auth.signUp({email,password,options:{data:{display_name:name,couple_profile:selectedProfile}}});if(result.error)throw result.error;if(!result.data.session){$("#auth-message").textContent="Check your email to confirm your account, then log in. Your name is saved with your account.";return;}user=result.data.user;}
      else{const result=await supabase.auth.signInWithPassword({email,password});if(result.error)throw result.error;user=result.data.user;profileName=user.user_metadata?.display_name||name;}
      await showApp();
    }catch(err){$("#auth-message").textContent=err.message||"Could not sign in.";}finally{$("#auth-submit").disabled=false;}
  });
  function openAdd(){$("#add-form").reset();delete $("#add-form").dataset.editId;$("#add-dialog h2").textContent="Add to our list";$("#add-error").textContent="";$("#add-dialog").showModal();}
  $("#open-add").addEventListener("click",openAdd);$("#empty-add").addEventListener("click",openAdd);$("#close-add").addEventListener("click",()=>$("#add-dialog").close());
  $("#add-form").addEventListener("submit",async e=>{
    e.preventDefault();const title=$("#item-title").value.trim();if(!title)return;const editId=$("#add-form").dataset.editId,old=editId?items.find(x=>String(x.id)===editId):null;
    const payload={...(old||{}),title,description:$("#item-description").value.trim(),category:$("#item-category").value,priority:$("#item-priority").value,dream_date:$("#item-date").value||null,completed:old?.completed||false,created_at:old?.created_at||new Date().toISOString()};
    try{const saved=await saveItem(payload);if(old)items=items.map(x=>x.id===old.id?saved:x);else items.push(saved);render();$("#add-dialog").close();toast(old?"Dream updated":"Added to your world ♡");}catch(err){console.error(err);$("#add-error").textContent="Couldn't save this item. Check your setup and try again.";}
  });
  $("#bucket-list").addEventListener("click",handleListAction);
  $$(".filter").forEach(btn=>btn.addEventListener("click",()=>{filter=btn.dataset.filter;$$(".filter").forEach(x=>x.classList.toggle("active",x===btn));render();}));
  $$(".chip").forEach(btn=>btn.addEventListener("click",()=>{categoryFilter=btn.dataset.category;$$(".chip").forEach(x=>x.classList.toggle("active",x===btn));render();}));
  $("#search-input").addEventListener("input",e=>{query=e.target.value.toLowerCase().trim();render();});
  $("#new-prompt").addEventListener("click",()=>{let next=prompts[Math.floor(Math.random()*prompts.length)];if(next===$("#prompt-text").textContent)next=prompts[(prompts.indexOf(next)+1)%prompts.length];$("#prompt-text").textContent=next;});
  $("#account-button").addEventListener("click",()=>$("#account-dialog").showModal());$("#close-account").addEventListener("click",()=>$("#account-dialog").close());$("#signout-button").addEventListener("click",signOut);$("#account-signout").addEventListener("click",async()=>{$("#account-dialog").close();await signOut();});
  if(dbReady()){supabase.auth.getSession().then(({data})=>{user=data.session?.user||null;if(user){profileName=user.user_metadata?.display_name||"";selectedProfile=user.user_metadata?.couple_profile||"you";$$(".profile-pick").forEach(x=>x.classList.toggle("active",x.dataset.profile===selectedProfile));showApp();}else showAuth();});supabase.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;if(user){profileName=user.user_metadata?.display_name||profileName;selectedProfile=user.user_metadata?.couple_profile||selectedProfile;$$(".profile-pick").forEach(x=>x.classList.toggle("active",x.dataset.profile===selectedProfile));showApp();}else showAuth();});}else showAuth();
})();