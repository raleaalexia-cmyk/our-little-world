(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const config = window.APP_CONFIG || {};
  const configured = !!(config.supabaseUrl && config.supabaseAnonKey && config.alexiaEmail && config.dyanEmail &&
    !config.supabaseUrl.includes("YOUR_") && !config.supabaseAnonKey.includes("YOUR_") &&
    !config.alexiaEmail.includes("_AUTH_EMAIL") && !config.dyanEmail.includes("_AUTH_EMAIL"));
  const supabase = configured && window.supabase ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
  const categoryNames = {date:"Date idea",travel:"Place to go",food:"Food & drink",adventure:"Adventure",little:"Little thing"};
  const defaultFolders = ["Us","Trips","Date nights","Everyday"];
  const prompts = [
    "Make a playlist for a drive with nowhere in particular to go.",
    "Pick a new bakery and rate each other's pastry choices.",
    "Take a photo together in the same spot every season.",
    "Plan a surprise date for each other with a tiny budget.",
    "Watch the sunset without looking at your phones.",
    "Cook a meal neither of you has tried making before.",
    "Write down three things you want to do together this year.",
    "Go for a walk and take turns choosing every next turn."
  ];
  let selectedProfile = "her", user = null, profileRole = null;
  let items = [], filter = "all", categoryFilter = "all", query = "";
  let photoFolder = "Us", photoFolders = [...defaultFolders], photos = [], realtimeChannel = null;
  // Remove credentials saved by the old browser-only preview.
  try { localStorage.removeItem("olw-profiles"); localStorage.removeItem("olw-current-profile"); } catch (_) {}
  const toast = (message) => {
    const el = $("#toast"); if (!el) return;
    el.textContent = message; el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2500);
  };
  const safe = (v = "") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const prettyDate = (value) => {
    if (!value) return "";
    const d = new Date(value + "T12:00:00");
    return d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:d.getFullYear()!==new Date().getFullYear()?"numeric":undefined});
  };
  const isConfigured = () => !!(supabase && configured);
  function setAuthMessage(text, warning = false) {
    $("#auth-message").textContent = text || "";
    $("#auth-message").classList.toggle("warning-message", warning);
  }
  function updateRoleTheme() {
    document.body.classList.toggle("theme-him", selectedProfile === "him");
    document.body.classList.toggle("theme-her", selectedProfile !== "him");
    $$(".profile-pick").forEach(b => b.classList.toggle("active", b.dataset.profile === selectedProfile));
    const dyan = selectedProfile === "him";
    const name = dyan ? "Dyan" : "Alexia";
    $("#selected-login-name").textContent = name;
    $("#selected-login-hint").textContent = dyan ? "His space · blue" : "Her space · pink";
    $("#auth-submit").innerHTML = 'Log in as ' + name + ' <span>↗</span>';
  }
  function showAuth() {
    $("#auth-screen").classList.remove("hidden");
    $("#app-screen").classList.add("hidden");
    $("#configuration-warning").classList.toggle("hidden", isConfigured());
    $("#auth-submit").disabled = false;
    if (!isConfigured()) setAuthMessage("Secure login is not connected. Add the Supabase URL, public key, and both account emails in config.js.", true);
    else setAuthMessage("");
    updateRoleTheme();
  }
  async function checkMembership() {
    const {data,error} = await supabase.rpc("get_my_couple_profile");
    if (error) throw error;
    return data === "her" || data === "him" ? data : null;
  }
  async function loginUser(password) {
    const email = selectedProfile === "him" ? config.dyanEmail.trim() : config.alexiaEmail.trim();
    if (!email || !password) throw new Error("Enter the password for the selected profile.");
    const {data,error} = await supabase.auth.signInWithPassword({email,password});
    if (error) throw new Error("That password didn't work for this profile. Check the selected profile and try again.");
    user = data.user;
    let role = null;
    try {
      role = await checkMembership();
    } catch (membershipError) {
      await supabase.auth.signOut();
      user = null; profileRole = null;
      throw new Error("The database setup is incomplete. Ask the site owner to run supabase-schema.sql and connect the two account emails.");
    }
    if (role !== selectedProfile) {
      await supabase.auth.signOut();
      user = null; profileRole = null;
      throw new Error("This login is not assigned to that profile. Ask the site owner to check the two private account assignments.");
    }
    profileRole = role;
    updateRoleTheme();
    await showApp();
  }
  async function signOut() {
    if (realtimeChannel && supabase) { try { await supabase.removeChannel(realtimeChannel); } catch (_) {} realtimeChannel = null; }
    if (supabase) await supabase.auth.signOut();
    user = null; profileRole = null; items = []; photos = [];
    $("#auth-password").value = "";
    selectedProfile = "her";
    updateRoleTheme();
    showAuth();
  }
  async function loadItems() {
    const {data,error} = await supabase.from("bucket_items").select("*").order("completed",{ascending:true}).order("created_at",{ascending:true});
    if (error) throw error;
    items = data || [];
  }
  async function saveItem(item) {
    const payload = {
      title:item.title, description:item.description||"", category:item.category||"little",
      priority:item.priority||"someday", dream_date:item.dream_date||null, completed:!!item.completed,
      completed_at:item.completed_at||null
    };
    if (item.id && !String(item.id).startsWith("demo-")) {
      const {data,error} = await supabase.from("bucket_items").update(payload).eq("id",item.id).select().single();
      if (error) throw error;
      return data;
    }
    payload.user_id = user.id;
    const {data,error} = await supabase.from("bucket_items").insert(payload).select().single();
    if (error) throw error;
    return data;
  }
  async function deleteItem(item) {
    const {error} = await supabase.from("bucket_items").delete().eq("id",item.id);
    if (error) throw error;
  }
  async function connectRealtime() {
    if (!supabase || !profileRole) return;
    if (realtimeChannel) {
      try { await supabase.removeChannel(realtimeChannel); } catch (_) {}
      realtimeChannel = null;
    }
    realtimeChannel = supabase.channel("our-little-world-shared")
      .on("postgres_changes", {event:"*",schema:"public",table:"bucket_items"}, async () => {
        if (!user || !profileRole) return;
        try { await loadItems(); renderItems(); } catch (e) { console.error("Bucket-list refresh failed",e); }
      })
      .on("postgres_changes", {event:"*",schema:"public",table:"couple_photos"}, async () => {
        if (!user || !profileRole) return;
        try { await loadCloudPhotos(); } catch (e) { console.error("Photo refresh failed",e); }
      })
      .on("postgres_changes", {event:"*",schema:"public",table:"couple_photo_folders"}, async () => {
        if (!user || !profileRole) return;
        try { await loadCloudFolders(); renderPhotos(); } catch (e) { console.error("Folder refresh failed",e); }
      })
      .subscribe(status => {
        const badge = $("#sync-status");
        if (!badge) return;
        if (status === "SUBSCRIBED") badge.textContent = "● Shared and live";
        else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") badge.textContent = "● Sync reconnecting";
      });
  }
  async function showApp() {
    if (!user || !profileRole || profileRole !== selectedProfile) { showAuth(); return; }
    $("#auth-password").value = "";
    $("#auth-screen").classList.add("hidden");
    $("#app-screen").classList.remove("hidden");
    updateRoleTheme();
    $("#sync-status").textContent = "● Shared and synced";
    $("#account-email").textContent = (selectedProfile === "him" ? "Dyan · " : "Alexia · ") + (user.email || "");
    $("#user-greeting").textContent = selectedProfile === "him" ? "Dyan, welcome to your little world" : "Alexia, welcome to your little world";
    $("#today-label").textContent = new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
    try {
      await loadItems();
      renderItems();
      await loadCloudFolders();
      await loadCloudPhotos();
      await connectRealtime();
    } catch (e) {
      console.error(e); toast("Couldn't load shared content. Check the Supabase setup and policies.");
    }
  }
  function renderItems() {
    const sorted = [...items].sort((a,b) => Number(!!a.completed)-Number(!!b.completed) || new Date(a.created_at||0)-new Date(b.created_at||0));
    const activeCount = items.filter(x=>!x.completed).length, doneCount = items.length-activeCount;
    $("#remaining-count").textContent = activeCount;
    $("#completed-count").textContent = doneCount;
    const pct = items.length ? Math.round(doneCount/items.length*100) : 0;
    $("#progress-percent").textContent = pct + "%";
    $("#progress-bar").style.width = pct + "%";
    const visible = sorted.filter(x =>
      (filter==="all" || (filter==="active"&&!x.completed) || (filter==="completed"&&x.completed)) &&
      (categoryFilter==="all" || x.category===categoryFilter) &&
      (String(x.title)+" "+String(x.description||"")).toLowerCase().includes(query)
    );
    const root = $("#bucket-list"); root.innerHTML = "";
    if (!visible.length) {
      $("#empty-state").classList.remove("hidden");
      $("#completed-note").classList.add("hidden");
      return;
    }
    $("#empty-state").classList.add("hidden");
    $("#completed-note").classList.toggle("hidden",filter==="completed");
    let dividerAdded = false;
    visible.forEach(item => {
      if (item.completed && !dividerAdded && filter==="all") {
        const divider = document.createElement("div");
        divider.className = "completed-divider";
        divider.textContent = "LITTLE MEMORIES MADE";
        root.appendChild(divider); dividerAdded = true;
      }
      const el = document.createElement("article");
      el.className = "bucket-item" + (item.completed ? " is-complete" : "");
      const priority = item.priority==="must" ? '<span class="tag must">♡ Must do</span>' :
        item.priority==="soon" ? '<span class="tag soon">Soon-ish</span>' : '<span class="tag">Someday</span>';
      el.innerHTML = '<button class="check-button" data-action="toggle" data-id="'+safe(item.id)+'" aria-label="'+(item.completed?"Mark as not done":"Mark as done")+'">'+(item.completed?"✓":"")+'</button>'+
      '<div class="item-main"><div class="item-title">'+safe(item.title)+'</div>'+
      (item.description?'<div class="item-description">'+safe(item.description)+'</div>':"")+
      '<div class="item-meta"><span class="tag">'+safe(categoryNames[item.category]||"Little thing")+'</span>'+priority+
      (item.dream_date?'<span class="item-date">◷ '+safe(prettyDate(item.dream_date))+'</span>':"")+
      (item.completed?'<span class="tag done">Made it happen ♡</span>':"")+'</div></div>'+
      '<div class="item-actions"><button class="icon-button" data-action="edit" data-id="'+safe(item.id)+'" aria-label="Edit item">✎</button><button class="icon-button" data-action="delete" data-id="'+safe(item.id)+'" aria-label="Delete item">×</button></div>';
      root.appendChild(el);
    });
  }
  async function handleListAction(e) {
    const b = e.target.closest("button[data-action]");
    if (!b) return;
    const item = items.find(x=>String(x.id)===b.dataset.id);
    if (!item) return;
    try {
      if (b.dataset.action==="toggle") {
        const saved = await saveItem({...item,completed:!item.completed,completed_at:!item.completed?new Date().toISOString():null});
        items = items.filter(x=>x.id!==item.id); items.push(saved); renderItems();
        toast(saved.completed ? "One more memory made ♡" : "Back on the list");
      } else if (b.dataset.action==="delete") {
        if (!confirm('Remove "'+item.title+'" from your list?')) return;
        await deleteItem(item); items = items.filter(x=>x.id!==item.id); renderItems(); toast("Removed from your list");
      } else if (b.dataset.action==="edit") {
        $("#item-title").value=item.title; $("#item-description").value=item.description||"";
        $("#item-category").value=item.category||"little"; $("#item-priority").value=item.priority||"someday";
        $("#item-date").value=item.dream_date||""; $("#add-form").dataset.editId=item.id;
        $("#add-dialog h2").textContent="Edit your dream"; $("#add-dialog").showModal();
      }
    } catch(e2) { console.error(e2); toast("That didn't save. Check your connection and try again."); }
  }

  // Cloud photo album: private Storage bucket + metadata tables, shared by the two verified members.
  async function loadCloudFolders() {
    const {data,error} = await supabase.from("couple_photo_folders").select("name").order("name");
    if (error) throw error;
    photoFolders = [...defaultFolders,...(data||[]).map(x=>x.name).filter(n=>!defaultFolders.includes(n))];
    renderPhotoFolderOptions();
  }
  function renderPhotoFolderOptions() {
    const select=$("#photo-folder"), current=photoFolder || select.value || "Us";
    select.innerHTML=photoFolders.map(f=>'<option value="'+safe(f)+'">'+safe(f)+'</option>').join("");
    photoFolder=photoFolders.includes(current)?current:(photoFolders[0]||"Us");
    select.value=photoFolder;
  }
  async function loadCloudPhotos() {
    const {data,error} = await supabase.from("couple_photos").select("*").order("created_at",{ascending:false});
    if (error) throw error;
    const rows=data||[];
    const signed=await Promise.all(rows.map(async p=>{
      const {data:link,error:linkError}=await supabase.storage.from("couple-photos").createSignedUrl(p.storage_path,3600);
      return {...p,signedUrl:linkError?null:link?.signedUrl};
    }));
    photos=signed;
    renderPhotos();
  }
  function renderPhotos() {
    const grid=$("#photo-grid"); if (!grid) return;
    renderPhotoFolderOptions(); grid.innerHTML="";
    const visible=photos.filter(p=>p.folder===photoFolder);
    $("#gallery-status").textContent=visible.length ? visible.length+" photo(s) in "+photoFolder+" · synced across your accounts" : "Photos in this folder will be shared with both accounts.";
    if (!visible.length) {
      grid.innerHTML='<div class="photo-empty">No photos here yet.<br>Add a memory to this folder.</div>'; return;
    }
    visible.forEach(p=>{
      const tile=document.createElement("article"); tile.className="photo-tile";
      tile.innerHTML=(p.signedUrl?'<a class="photo-open" href="'+safe(p.signedUrl)+'" target="_blank" rel="noopener"><img src="'+safe(p.signedUrl)+'" alt="'+safe(p.name)+'" loading="lazy"></a>':'<div class="photo-load-error">Preview unavailable</div>')+
        '<div class="photo-caption" title="'+safe(p.name)+'">'+safe(p.name)+'</div>'+
        '<div class="photo-actions"><button data-photo-action="download" data-photo-id="'+safe(p.id)+'">↓ Download</button><button data-photo-action="delete" data-photo-id="'+safe(p.id)+'" aria-label="Delete photo">×</button></div>';
      grid.appendChild(tile);
    });
  }
  async function createPhotoFolder(name) {
    const trimmed=name.trim();
    if (!trimmed || trimmed.length>32) return;
    if (photoFolders.some(f=>f.toLowerCase()===trimmed.toLowerCase())) throw new Error("That folder already exists.");
    const {error}=await supabase.from("couple_photo_folders").insert({name:trimmed,created_by:user.id});
    if (error) throw error;
    await loadCloudFolders(); photoFolder=trimmed; renderPhotos();
  }
  async function uploadPhoto(file) {
    if (!file.type.startsWith("image/")) throw new Error(file.name+" is not an image.");
    if (file.size>15*1024*1024) throw new Error(file.name+" is larger than 15 MB.");
    const cleanName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(-100) || "photo";
    const path=user.id+"/"+(crypto.randomUUID?crypto.randomUUID():String(Date.now()))+"-"+cleanName;
    const {error:uploadError}=await supabase.storage.from("couple-photos").upload(path,file,{cacheControl:"3600",upsert:false,contentType:file.type});
    if (uploadError) throw uploadError;
    const {error:rowError}=await supabase.from("couple_photos").insert({storage_path:path,name:file.name,folder:photoFolder,uploaded_by:user.id});
    if (rowError) {
      await supabase.storage.from("couple-photos").remove([path]);
      throw rowError;
    }
  }
  async function downloadPhoto(photo) {
    const {data,error}=await supabase.storage.from("couple-photos").download(photo.storage_path);
    if (error) throw error;
    const url=URL.createObjectURL(data),a=document.createElement("a");
    a.href=url; a.download=photo.name||"our-little-world-photo"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  $$(".profile-pick").forEach(btn => btn.addEventListener("click", () => {
    selectedProfile = btn.dataset.profile;
    updateRoleTheme();
    setAuthMessage("");
  }));
  $("#auth-form").addEventListener("submit", async e => {
    e.preventDefault();
    if (!isConfigured()) {
      setAuthMessage("Secure login is not connected yet. Follow the setup guide to connect the two existing accounts.", true);
      return;
    }
    const password = $("#auth-password").value;
    if (!password) { setAuthMessage("Enter your password."); return; }
    $("#auth-submit").disabled = true;
    setAuthMessage("");
    try {
      await loginUser(password);
    } catch (err) {
      console.error(err);
      setAuthMessage(err.message || "Unable to log in. Check your password and connection.");
      $("#auth-password").value = "";
      $("#auth-password").focus();
    } finally {
      $("#auth-submit").disabled = false;
    }
  });
  function openAdd() {
    $("#add-form").reset(); delete $("#add-form").dataset.editId;
    $("#add-dialog h2").textContent="Add to our list"; $("#add-error").textContent="";
    $("#add-dialog").showModal();
  }
  $("#open-add").addEventListener("click",openAdd);
  $("#empty-add").addEventListener("click",openAdd);
  $("#close-add").addEventListener("click",()=>$("#add-dialog").close());
  $("#add-form").addEventListener("submit",async e=>{
    e.preventDefault();
    const title=$("#item-title").value.trim(); if(!title)return;
    const editId=$("#add-form").dataset.editId, old=editId?items.find(x=>String(x.id)===editId):null;
    const payload={...(old||{}),title,description:$("#item-description").value.trim(),category:$("#item-category").value,priority:$("#item-priority").value,dream_date:$("#item-date").value||null,completed:old?.completed||false,completed_at:old?.completed_at||null,created_at:old?.created_at||new Date().toISOString()};
    try {
      const saved=await saveItem(payload);
      if(old)items=items.map(x=>x.id===old.id?saved:x); else items.push(saved);
      renderItems(); $("#add-dialog").close(); toast(old?"Dream updated":"Added to your world ♡");
    } catch(err) {console.error(err);$("#add-error").textContent="Couldn't save. Check your database setup and try again.";}
  });
  $("#bucket-list").addEventListener("click",handleListAction);
  $$(".filter").forEach(btn=>btn.addEventListener("click",()=>{filter=btn.dataset.filter;$$(".filter").forEach(x=>x.classList.toggle("active",x===btn));renderItems();}));
  $$(".chip").forEach(btn=>btn.addEventListener("click",()=>{categoryFilter=btn.dataset.category;$$(".chip").forEach(x=>x.classList.toggle("active",x===btn));renderItems();}));
  $("#search-input").addEventListener("input",e=>{query=e.target.value.toLowerCase().trim();renderItems();});
  $("#photo-folder").addEventListener("change",e=>{photoFolder=e.target.value;renderPhotos();});
  $("#new-folder").addEventListener("click",()=>{$("#folder-name").value="";$("#folder-dialog").showModal();});
  $("#close-folder").addEventListener("click",()=>$("#folder-dialog").close());
  $("#folder-form").addEventListener("submit",async e=>{
    e.preventDefault();
    try {await createPhotoFolder($("#folder-name").value);$("#folder-dialog").close();toast("Folder created");}
    catch(err){$("#folder-name").setCustomValidity(err.message||"Unable to create this folder.");$("#folder-name").reportValidity();$("#folder-name").setCustomValidity("");}
  });
  $("#photo-upload").addEventListener("change",async e=>{
    const files=[...(e.target.files||[])];if(!files.length)return;
    $("#gallery-status").textContent="Uploading photos to your shared album…";
    let count=0;
    for(const file of files) {
      try {await uploadPhoto(file);count++;}
      catch(err){console.error(err);toast(err.message||"A photo could not be uploaded.");}
    }
    await loadCloudPhotos();e.target.value="";
    if(count)toast(count+" photo(s) added to "+photoFolder);
  });
  $("#photo-grid").addEventListener("click",async e=>{
    const btn=e.target.closest("button[data-photo-action]");if(!btn)return;
    const photo=photos.find(p=>p.id===btn.dataset.photoId);if(!photo)return;
    try {
      if(btn.dataset.photoAction==="download")await downloadPhoto(photo);
      else if(confirm("Delete this photo from the shared album for both accounts?")) {
        const {error}=await supabase.from("couple_photos").delete().eq("id",photo.id);
        if(error)throw error;
        const {error:storageError}=await supabase.storage.from("couple-photos").remove([photo.storage_path]);
        if(storageError)console.warn(storageError);
        photos=photos.filter(p=>p.id!==photo.id);renderPhotos();toast("Photo deleted");
      }
    } catch(err){console.error(err);toast(err.message||"Photo action failed.");}
  });
  $("#account-button").addEventListener("click",()=>$("#account-dialog").showModal());
  $("#close-account").addEventListener("click",()=>$("#account-dialog").close());
  $("#signout-button").addEventListener("click",signOut);
  $("#account-signout").addEventListener("click",async()=>{$("#account-dialog").close();await signOut();});
  $("#new-prompt").addEventListener("click",()=>{
    let next=prompts[Math.floor(Math.random()*prompts.length)];
    if(next===$("#prompt-text").textContent)next=prompts[(prompts.indexOf(next)+1)%prompts.length];
    $("#prompt-text").textContent=next;
  });
  async function initialize() {
    updateRoleTheme();
    if (!isConfigured()) { showAuth(); return; }
    try {
      const {data,error} = await supabase.auth.getSession();
      if (error) throw error;
      const sessionUser = data.session?.user;
      if (sessionUser) {
        user = sessionUser;
        let role = null;
        try {
          role = await checkMembership();
        } catch (membershipError) {
          await supabase.auth.signOut();
          user = null;
          throw membershipError;
        }
        if (role === "her" || role === "him") {
          profileRole = role; selectedProfile = role;
          updateRoleTheme();
          await showApp();
        } else {
          await supabase.auth.signOut();
          user = null; profileRole = null;
          showAuth();
          setAuthMessage("This account is not one of the two approved logins. Use the Alexia or Dyan account set up by the site owner.", true);
        }
      } else showAuth();
    } catch (err) {
      console.error(err);
      showAuth();
      setAuthMessage("Unable to verify your login. Check that Supabase and the two account assignments have been configured.", true);
    }
    supabase.auth.onAuthStateChange(async event => {
      if (event === "SIGNED_OUT") {
        if (realtimeChannel) { try { await supabase.removeChannel(realtimeChannel); } catch (_) {} realtimeChannel = null; }
        user = null; profileRole = null; items = []; photos = [];
        showAuth();
      }
    });
  }
  initialize();
})();