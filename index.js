const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());

// Root route (keep this)
app.get('/', (req, res) => {
  res.send('API is running!');
});

// ADD this route for image search
app.get('/api/images', async (req, res) => {
  const userQuery = req.query.q || '';
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;
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
    // Add this for detailed logging:
    if (error.response) {
      console.error('Google API error:', error.response.status, error.response.data);
    } else {
      console.error('Google API error:', error.message);
    }
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});