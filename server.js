const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// parse JSON bodies on incoming requests
app.use(express.json());

// serve everything in /public as static files
app.use(express.static(path.join(__dirname, 'public')));

// example API route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from the server' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});