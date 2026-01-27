/*************************************************
 * Firebase CDN（一定要在 app.js 裡）
 *************************************************/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/*************************************************
 * Firebase 設定（⚠️換成你自己的）
 *************************************************/
const firebaseConfig = {
  apiKey: "你的_API_KEY",
  authDomain: "你的專案.firebaseapp.com",
  projectId: "你的_projectId",
  storageBucket: "你的.appspot.com",
  messagingSenderId: "xxxx",
  appId: "xxxx"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/*************************************************
 * 全域資料
 *************************************************/
let tasks = [];

/*************************************************
 * 新增
 *************************************************/
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

/*************************************************
 * 讀取
 *************************************************/
async function load() {
  const snap = await getDocs(collection(db, "tasks"));
  tasks = snap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  render();
  updateShortcutStatus(); // ⭐ 給 iOS 捷徑用
}

/*************************************************
 * 畫面
 *************************************************/
function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";

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

    li.querySelector(".edit").onclick = () => editTask(t.id, t.text);
    li.querySelector(".del").onclick = () => delTask(t.id);

    list.appendChild(li);
  });
}

/*************************************************
 * 刪除
 *************************************************/
async function delTask(id) {
  if (!confirm("確定刪除這筆任務？")) return;
  await deleteDoc(doc(db, "tasks", id));
  load();
}

/*************************************************
 * 編輯
 *************************************************/
async function editTask(id, oldText) {
  const newText = prompt("修改事項", oldText);
  if (!newText) return;
  await updateDoc(doc(db, "tasks", id), { text: newText });
  load();
}

/*************************************************
 * 預設時間
 *************************************************/
function setDefaultTime() {
  const timeEl = document.getElementById("time");
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  timeEl.value = now.toISOString().slice(0, 16);
}

/*************************************************
 * ⭐ 給 iOS 捷徑用的狀態輸出 ⭐
 * 頁面只會顯示一行文字
 *************************************************/
function updateShortcutStatus() {
  const statusEl = document.getElementById("shortcutStatus");
  if (!statusEl) return;

  statusEl.textContent = tasks.length > 0 ? "HAS_TASK" : "NO_TASK";
}

/*************************************************
 * DOM Ready
 *************************************************/
document.addEventListener("DOMContentLoaded", () => {
  setDefaultTime();
  document.getElementById("addBtn").onclick = addTask;
  load();
});