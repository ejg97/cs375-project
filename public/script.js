const btn = document.getElementById('load-btn');
const output = document.getElementById('output');

btn.addEventListener('click', async () => {
  try {
    const res = await fetch('/api/hello');
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    output.textContent = data.message;
  } catch (err) {
    output.textContent = 'Error: ' + err.message;
  }
});