(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const STORAGE_KEY = "our-little-world.bucket-list.v3-luxembourgish";
  const categoryNames = {date:"Date idea",travel:"Place to go",food:"Food & drink",adventure:"Adventure",little:"Little thing"};
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
  // Imported from the bucket-list screenshots. kind separates destinations from activities.
  const bucketListItems = [
    {title:"Klotterpark",kind:"activity",category:"adventure",priority:"someday"},
    {title:"Streichelzoo an Däitschland",kind:"place",category:"travel",priority:"someday"},
    {title:"Lappland",kind:"place",category:"travel",priority:"someday"},
    {title:"Roude Sand op Hormuz, Iran",kind:"place",category:"travel",priority:"someday"},
    {title:"Tauchen",kind:"activity",category:"adventure",priority:"someday"},
    {title:"Fëschen",kind:"activity",category:"little",priority:"someday"},
    {title:"Stauséi",kind:"place",category:"travel",priority:"someday"},
    {title:"Camping",kind:"activity",category:"adventure",priority:"someday"},
    {title:"Kloteren am Bësch",kind:"activity",category:"adventure",priority:"someday"},
    {title:"Wanderen",kind:"activity",category:"adventure",priority:"someday"},
    {title:"Töpferen",kind:"activity",category:"little",priority:"someday"},
    {title:"Spillowend",kind:"activity",category:"date",priority:"someday"},
    {title:"Rage Room",kind:"activity",category:"adventure",priority:"someday"},
    {title:"Schwämm Calypso",kind:"place",category:"travel",priority:"someday"},
    {title:"Brasilianesche Volleyball",kind:"activity",category:"adventure",priority:"someday"},
    {title:"Yoga",kind:"activity",category:"little",priority:"someday"},
    {title:"Super Mario / Nintendo a Japan",kind:"place",category:"travel",priority:"someday"},
    {title:"Nordkapp",kind:"place",category:"travel",priority:"someday"},
    {title:"Padel spillen",kind:"activity",category:"adventure",priority:"someday"},
    {title:"Lodalen",kind:"place",category:"travel",priority:"someday"},
    {title:"Nuuk, Grönland",kind:"place",category:"travel",priority:"someday"},
    {title:"Mount Fuji",kind:"place",category:"travel",priority:"someday"},
    {title:"Mieresfriichten an engem Restaurant iessen",kind:"activity",category:"food",priority:"someday"},
    {title:"Picknick",kind:"activity",category:"date",priority:"someday"},
    {title:"Volleyball spillen",kind:"activity",category:"adventure",priority:"someday",completed:true},
    {title:"Zesumme mam Motorrad fueren",kind:"activity",category:"adventure",priority:"someday",completed:true},
    {title:"Sauna",kind:"activity",category:"little",priority:"someday",completed:true},
    {title:"Molenowend",kind:"activity",category:"date",priority:"someday",completed:true},
    {title:"Schossel bemolen (Bowl painting)",kind:"activity",category:"little",priority:"someday",completed:true},
    {title:"Déierepark Esch",kind:"place",category:"travel",priority:"someday",completed:true},
    {title:"Ramen bei der Gëlle Fra iessen",kind:"activity",category:"food",priority:"someday",completed:true}
  ].map((item,index) => ({
    ...item,
    id:"couple-list-"+(index+1),
    description:"",
    dream_date:"",
    completed_at:item.completed ? new Date().toISOString() : "",
    created_at:new Date(Date.now()+index).toISOString()
  }));

  let selectedProfile = "her";
  let currentProfile = null;
  let items = loadItems();
  let filter = "all";
  let categoryFilter = "all";
  let kindFilter = "all";
  let query = "";
  let editingId = null;

  function loadItems() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    const initialItems = bucketListItems.map(item => ({...item}));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(initialItems)); } catch (_) {}
    return initialItems;
  }
  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      $("#sync-status").textContent = "● Saved locally";
    } catch (_) {
      $("#sync-status").textContent = "● Save unavailable";
      toast("This browser could not save changes.");
    }
  }
  function safe(value = "") {
    return String(value).replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[ch]));
  }
  function prettyDate(value) {
    if (!value) return "";
    const date = new Date(value + "T12:00:00");
    return date.toLocaleDateString(undefined, {
      month:"short", day:"numeric",
      year:date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
    });
  }
  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2400);
  }
  function updateRoleTheme() {
    document.body.classList.toggle("theme-him", selectedProfile === "him");
    document.body.classList.toggle("theme-her", selectedProfile !== "him");
    $$(".profile-pick").forEach(button => {
      button.classList.toggle("active", button.dataset.profile === selectedProfile);
    });
    const isDyan = selectedProfile === "him";
    const name = isDyan ? "Dyan" : "Alexia";
    $("#selected-login-name").textContent = name;
    $("#selected-login-hint").textContent = isDyan ? "His space · blue" : "Her space · pink";
    $("#auth-submit").innerHTML = "Log in as " + name + ' <span>↗</span>';
  }
  function showAuth() {
    $("#auth-screen").classList.remove("hidden");
    $("#app-screen").classList.add("hidden");
    $("#auth-password").value = "";
    $("#auth-message").textContent = "";
    updateRoleTheme();
  }
  function showApp() {
    $("#auth-screen").classList.add("hidden");
    $("#app-screen").classList.remove("hidden");
    const name = currentProfile === "him" ? "Dyan" : "Alexia";
    $("#user-greeting").textContent = "Here with " + name;
    $("#account-email").textContent = name + " · " + (currentProfile === "him" ? "Blue profile" : "Pink profile");
    $("#today-label").textContent = new Date().toLocaleDateString(undefined, {
      weekday:"long", month:"short", day:"numeric"
    });
    $("#sync-status").textContent = "● Saved locally";
    renderItems();
    updateRoleTheme();
  }
  const PASSWORD_HASHES = {
    him: "0b8fd3adc6e343103d517e65e6edfdeb9e238743f2f867632aeaf81bda41ffd9",
    her: "faafcaab1e38af3d4b32c4d22ff8168609a93c9d7e1acb3db1b14d1c1d5ea059"
  };

  async function login() {
    const password = $("#auth-password").value;
    const submit = $("#auth-submit");
    const message = $("#auth-message");
    if (!password) {
      message.textContent = "Enter your password to continue.";
      return;
    }
    submit.disabled = true;
    message.textContent = "";
    try {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
      const passwordHash = [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, "0"))
        .join("");
      if (passwordHash !== PASSWORD_HASHES[selectedProfile]) {
        message.textContent = "That password is incorrect. Try again.";
        $("#auth-password").value = "";
        $("#auth-password").focus();
        return;
      }
      currentProfile = selectedProfile;
      $("#auth-password").value = "";
      showApp();
    } catch (_) {
      message.textContent = "Password check failed. Refresh the page and try again.";
      $("#auth-password").value = "";
    } finally {
      submit.disabled = false;
    }
  }
  function logout() {
    currentProfile = null;
    selectedProfile = "her";
    if ($("#account-dialog").open) $("#account-dialog").close();
    showAuth();
  }
  function sortItems(list) {
    return [...list].sort((a,b) =>
      Number(!!a.completed) - Number(!!b.completed) ||
      String(a.created_at || "").localeCompare(String(b.created_at || ""))
    );
  }
  function renderItems() {
    const list = sortItems(items).filter(item => {
      if (filter === "active" && item.completed) return false;
      if (filter === "completed" && !item.completed) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (kindFilter !== "all" && (item.kind || "activity") !== kindFilter) return false;
      const text = (String(item.title || "") + " " + String(item.description || "")).toLowerCase();
      return text.includes(query.toLowerCase());
    });
    const total = items.length;
    const completed = items.filter(item => item.completed).length;
    $("#remaining-count").textContent = String(total - completed);
    $("#completed-count").textContent = String(completed);
    $("#progress-percent").textContent = (total ? Math.round(completed / total * 100) : 0) + "%";
    $("#progress-bar").style.width = (total ? completed / total * 100 : 0) + "%";

    const out = [];
    let hasDivider = false;
    list.forEach(item => {
      if (item.completed && !hasDivider) {
        out.push('<div class="completed-divider">MEMORIES MADE</div>');
        hasDivider = true;
      }
      const priorityLabel = {must:"Must do ♡",soon:"Soon-ish",someday:"Someday"}[item.priority] || "Someday";
      const doneTag = item.completed ? '<span class="tag done">Done ♡</span>' : "";
      const dateTag = item.dream_date ? '<span class="item-date">' + safe(prettyDate(item.dream_date)) + '</span>' : "";
      const kind = item.kind === "place" ? "place" : "activity";
      const kindLabel = kind === "place" ? "Place" : "Thing to do";
      out.push(
        '<article class="bucket-item ' + (item.completed ? "is-complete" : "") + '" data-id="' + safe(item.id) + '">' +
          '<button class="check-button" type="button" data-action="toggle" aria-label="' + (item.completed ? "Mark not done" : "Mark done") + '">' + (item.completed ? "✓" : "") + '</button>' +
          '<div class="item-main"><div class="item-title">' + safe(item.title) + '</div>' +
          (item.description ? '<div class="item-description">' + safe(item.description) + '</div>' : '') +
          '<div class="item-meta"><span class="tag kind-tag kind-' + kind + '">' + kindLabel + '</span>' +
          '<span class="tag">' + safe(categoryNames[item.category] || "Little thing") + '</span>' +
          '<span class="tag ' + safe(item.priority || "someday") + '">' + safe(priorityLabel) + '</span>' + doneTag + dateTag + '</div></div>' +
          '<div class="item-actions"><button class="icon-button" type="button" data-action="edit" aria-label="Edit dream" title="Edit">✎</button>' +
          '<button class="icon-button" type="button" data-action="delete" aria-label="Delete dream" title="Delete">×</button></div>' +
        '</article>'
      );
    });
    $("#bucket-list").innerHTML = out.join("");
    $("#empty-state").classList.toggle("hidden", list.length !== 0);
    $("#completed-note").classList.toggle("hidden", total === 0);
  }
  function setFilter(value) {
    filter = value;
    $$(".filter").forEach(button => button.classList.toggle("active", button.dataset.filter === filter));
    renderItems();
  }
  function setCategory(value) {
    categoryFilter = value;
    $$(".chip").forEach(button => button.classList.toggle("active", button.dataset.category === categoryFilter));
    renderItems();
  }
  function setKind(value) {
    kindFilter = value;
    $$(".kind-filter").forEach(button => button.classList.toggle("active", button.dataset.kind === kindFilter));
    renderItems();
  }

  function openAddDialog(item = null) {
    editingId = item ? item.id : null;
    $("#add-error").textContent = "";
    $("#item-title").value = item ? item.title : "";
    $("#item-kind").value = item ? (item.kind || "activity") : "activity";
    $("#item-description").value = item ? (item.description || "") : "";
    $("#item-category").value = item ? (item.category || "little") : "date";
    $("#item-priority").value = item ? (item.priority || "someday") : "someday";
    $("#item-date").value = item ? (item.dream_date || "") : "";
    const heading = $("#add-dialog h2");
    heading.textContent = item ? "Edit your dream" : "Add to our list";
    const submit = $("#add-form button[type='submit']");
    submit.innerHTML = item ? "Save changes <span>♡</span>" : "Add to our world <span>♡</span>";
    $("#add-dialog").showModal();
  }
  function addOrUpdateItem() {
    const title = $("#item-title").value.trim();
    if (!title) {
      $("#add-error").textContent = "Give your dream a name first.";
      return;
    }
    const previous = editingId ? items.find(item => item.id === editingId) : null;
    const next = {
      id: editingId || ("dream-" + Date.now() + "-" + Math.random().toString(36).slice(2,7)),
      title:title.slice(0,120),
      kind:$("#item-kind").value === "place" ? "place" : "activity",
      description:$("#item-description").value.trim().slice(0,400),
      category:$("#item-category").value,
      priority:$("#item-priority").value,
      dream_date:$("#item-date").value,
      completed:previous ? !!previous.completed : false,
      created_at:previous ? previous.created_at : new Date().toISOString()
    };
    if (previous) items = items.map(item => item.id === editingId ? next : item);
    else items.push(next);
    saveItems();
    $("#add-dialog").close();
    renderItems();
    toast(previous ? "Dream updated." : "Added to your list.");
    editingId = null;
  }

  $$(".profile-pick").forEach(button => {
    button.addEventListener("click", () => {
      selectedProfile = button.dataset.profile;
      updateRoleTheme();
      $("#auth-message").textContent = "";
      $("#auth-password").focus();
    });
  });
  $("#auth-form").addEventListener("submit", event => {
    event.preventDefault();
    login();
  });
  $("#signout-button").addEventListener("click", logout);
  $("#account-button").addEventListener("click", () => $("#account-dialog").showModal());
  $("#close-account").addEventListener("click", () => $("#account-dialog").close());
  $("#account-signout").addEventListener("click", logout);
  $("#open-add").addEventListener("click", () => openAddDialog());
  $("#empty-add").addEventListener("click", () => openAddDialog());
  $("#close-add").addEventListener("click", () => $("#add-dialog").close());
  $("#add-form").addEventListener("submit", event => {
    event.preventDefault();
    addOrUpdateItem();
  });
  $("#bucket-list").addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const card = button.closest("[data-id]");
    const item = items.find(entry => entry.id === card?.dataset.id);
    if (!item) return;
    if (button.dataset.action === "toggle") {
      item.completed = !item.completed;
      item.completed_at = item.completed ? new Date().toISOString() : "";
      saveItems();
      renderItems();
    } else if (button.dataset.action === "delete") {
      if (confirm("Remove this dream from your list?")) {
        items = items.filter(entry => entry.id !== item.id);
        saveItems();
        renderItems();
        toast("Dream removed.");
      }
    } else if (button.dataset.action === "edit") {
      openAddDialog(item);
    }
  });
  $("#search-input").addEventListener("input", event => {
    query = event.target.value || "";
    renderItems();
  });
  $$(".filter").forEach(button => button.addEventListener("click", () => setFilter(button.dataset.filter)));
  $(".chip").forEach(button => button.addEventListener("click", () => setCategory(button.dataset.category)));
  $(".kind-filter").forEach(button => button.addEventListener("click", () => setKind(button.dataset.kind)));
  $("#new-prompt").addEventListener("click", () => {
    const current = $("#prompt-text").textContent;
    const choices = prompts.filter(prompt => prompt !== current);
    $("#prompt-text").textContent = choices[Math.floor(Math.random() * choices.length)] || prompts[0];
  });

  updateRoleTheme();
  renderItems();
  showAuth();
})();