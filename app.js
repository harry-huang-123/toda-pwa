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
    time: timeEl.value   // 存的是 "2025-04-10T14:30" 這種本地格式字串
  });

  textEl.value = "";
  setDefaultTime();     // 新增後重設為現在
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
    li.querySelector(".del").addEventListener("click", () => delTask(t.id));

    list.appendChild(li);
  });
}


// ---------- 編輯 ----------
async function editTask(id, oldText) {
  const newText = prompt("修改事項", oldText);
  if (!newText) return;

  await fs.updateDoc(fs.doc(db, "tasks", id), { text: newText });
  load();
}

// ---------- 預設時間（修正時區，讓 <input type="datetime-local"> 顯示本地時間） ----------
function setDefaultTime() {
  const timeEl = document.getElementById("time");
  const now = new Date();

  // 關鍵修正：把分鐘加上時區偏移，得到本地時間的 ISO 字串前半段
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());

  // 產生 yyyy-MM-ddThh:mm 格式（datetime-local 需要的格式）
  timeEl.value = now.toISOString().slice(0, 16);
}

// ---------- DOM Ready ----------
document.addEventListener("DOMContentLoaded", () => {
  setDefaultTime();                    // 頁面載入時設為現在
  document.getElementById("addBtn").addEventListener("click", addTask);
  load();                              // 載入資料
});


