import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { db } from "./firebase.js";

let tasks = [];

/* ================================
   🔧 系統狀態同步（給 iOS 捷徑用）
================================ */
async function updateTaskStatus() {
  const status = tasks.length > 0 ? "HAS_TASK" : "NO_TASK";
  try {
    await setDoc(doc(db, "system", "status"), {
      task_status: status,
      updatedAt: Date.now()
    });
    console.log("📡 task_status =", status);
  } catch (e) {
    console.error("❌ 更新 system/status 失敗", e);
  }
}

/* ================================
   ➕ 新增任務
================================ */
async function addTask() {
  const textEl = document.getElementById("text");
  const timeEl = document.getElementById("time");

  if (!textEl.value || !timeEl.value) {
    alert("請填完整");
    return;
  }

  await addDoc(collection(db, "tasks"), {
    text: textEl.value,
    time: timeEl.value
  });

  textEl.value = "";
  setDefaultTime();
  load();
}

/* ================================
   📥 讀取任務
================================ */
async function load() {
  const snap = await getDocs(collection(db, "tasks"));
  tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
  updateTaskStatus(); // ⭐ 關鍵：每次同步狀態
}

/* ================================
   🖼️ 畫面渲染
================================ */
function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  if (tasks.length === 0) {
    list.innerHTML = `<li class="empty">目前沒有代辦事項</li>`;
    return;
  }

  tasks.forEach(t => {
    const li = document.createElement("li");
    li.className = "task-card";
    li.innerHTML = `
      <div class="task-text">${t.text}</div>
      <div class="task-time">${new Date(t.time).toLocaleString()}</div>
      <div class="task-actions">
        <button class="edit">編輯</button>
        <button class="del">刪除</button>
      </div>
    `;

    li.querySelector(".edit").addEventListener("click", () =>
      editTask(t.id, t.text)
    );
    li.querySelector(".del").addEventListener("click", () =>
      delTask(t.id)
    );

    list.appendChild(li);
  });
}

/* ================================
   ❌ 刪除任務
================================ */
async function delTask(id) {
  if (!confirm("確定刪除這筆任務？")) return;
  await deleteDoc(doc(db, "tasks", id));
  load();
}

/* ================================
   ✏️ 編輯任務
================================ */
async function editTask(id, oldText) {
  const newText = prompt("修改事項", oldText);
  if (!newText) return;
  await updateDoc(doc(db, "tasks", id), { text: newText });
  load();
}

/* ================================
   ⏰ 預設時間
================================ */
function setDefaultTime() {
  const timeEl = document.getElementById("time");
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  timeEl.value = now.toISOString().slice(0, 16);
}

/* ================================
   🚀 初始化
================================ */
document.addEventListener("DOMContentLoaded", () => {
  setDefaultTime();
  document.getElementById("addBtn").addEventListener("click", addTask);
  load();
});