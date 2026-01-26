/* =========================================================
   全域狀態
========================================================= */
let tasks = [];

/* =========================================================
   新增待辦
========================================================= */
async function addTask() {
  const textEl = document.getElementById("text");
  const timeEl = document.getElementById("time");

  if (!textEl.value || !timeEl.value) {
    alert("請填完整");
    return;
  }

  try {
    await fs.addDoc(fs.collection(db, "tasks"), {
      text: textEl.value,
      time: timeEl.value   // yyyy-MM-ddTHH:mm（本地時間字串）
    });

    textEl.value = "";
    setDefaultTime();
    load();
  } catch (e) {
    console.error("新增失敗:", e);
    alert("新增失敗，請稍後再試");
  }
}

/* =========================================================
   讀取資料
========================================================= */
async function load() {
  const snap = await fs.getDocs(fs.collection(db, "tasks"));
  tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
}

/* =========================================================
   畫面渲染（結構完全分離）
========================================================= */
function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  tasks.forEach(t => {
    const li = document.createElement("li");
    li.className = "task-card";

    li.innerHTML = `
      <div class="task-text">${t.text}</div>
      <div class="task-time">${formatTime(t.time)}</div>
      <div class="task-actions">
        <button class="edit">編輯</button>
        <button class="del">刪除</button>
      </div>
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

/* =========================================================
   刪除
========================================================= */
async function delTask(id) {
  if (!confirm("確定要刪除這筆事項嗎？")) return;

  try {
    await fs.deleteDoc(fs.doc(db, "tasks", id));
    load();
  } catch (e) {
    console.error("刪除失敗:", e);
    alert("刪除失敗，請稍後再試");
  }
}

/* =========================================================
   編輯
========================================================= */
async function editTask(id, oldText) {
  const newText = prompt("修改事項", oldText);
  if (!newText) return;

  try {
    await fs.updateDoc(fs.doc(db, "tasks", id), {
      text: newText
    });
    load();
  } catch (e) {
    console.error("編輯失敗:", e);
    alert("修改失敗，請稍後再試");
  }
}

/* =========================================================
   預設時間（datetime-local 顯示本地時間）
========================================================= */
function setDefaultTime() {
  const timeEl = document.getElementById("time");
  const now = new Date();

  // 修正時區，避免 +8 小時問題
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  timeEl.value = now.toISOString().slice(0, 16);
}

/* =========================================================
   時間格式化顯示
========================================================= */
function formatTime(value) {
  return new Date(value).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/* =========================================================
   DOM Ready
========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  setDefaultTime();
  document.getElementById("addBtn").addEventListener("click", addTask);
  load();
});
