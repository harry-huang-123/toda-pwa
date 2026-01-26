let tasks = [];

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
  setDefaultTime(); // 新增後再幫你設回現在
  load();
}

/* ---------- 讀取 ---------- */
async function load() {
  const snap = await fs.getDocs(fs.collection(db, "tasks"));
  tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
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

    li.querySelector(".edit").addEventListener("click", () => editTask(t.id, t.text));
    li.querySelector(".del").addEventListener("click", () => delTask(t.id));

    list.appendChild(li);
  });
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

/* ---------- 預設時間（關鍵） ---------- */
function setDefaultTime() {
  const timeEl = document.getElementById("time");
  const now = new Date();



  timeEl.value = now.toISOString().slice(0, 16);
}

/* ---------- DOM Ready ---------- */
document.addEventListener("DOMContentLoaded", () => {
  setDefaultTime(); // 一進頁面就設今天
  document.getElementById("addBtn").addEventListener("click", addTask);
  load();
});

