const API_URL = "http://localhost:7880/todos";

let currentTodos = [];
let editingId = null;
let detailTodo = null;

document.addEventListener("DOMContentLoaded", () => {
  setToday();
  loadTodos();
  setupListeners();
});

function setToday() {
  const label = document.getElementById("date-label");
  const now = new Date();
  label.textContent = now.toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function setupListeners() {
  document
    .getElementById("add-task-btn")
    .addEventListener("click", () => openTaskModal());

  document
    .getElementById("task-modal-close")
    .addEventListener("click", closeTaskModal);
  document
    .getElementById("task-modal-cancel")
    .addEventListener("click", closeTaskModal);

  const taskForm = document.getElementById("task-form");
  if (taskForm) {
    taskForm.addEventListener("submit", handleSaveTask);
  }

  document
    .getElementById("detail-modal-close")
    .addEventListener("click", closeDetailModal);

  document.getElementById("detail-edit-btn").addEventListener("click", () => {
    if (!detailTodo) return;
    const toEdit = detailTodo;
    closeDetailModal();
    openTaskModal(toEdit);
  });

  document.getElementById("detail-delete-btn").addEventListener("click", () => {
    if (detailTodo) deleteTodo(detailTodo.id);
  });

  document
    .getElementById("detail-notstarted-btn")
    .addEventListener("click", async () => {
      if (detailTodo) {
        await setStatus(detailTodo, "not-started");
        closeDetailModal();
      }
    });

  document
    .getElementById("detail-progress-btn")
    .addEventListener("click", async () => {
      if (detailTodo) {
        await setStatus(detailTodo, "in-progress");
        closeDetailModal();
      }
    });

  document
    .getElementById("detail-complete-btn")
    .addEventListener("click", async () => {
      if (detailTodo) {
        await setStatus(detailTodo, "completed");
        closeDetailModal();
      }
    });

  const searchInput = document.getElementById("search-input");
  const searchButton = document.getElementById("search-button");
  const searchIconSearch = document.getElementById("search-icon-search");
  const searchIconClear = document.getElementById("search-icon-clear");
  let searchTimeout;

  function updateSearchIcons() {
    const hasText = searchInput.value.trim().length > 0;
    if (hasText) {
      searchIconSearch.style.display = "none";
      searchIconClear.style.display = "inline-block";
    } else {
      searchIconSearch.style.display = "inline-block";
      searchIconClear.style.display = "none";
    }
  }

  function runSearch() {
    const value = searchInput.value.trim();
    loadTodos(value);
    updateSearchIcons();
  }

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(runSearch, 300);
    });

    searchInput.addEventListener("input", updateSearchIcons);

    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runSearch();
      }
    });
  }

  if (searchButton) {
    searchButton.addEventListener("click", (e) => {
      e.preventDefault();
      const hasText = searchInput.value.trim().length > 0;
      if (hasText) {
        searchInput.value = "";
        updateSearchIcons();
        loadTodos("");
      } else {
        runSearch();
      }
    });
  }

  const themeToggle = document.getElementById("theme-toggle");
  const iconSun = document.getElementById("icon-sun");
  const iconMoon = document.getElementById("icon-moon");

  if (themeToggle) {
    const savedTheme = localStorage.getItem("theme") || "light";
    const isDark = savedTheme === "dark";

    if (isDark) {
      document.body.classList.add("dark-theme");
    }

    iconSun.style.display = isDark ? "none" : "inline-block";
    iconMoon.style.display = isDark ? "inline-block" : "none";

    themeToggle.addEventListener("click", () => {
      const isCurrentlyDark = document.body.classList.contains("dark-theme");
      const newTheme = isCurrentlyDark ? "light" : "dark";

      document.body.classList.toggle("dark-theme");

      iconSun.style.display = newTheme === "light" ? "inline-block" : "none";
      iconMoon.style.display = newTheme === "dark" ? "inline-block" : "none";

      localStorage.setItem("theme", newTheme);
    });
  }
}

async function loadTodos(query = "") {
  try {
    const url = query ? `${API_URL}?q=${encodeURIComponent(query)}` : API_URL;

    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to load todos");

    const data = await res.json();

    currentTodos = Array.isArray(data) ? data : [];
    renderTodos();
    updateStatusCounts();
  } catch (err) {
    console.error("Failed to load todos", err);
  }
}

// post
async function saveTodoToServer(todo) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(todo),
  });
  if (!res.ok) throw new Error("Failed to create todo");
  return res.json();
}

// patch
async function updateTodoOnServer(id, changes) {
  const res = await fetch(`${API_URL}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (!res.ok) throw new Error("Failed to update todo");
  return res.json();
}

async function deleteTodo(id) {
  if (!confirm("Delete this task?")) return;
  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete");
    closeDetailModal();
    await loadTodos();
  } catch (err) {
    console.error(err);
  }
}

function renderTodos() {
  const list = document.getElementById("todo-list");
  const completedList = document.getElementById("completed-list");
  list.innerHTML = "";
  completedList.innerHTML = "";

  const searchInput = document.getElementById("search-input");
  const hasQuery = searchInput && searchInput.value.trim().length > 0;

  if (currentTodos.length === 0) {
    list.innerHTML = hasQuery
      ? "<p>No match for your search.</p>"
      : '<p>No tasks yet. Click "Add Task".</p>';
    return;
  }

  currentTodos.forEach((todo) => {
    const card = document.createElement("div");
    card.className = "todo-card";
    if (todo.status === "completed" || todo.completed) {
      card.classList.add("completed");
    }

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "todo-checkbox";
    checkbox.checked = todo.status === "completed" || !!todo.completed;

    checkbox.addEventListener("click", (e) => {
      e.stopPropagation();
      const newStatus = checkbox.checked ? "completed" : "not-started";
      setStatus(todo, newStatus);
    });

    const main = document.createElement("div");
    main.className = "todo-main";
    main.addEventListener("click", () => openDetailModal(todo));

    const title = document.createElement("h3");
    title.className = "todo-title";
    title.textContent = todo.title;

    const meta = document.createElement("div");
    meta.className = "todo-meta";

    const start = todo.startDate || "";
    const due = todo.dueDate || "N/A";
    const dateRange = start ? `${start} – ${due}` : `Due ${due}`;
    meta.textContent = `${todo.category || "General"} • ${dateRange}`;

    const tags = document.createElement("div");
    tags.className = "todo-tags";

    const categoryBadge = document.createElement("span");
    categoryBadge.className = "badge";
    categoryBadge.textContent = todo.category || "General";

    const statusBadge = document.createElement("span");
    statusBadge.className = "badge badge-status";

    const status =
      todo.status || (todo.completed ? "completed" : "not-started");
    statusBadge.textContent =
      status === "completed"
        ? "Completed"
        : status === "in-progress"
        ? "In Progress"
        : "Not Started";

    tags.appendChild(categoryBadge);
    tags.appendChild(statusBadge);

    main.appendChild(title);
    main.appendChild(meta);
    main.appendChild(tags);

    card.appendChild(checkbox);
    card.appendChild(main);

    list.appendChild(card);

    if (status === "completed") {
      const c = document.createElement("div");
      c.className = "completed-item";
      c.textContent = `✓ ${todo.title}`;
      completedList.appendChild(c);
    }
  });
}

function updateStatusCounts() {
  const completed = currentTodos.filter(
    (t) =>
      (t.status || (t.completed ? "completed" : "not-started")) === "completed"
  ).length;

  const inProgress = currentTodos.filter(
    (t) => t.status === "in-progress"
  ).length;

  const notStarted = currentTodos.filter((t) => {
    const status = t.status || (t.completed ? "completed" : "not-started");
    return status === "not-started";
  }).length;

  document.getElementById("count-completed").textContent = completed;
  document.getElementById("count-progress").textContent = inProgress;
  document.getElementById("count-notstarted").textContent = notStarted;
}

function openTaskModal(todo = null) {
  const modal = document.getElementById("task-modal");
  const form = document.getElementById("task-form");
  const title = document.getElementById("task-modal-title");

  if (todo) {
    editingId = todo.id;
    title.textContent = "Edit Task";
    form.title.value = todo.title || "";
    form.category.value = todo.category || "";
    form.startDate.value = todo.startDate || "";
    form.dueDate.value = todo.dueDate || "";
    form.description.value = todo.description || "";
  } else {
    editingId = null;
    title.textContent = "Add New Task";
    form.reset();
  }

  modal.classList.remove("hidden");
}

function closeTaskModal() {
  document.getElementById("task-modal").classList.add("hidden");
}

async function handleSaveTask(e) {
  e.preventDefault();
  const form = e.target;

  const baseTodo = {
    title: form.title.value.trim(),
    category: form.category.value.trim(),
    startDate: form.startDate.value,
    dueDate: form.dueDate.value,
    description: form.description.value.trim(),
  };

  if (!baseTodo.title || !baseTodo.dueDate || !baseTodo.description) {
    alert("Please fill in title, due date and description.");
    return;
  }

  try {
    if (editingId) {
      const existing = currentTodos.find((t) => t.id === editingId);
      baseTodo.status = existing?.status || "not-started";
      baseTodo.completed = existing?.status === "completed";
      await updateTodoOnServer(editingId, baseTodo);
    } else {
      baseTodo.status = "not-started";
      baseTodo.completed = false;
      await saveTodoToServer(baseTodo);
    }

    closeTaskModal();
    await loadTodos();
  } catch (err) {
    console.error(err);
  }
}

function openDetailModal(todo) {
  detailTodo = todo;

  const status = todo.status || (todo.completed ? "completed" : "not-started");

  document.getElementById("detail-title").textContent = todo.title;
  document.getElementById("detail-category").textContent =
    todo.category || "General";
  document.getElementById("detail-startDate").textContent =
    todo.startDate || "N/A";
  document.getElementById("detail-dueDate").textContent = todo.dueDate || "N/A";
  document.getElementById("detail-status").textContent =
    status === "completed"
      ? "Completed"
      : status === "in-progress"
      ? "In Progress"
      : "Not Started";
  document.getElementById("detail-description").textContent =
    todo.description || "";

  updateStatusButtons(status);

  document.getElementById("detail-modal").classList.remove("hidden");
}

function updateStatusButtons(currentStatus) {
  const notStartedBtn = document.getElementById("detail-notstarted-btn");
  const progressBtn = document.getElementById("detail-progress-btn");
  const completeBtn = document.getElementById("detail-complete-btn");

  notStartedBtn.classList.remove("active");
  progressBtn.classList.remove("active");
  completeBtn.classList.remove("active");

  if (currentStatus === "not-started") notStartedBtn.classList.add("active");
  else if (currentStatus === "in-progress") progressBtn.classList.add("active");
  else if (currentStatus === "completed") completeBtn.classList.add("active");
}

function closeDetailModal() {
  document.getElementById("detail-modal").classList.add("hidden");
}

async function setStatus(todo, status) {
  const changes = {
    status,
    completed: status === "completed",
  };
  try {
    await updateTodoOnServer(todo.id, changes);
    await loadTodos();
  } catch (err) {
    console.error(err);
  }
}
