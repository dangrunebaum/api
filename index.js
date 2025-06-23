const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const app = express();
app.use(cors());

app.get('/', (req, res) => {
  res.send('API is running!');
});

// Add this route for image search
app.get('/api/images', async (req, res) => {
  const userQuery = req.query.q || '';
  const apiKey = process.env.GOOGLE_API_KEY; // Store in .env
  const cx = process.env.GOOGLE_CX;         // Store in .env
  const query = `great wave off kanagawa ${userQuery}`;
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${cx}&searchType=image&key=${apiKey}&num=6`;

  try {
    const response = await axios.get(url);
    const images = response.data.items.map(item => ({
      link: item.link,
      title: item.title
    }));
    res.json(images);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});