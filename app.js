(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const config = window.APP_CONFIG || {};
  const configured = !!(config.supabaseUrl && config.supabaseAnonKey &&
    !config.supabaseUrl.includes("YOUR_") && !config.supabaseAnonKey.includes("YOUR_"));
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
  let authMode = "login", selectedProfile = "her", user = null, profileName = "", profileRole = null, needsClaim = false;
  let items = [], filter = "all", categoryFilter = "all", query = "";
  let photoFolder = "Us", photoFolders = [...defaultFolders], photos = [], signedPhotoUrls = {};
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
  const isConfigured = () => !!supabase;
  function setAuthMessage(text, warning = false) {
    $("#auth-message").textContent = text || "";
    $("#auth-message").classList.toggle("warning-message", warning);
  }
  function updateRoleTheme() {
    document.body.classList.toggle("theme-him", selectedProfile === "him");
    document.body.classList.toggle("theme-her", selectedProfile !== "him");
    $$(".profile-pick").forEach(b => b.classList.toggle("active", b.dataset.profile === selectedProfile));
  }
  function showAuth() {
    $("#auth-screen").classList.remove("hidden");
    $("#app-screen").classList.add("hidden");
    $("#configuration-warning").classList.toggle("hidden", isConfigured());
    $("#auth-submit").disabled = !isConfigured();
    if (!isConfigured()) setAuthMessage("Secure login is not connected. Ask the site owner to finish the Supabase setup.", true);
    refreshSignupAvailability();
    updateRoleTheme();
  }
  async function getCoupleStatus() {
    if (!isConfigured()) return {her_taken:false, him_taken:false, complete:false};
    const {data,error} = await supabase.rpc("get_couple_status");
    if (error) throw error;
    return data || {her_taken:false, him_taken:false, complete:false};
  }
  async function refreshSignupAvailability() {
    const signupTab = $('[data-auth-mode="signup"]');
    if (!signupTab) return;
    try {
      const status = await getCoupleStatus();
      const full = !!status.complete;
      signupTab.classList.toggle("hidden", full);
      if (authMode === "signup" && full) {
        authMode = "login";
        $$("[data-auth-mode]").forEach(x => x.classList.toggle("active", x.dataset.authMode === authMode));
        $("#setup-code-label").classList.add("hidden");
        $("#auth-submit").innerHTML = 'Log in <span>↗</span>';
        setAuthMessage("Both accounts already exist. New account creation is closed.", true);
      }
      const roles = {her:!!status.her_taken,him:!!status.him_taken};
      $$(".profile-pick").forEach(btn => {
        btn.disabled = authMode === "signup" && roles[btn.dataset.profile];
        btn.title = btn.disabled ? "This profile already has an account." : "";
        btn.classList.toggle("role-taken", btn.disabled);
      });
      if (authMode === "signup" && roles[selectedProfile]) {
        selectedProfile = roles.her ? "him" : "her";
        updateRoleTheme();
      }
    } catch (e) {
      console.error(e);
      setAuthMessage("Could not check account setup. Run the database setup SQL, then try again.", true);
    }
  }
  async function checkMembership(authUser) {
    const {data,error} = await supabase.rpc("get_my_couple_profile");
    if (error) throw error;
    if (data === "her" || data === "him") return data;
    return null;
  }
  async function claimAccount(setupCode, role) {
    const {data,error} = await supabase.rpc("claim_couple_account", {p_setup_code: setupCode, p_profile: role});
    if (error) throw error;
    return data;
  }
  async function loginUser(email,password,setupCode) {
    const {data,error} = await supabase.auth.signInWithPassword({email,password});
    if (error) throw error;
    user = data.user;
    profileName = user.user_metadata?.display_name || "";
    const existingRole = await checkMembership(user);
    if (existingRole) {
      needsClaim = false;
      profileRole = existingRole;
      selectedProfile = existingRole;
      updateRoleTheme();
      await showApp();
      return;
    }
    // Accounts created while email confirmation is enabled need to claim their slot after confirmation.
    const pendingRole = user.user_metadata?.couple_profile;
    const role = (pendingRole === "her" || pendingRole === "him") ? pendingRole : selectedProfile;
    if (!setupCode || setupCode.length < 8) {
      needsClaim = true;
      $("#setup-code-label").classList.remove("hidden");
      selectedProfile = role;
      updateRoleTheme();
      throw new Error("Your account still needs to finish first-time setup. Enter the private couple setup code and press Log in again.");
    }
    profileRole = await claimAccount(setupCode,role);
    needsClaim = false;
    selectedProfile = profileRole;
    updateRoleTheme();
    await refreshSignupAvailability();
    await showApp();
  }
  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    user = null; profileRole = null; profileName = "";
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
  async function showApp() {
    if (!user || !profileRole) { showAuth(); return; }
    $("#auth-screen").classList.add("hidden");
    $("#app-screen").classList.remove("hidden");
    updateRoleTheme();
    $("#sync-status").textContent = "● Shared and synced";
    $("#account-email").textContent = (profileName ? profileName + " · " : "") + (user.email || "");
    $("#user-greeting").textContent = profileName ? "Hi, " + profileName : (selectedProfile === "him" ? "His little world" : "Her little world");
    $("#today-label").textContent = new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
    try {
      await loadItems();
      renderItems();
      await loadCloudPhotos();
      await loadCloudFolders();
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

  $$(".profile-pick").forEach(btn=>btn.addEventListener("click",()=>{
    if(btn.disabled)return;
    selectedProfile=btn.dataset.profile; updateRoleTheme(); setAuthMessage("");
  }));
  $$("[data-auth-mode]").forEach(btn=>btn.addEventListener("click",async()=>{
    authMode=btn.dataset.authMode;
    $$("[data-auth-mode]").forEach(x=>x.classList.toggle("active",x===btn));
    const signup=authMode==="signup";
    $("#auth-submit").innerHTML=signup?'Create account <span>♡</span>':'Log in <span>↗</span>';
    $("#auth-password").autocomplete=signup?"new-password":"current-password";
    $("#auth-name").closest("label").classList.toggle("hidden",!signup);
    $("#setup-code-label").classList.toggle("hidden",!signup && !needsClaim);
    $("#forgot-password").classList.toggle("hidden",signup);
    setAuthMessage("");
    await refreshSignupAvailability();
  }));
  $("#auth-form").addEventListener("submit",async e=>{
    e.preventDefault();
    if(!isConfigured()){setAuthMessage("Secure login is unavailable until Supabase is configured.",true);return;}
    const email=$("#auth-email").value.trim(), password=$("#auth-password").value, name=$("#auth-name").value.trim(), code=$("#auth-setup-code").value.trim();
    if(password.length<10){setAuthMessage("Use a password with at least 10 characters.");return;}
    $("#auth-submit").disabled=true; setAuthMessage("");
    try {
      if(authMode==="signup") {
        if(!name){setAuthMessage("Enter the name for this profile.");return;}
        if(code.length<8){setAuthMessage("Enter the private couple setup code.");return;}
        const status=await getCoupleStatus();
        if(status.complete){authMode="login";$("#auth-submit").innerHTML='Log in <span>↗</span>';$("#setup-code-label").classList.add("hidden");throw new Error("Both accounts are already set up. New account creation is closed.");}
        if((selectedProfile==="her"&&status.her_taken)||(selectedProfile==="him"&&status.him_taken))throw new Error("That profile already has an account. Choose the other profile.");
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:name,couple_profile:selectedProfile}}});
        if(error)throw error;
        if(data.session && data.user) {
          user=data.user; profileName=name;
          profileRole=await claimAccount(code,selectedProfile);
          await refreshSignupAvailability();
          await showApp();
          toast("Your account is ready ♡");
        } else {
          $("#setup-code-label").classList.remove("hidden");
          setAuthMessage("Check your email to confirm your account. Then choose Log in and use the same profile and private setup code to finish setup.",true);
        }
      } else {
        await loginUser(email,password,code);
      }
    } catch(err) {
      console.error(err);
      setAuthMessage(err.message || "Unable to complete sign-in.");
    } finally {
      $("#auth-submit").disabled=false;
    }
  });
  $("#forgot-password").addEventListener("click",async()=>{
    if(!isConfigured())return;
    const email=$("#auth-email").value.trim();
    if(!email){setAuthMessage("Enter your email address first.");return;}
    try {
      const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+window.location.pathname});
      if(error)throw error;
      setAuthMessage("If that account exists, a password reset email has been sent.",true);
    } catch(e){setAuthMessage(e.message||"Could not send the reset email.");}
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
    $("#auth-name").closest("label").classList.add("hidden");
    $("#setup-code-label").classList.add("hidden");
    $("#forgot-password").classList.remove("hidden");
    if(!isConfigured()){showAuth();return;}
    try {
      const {data,error}=await supabase.auth.getSession();
      if(error)throw error;
      if(data.session?.user) {
        user=data.session.user;
        profileName=user.user_metadata?.display_name||"";
        profileRole=await checkMembership(user);
        if(profileRole) {
          selectedProfile=profileRole; await showApp();
        } else {
          needsClaim = true;
          selectedProfile=(user.user_metadata?.couple_profile==="him"?"him":"her");
          updateRoleTheme();
          $("#setup-code-label").classList.remove("hidden");
          setAuthMessage("Finish your first-time setup by entering your private couple setup code and signing in.",true);
          showAuth();
        }
      } else showAuth();
    } catch(err) {console.error(err);showAuth();setAuthMessage("Unable to check login status. Verify the Supabase setup and database SQL.",true);}
    supabase.auth.onAuthStateChange(async(event,session)=>{
      if(event==="SIGNED_OUT"){user=null;profileRole=null;showAuth();}
      if(event==="PASSWORD_RECOVERY"){$("#password-dialog").showModal();}
    });
  }
  initialize();
})();