(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const config = window.APP_CONFIG || {};
  const AppwriteSDK = window.Appwrite || null;
  const configured = !!(
    AppwriteSDK && config.endpoint && config.projectId && config.databaseId &&
    config.tableId && config.bucketId && config.alexiaEmail && config.dyanEmail &&
    !String(config.endpoint).includes("YOUR_") &&
    !String(config.projectId).includes("YOUR_") &&
    !String(config.databaseId).includes("YOUR_") &&
    !String(config.tableId).includes("YOUR_") &&
    !String(config.bucketId).includes("YOUR_") &&
    !String(config.alexiaEmail).includes("_EMAIL") &&
    !String(config.dyanEmail).includes("_EMAIL")
  );
  let client = null, account = null, tablesDB = null, storage = null, realtime = null;
  if (configured) {
    client = new AppwriteSDK.Client().setEndpoint(config.endpoint).setProject(config.projectId);
    account = new AppwriteSDK.Account(client);
    tablesDB = new AppwriteSDK.TablesDB(client);
    storage = new AppwriteSDK.Storage(client);
    realtime = new AppwriteSDK.Realtime(client);
  }
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
  const isConfigured = () => !!(configured && account && tablesDB && storage);
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
    if (!isConfigured()) {
      setAuthMessage("The secure account service is not connected yet. Follow the short Appwrite setup guide below.", true);
    } else {
      setAuthMessage("");
    }
    updateRoleTheme();
  }
  function profileForEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    if (normalized && normalized === String(config.alexiaEmail || "").trim().toLowerCase()) return "her";
    if (normalized && normalized === String(config.dyanEmail || "").trim().toLowerCase()) return "him";
    return null;
  }
  async function loginUser(password) {
    if (!isConfigured()) throw new Error("Appwrite isn't connected yet. Complete the one-time project setup first.");
    const email = selectedProfile === "him" ? String(config.dyanEmail).trim() : String(config.alexiaEmail).trim();
    if (!email || !password) throw new Error("Enter the password for the selected profile.");
    try {
      await account.createEmailPasswordSession({email, password});
      user = await account.get();
    } catch (err) {
      throw new Error("That password didn't work for this profile. Check the selected name and try again.");
    }
    const role = profileForEmail(user.email);
    if (!role || role !== selectedProfile) {
      try { await account.deleteSession({sessionId:"current"}); } catch (_) {}
      user = null;
      profileRole = null;
      throw new Error("This account is not assigned to the selected profile.");
    }
    profileRole = role;
    updateRoleTheme();
    await showApp();
  }
  async function signOut() {
    if (typeof realtimeSubscription === "function") {
      try { realtimeSubscription(); } catch (_) {}
      realtimeSubscription = null;
    }
    if (account) {
      try { await account.deleteSession({sessionId:"current"}); } catch (_) {}
    }
    user = null; profileRole = null; items = []; photos = [];
    $("#auth-password").value = "";
    selectedProfile = "her";
    updateRoleTheme();
    showAuth();
  }
  async function loadItems() {
    const result = await tablesDB.listRows({
      databaseId: config.databaseId,
      tableId: config.tableId,
      queries: [
        AppwriteSDK.Query.equal("type", "bucket"),
        AppwriteSDK.Query.limit(500)
      ]
    });
    items = (result.rows || []).map(row => {
      let record = {};
      try { record = JSON.parse(row.data || "{}"); } catch (_) {}
      return {...record,id:row.$id};
    });
    items.sort((a,b) => Number(!!a.completed)-Number(!!b.completed) ||
      String(a.created_at||"").localeCompare(String(b.created_at||"")));
  }
  async function saveItem(item) {
    const payload = {
      title:String(item.title||"").slice(0,120),
      description:String(item.description||"").slice(0,400),
      category:item.category||"little",
      priority:item.priority||"someday",
      dream_date:item.dream_date||"",
      completed:!!item.completed,
      completed_at:item.completed_at||"",
      created_at:item.created_at||new Date().toISOString(),
      uploaded_by:user.$id
    };
    const rowData = {type:"bucket",data:JSON.stringify(payload)};
    let row;
    if (item.id && !String(item.id).startsWith("demo-")) {
      row = await tablesDB.updateRow({
        databaseId:config.databaseId,tableId:config.tableId,rowId:item.id,data:rowData
      });
    } else {
      row = await tablesDB.createRow({
        databaseId:config.databaseId,tableId:config.tableId,
        rowId:AppwriteSDK.ID.unique(),data:rowData
      });
    }
    return {...payload,id:row.$id};
  }
  async function deleteItem(item) {
    await tablesDB.deleteRow({
      databaseId:config.databaseId,tableId:config.tableId,rowId:item.id
    });
  }
  async function connectRealtime() {
    if (!realtime || !profileRole) return;
    if (typeof realtimeSubscription === "function") {
      try { realtimeSubscription(); } catch (_) {}
    }
    realtimeSubscription = realtime.subscribe(
      `tablesdb.${config.databaseId}.tables.${config.tableId}.rows`,
      async () => {
        if (!user || !profileRole) return;
        try {
          await loadItems(); renderItems();
          await loadCloudFolders();
          await loadCloudPhotos();
        } catch (e) { console.error("Shared content refresh failed",e); }
      }
    );
    $("#sync-status").textContent = "● Shared and live";
  }
  async function showApp() {
    if (!user || !profileRole || profileForEmail(user.email) !== profileRole) { showAuth(); return; }
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
      console.error(e); toast("Couldn't load shared content. Check Appwrite permissions and the setup values.");
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
    const result = await tablesDB.listRows({
      databaseId:config.databaseId,tableId:config.tableId,
      queries:[AppwriteSDK.Query.equal("type","folder"),AppwriteSDK.Query.limit(100)]
    });
    const custom=(result.rows||[]).map(row=>{
      try { return String(JSON.parse(row.data||"{}").name||"").trim(); } catch (_) { return ""; }
    }).filter(Boolean);
    photoFolders=[...defaultFolders,...custom.filter(n=>!defaultFolders.includes(n))];
    renderPhotoFolderOptions();
  }
  function renderPhotoFolderOptions() {
    const select=$("#photo-folder"), current=photoFolder || select.value || "Us";
    select.innerHTML=photoFolders.map(f=>'<option value="'+safe(f)+'">'+safe(f)+'</option>').join("");
    photoFolder=photoFolders.includes(current)?current:(photoFolders[0]||"Us");
    select.value=photoFolder;
  }
  async function loadCloudPhotos() {
    const result = await tablesDB.listRows({
      databaseId:config.databaseId,tableId:config.tableId,
      queries:[AppwriteSDK.Query.equal("type","photo"),AppwriteSDK.Query.limit(500)]
    });
    photos=await Promise.all((result.rows||[]).map(async row=>{
      let p={};
      try { p=JSON.parse(row.data||"{}"); } catch (_) {}
      let signedUrl=null;
      try { signedUrl=String(storage.getFileView({bucketId:config.bucketId,fileId:p.storage_path})); } catch (_) {}
      return {...p,id:row.$id,signedUrl};
    }));
    photos.sort((a,b)=>String(b.created_at||"").localeCompare(String(a.created_at||"")));
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
    const trimmed=String(name||"").trim();
    if (!trimmed || trimmed.length>32) return;
    if (photoFolders.some(f=>f.toLowerCase()===trimmed.toLowerCase())) throw new Error("That folder already exists.");
    await tablesDB.createRow({
      databaseId:config.databaseId,tableId:config.tableId,rowId:AppwriteSDK.ID.unique(),
      data:{type:"folder",data:JSON.stringify({name:trimmed,folder:trimmed,created_at:new Date().toISOString(),uploaded_by:user.$id})}
    });
    await loadCloudFolders(); photoFolder=trimmed; renderPhotos();
  }
  async function uploadPhoto(file) {
    if (!file.type.startsWith("image/")) throw new Error(file.name+" is not an image.");
    if (file.size>15*1024*1024) throw new Error(file.name+" is larger than 15 MB.");
    const fileResult=await storage.createFile({bucketId:config.bucketId,fileId:AppwriteSDK.ID.unique(),file});
    try {
      await tablesDB.createRow({
        databaseId:config.databaseId,tableId:config.tableId,rowId:AppwriteSDK.ID.unique(),
        data:{type:"photo",data:JSON.stringify({name:file.name,folder:photoFolder,storage_path:fileResult.$id,uploaded_by:user.$id,created_at:new Date().toISOString()})}
      });
    } catch (err) {
      try { await storage.deleteFile({bucketId:config.bucketId,fileId:fileResult.$id}); } catch (_) {}
      throw err;
    }
  }
  async function downloadPhoto(photo) {
    const url=String(storage.getFileDownload({bucketId:config.bucketId,fileId:photo.storage_path}));
    const a=document.createElement("a");
    a.href=url; a.download=photo.name||"our-little-world-photo"; a.target="_blank"; a.rel="noopener";
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function deletePhoto(photo) {
    await tablesDB.deleteRow({databaseId:config.databaseId,tableId:config.tableId,rowId:photo.id});
    try { await storage.deleteFile({bucketId:config.bucketId,fileId:photo.storage_path}); }
    catch (err) { console.warn("Deleted photo metadata; storage cleanup failed",err); }
    photos=photos.filter(p=>p.id!==photo.id); renderPhotos();
  }

  $$(".profile-pick").forEach(btn => btn.addEventListener("click", () => {
    selectedProfile = btn.dataset.profile;
    updateRoleTheme();
    setAuthMessage("");
  }));
  async function handleLogin() {
    if (!isConfigured()) {
      setAuthMessage("Secure login is not connected yet. Follow the setup guide to connect the two existing accounts.", true);
      return;
    }
    const password = $("#auth-password").value;
    if (!password) {
      setAuthMessage("Enter your password.");
      $("#auth-password").focus();
      return;
    }
    setAuthMessage("");
    try {
      await loginUser(password);
    } catch (err) {
      console.error(err);
      setAuthMessage(err.message || "Unable to log in. Check your password and connection.");
      $("#auth-password").value = "";
      $("#auth-password").focus();
    }
  }
  $("#auth-submit").addEventListener("click", (event) => {
    event.preventDefault();
    handleLogin();
  });
  $("#auth-form").addEventListener("submit", (event) => {
    event.preventDefault();
    handleLogin();
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
      if(btn.dataset.photoAction==="download") await downloadPhoto(photo);
      else if(confirm("Delete this photo from the shared album for both accounts?")) {
        await deletePhoto(photo); toast("Photo deleted");
      }
    } catch(err) { console.error(err); toast(err.message||"Photo action failed."); }
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
      user=await account.get();
      const role=profileForEmail(user.email);
      if (role) {
        profileRole=role; selectedProfile=role;
        updateRoleTheme();
        await showApp();
      } else {
        try { await account.deleteSession({sessionId:"current"}); } catch (_) {}
        user=null; profileRole=null;
        showAuth();
        setAuthMessage("This account isn't one of the two approved logins. Use Alexia or Dyan's account.",true);
      }
    } catch(err) {
      // A 401 means no current session; show the normal login form.
      user=null; profileRole=null;
      showAuth();
    }
  }
  initialize();
})();