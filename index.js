const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const dns = require("dns").promises;
const geoip = require("geoip-lite");

const db = require("./firebaseAdmin");

const app = express();
app.use(cors());
app.use(express.json());
// Geolocation endpoint
app.post("/api/geolocate", async (req, res) => {
  const urls = req.body.urls;
  if (!Array.isArray(urls)) {
    return res
      .status(400)
      .json({ error: "Request body must have a urls array" });
  }

  const results = await Promise.all(
    urls.map(async (url) => {
      let domain, ip, geo, country, city, lat, lng, location;
      try {
        domain = new URL(url).hostname;
        const ips = await dns.resolve4(domain);
        ip = ips[0];
        geo = geoip.lookup(ip);
        country = geo?.country || null;
        city = geo?.city || null;
        lat = geo?.ll?.[0] || null;
        lng = geo?.ll?.[1] || null;
        location = geo?.region || null;
      } catch (e) {
        // fallback if DNS or geo lookup fails
        country = null;
        city = null;
        lat = null;
        lng = null;
        location = null;
        domain = domain || null;
      }
      return {
        domain,
        country,
        city,
        lat,
        lng,
        location,
        count: 1,
      };
    })
  );
  res.json(results);
});

// Root route (keep this)
app.get("/", (req, res) => {
  res.send("API is running!");
});

// ADD this route for image search
app.get("/api/images", async (req, res) => {
  const userQuery = req.query.q || "";
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;
  const query = `great wave off kanagawa ${userQuery}`;
  const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
    query
  )}&cx=${cx}&searchType=image&key=${apiKey}&num=6`;

  try {
    const response = await axios.get(url);
    const images = response.data.items.map((item) => ({
      link: item.link,
      title: item.title,
    }));

    // Firestore logic: save under words collection
    const wordRef = db.collection("words").doc(userQuery);
    await db.runTransaction(async (t) => {
      const doc = await t.get(wordRef);
      if (!doc.exists) {
        t.set(wordRef, { count: 1, images });
      } else {
        const data = doc.data();
        // Merge new images, avoiding duplicates by link
        const existingLinks = new Set(
          (data.images || []).map((img) => img.link)
        );
        const mergedImages = [
          ...(data.images || []),
          ...images.filter((img) => !existingLinks.has(img.link)),
        ];
        t.update(wordRef, {
          count: (data.count || 0) + 1,
          images: mergedImages,
        });
      }
    });

    res.json(images);
  } catch (error) {
    // Add this for detailed logging:
    if (error.response) {
      console.error(
        "Google API error:",
        error.response.status,
        error.response.data
      );
    } else {
      console.error("Google API error:", error.message);
    }
    res.status(500).json({ error: "Failed to fetch images" });
  }
});

console.log("GOOGLE_API_KEY:", process.env.GOOGLE_API_KEY);
console.log("GOOGLE_CX:", process.env.GOOGLE_CX);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
