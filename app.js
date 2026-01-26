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

async function load() {
  const snap = await fs.getDocs(fs.collection(db, "tasks"));
  const list = document.getElementById("list");
  list.innerHTML = "";

  snap.forEach(d => {
    const li = document.createElement("li");
    li.textContent = d.data().text;
    list.appendChild(li);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("addBtn").addEventListener("click", addTask);
  load();
});
