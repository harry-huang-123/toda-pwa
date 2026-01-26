let tasks = [];

Notification.requestPermission();

async function load() {
  const snap = await fs.getDocs(fs.collection(db, "tasks"));
  tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
}

async function addTask() {
  if (!text.value || !time.value) return alert("請填完整");

  await fs.addDoc(fs.collection(db, "tasks"), {
    text: text.value,
    time: time.value
  });

  text.value = "";
  time.value = "";
  load();
}

// 🔥 關鍵這一行
window.addTask = addTask;


async function del(id) {
  await fs.deleteDoc(fs.doc(db, "tasks", id));
  load();
}
window.del = del;

async function edit(id, old) {
  const t = prompt("修改事項", old);
  if (!t) return;
  await fs.updateDoc(fs.doc(db, "tasks", id), { text: t });
  load();
}
window.edit = edit;

function render() {
  list.innerHTML = "";
  tasks.forEach(t => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${t.text} (${new Date(t.time).toLocaleString()})
      <button onclick="edit('${t.id}','${t.text}')">編輯</button>
      <button onclick="del('${t.id}')">刪除</button>
    `;
    list.appendChild(li);
  });
}
window.render = render;

load();
