let tasks = [];

// ---------- 新增 ----------
async function addTask() {
  const textEl = document.getElementById("text");
  const timeEl = document.getElementById("time");
  if (!textEl.value || !timeEl.value) {
    alert("請填完整");
    return;
  }
  await fs.addDoc(fs.collection(db, "tasks"), {
    text: textEl.value,
    time: timeEl.value
  });
  textEl.value = "";
  setDefaultTime();
  load();
}

// ---------- 讀取 ----------
async function load() {
  const snap = await fs.getDocs(fs.collection(db, "tasks"));
  tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
}

// ---------- 畫面 ----------
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
    li.querySelector(".edit").addEventListener("click", () => editTask(t.id, t.text));
    li.querySelector(".del").addEventListener("click", () => delTask(t.id));  // ✅ 現在 delTask 已定義
    list.appendChild(li);
  });
}

// 🔥 ---------- 刪除（你遺漏的函數，現在補上） ----------
async function delTask(id) {
  if (!confirm("確定刪除這筆任務？")) return;
  try {
    await fs.deleteDoc(fs.doc(db, "tasks", id));
    load();  // 重新載入
  } catch (error) {
    console.error("刪除失敗:", error);
    alert("刪除失敗，請檢查 Firestore 權限");
  }
}

// ---------- 編輯 ----------
async function editTask(id, oldText) {
  const newText = prompt("修改事項", oldText);
  if (!newText) return;
  await fs.updateDoc(fs.doc(db, "tasks", id), { text: newText });
  load();
}

// ---------- 預設時間 ----------
function setDefaultTime() {
  const timeEl = document.getElementById("time");
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  timeEl.value = now.toISOString().slice(0, 16);
}

// ---------- DOM Ready ----------
document.addEventListener("DOMContentLoaded", () => {
  setDefaultTime();
  document.getElementById("addBtn").addEventListener("click", addTask);
  load();
});