// app.js（ES module 正規寫法，無 onclick）

let tasks = [];

// 請求通知權限（不影響新增功能）
Notification.requestPermission();

/* ---------- 讀取資料 ---------- */
async function load() {
  const snap = await fs.getDocs(fs.collection(db, "tasks"));
  tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
}

/* ---------- 新增 ---------- */
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
  timeEl.value = "";
  load();
}

/* ---------- 刪除 ---------- */
async function delTask(id) {
  await fs.deleteDoc(fs.doc(db, "tasks", id));
  load();
}

/* ---------- 編輯 ---------- */
async function editTask(id, oldText) {
  const t = prompt("修改事項", oldText);
  if (!t) return;

  await fs.updateDoc(fs.doc(db, "tasks", id), { text: t });
  load();
}

/* ---------- 畫面 ---------- */
function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  tasks.forEach(t => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${t.text} (${new Date(t.time).toLocaleString()})
      <button class="edit">編輯</button>
      <button class="del">刪除</button>
    `;

    li.querySelector(".edit").addEventListener("click", () => {
      editTask(t.id, t.text);
    });

    li.querySelector(".del").addEventListener("click", () => {
      delTask(t.id);
    });

    list.appendChild(li);
  });
}

/* ---------- 事件綁定（唯一入口） ---------- */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("addBtn").addEventListener("click", addTask);
  load();
});
