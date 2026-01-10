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

// Multilang endpoint for Great Wave translations
app.get("/api/images/multilang", async (req, res) => {
  const userQuery = req.query.q || "";
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_CX;

  // Top 10 most commonly spoken languages with translations
  const languages = [
    { code: "en", label: "English", translation: "Great Wave off Kanagawa" },
    { code: "zh", label: "Chinese", translation: "神奈川沖浪裏" },
    { code: "hi", label: "Hindi", translation: "कानागावा की महान लहर" },
    { code: "es", label: "Spanish", translation: "La gran ola de Kanagawa" },
    { code: "fr", label: "French", translation: "La Grande Vague de Kanagawa" },
    {
      code: "ar",
      label: "Arabic",
      translation: "الموجة العظيمة قبالة كاناغاوا",
    },
    {
      code: "pt",
      label: "Portuguese",
      translation: "A Grande Onda de Kanagawa",
    },
    { code: "ru", label: "Russian", translation: "Большая волна в Канагаве" },
    { code: "ja", label: "Japanese", translation: "神奈川沖浪裏" },
    {
      code: "de",
      label: "German",
      translation: "Die große Welle vor Kanagawa",
    },
  ];

  try {
    const results = await Promise.all(
      languages.map(async (lang) => {
        const query = `${lang.translation} ${userQuery}`.trim();
        const url = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(
          query
        )}&cx=${cx}&searchType=image&key=${apiKey}&num=1`;

        try {
          const response = await axios.get(url);
          const items = response.data.items;

          if (items && items.length > 0) {
            return {
              language: lang.label,
              languageCode: lang.code,
              query: query,
              image: {
                link: items[0].link,
                title: items[0].title,
                thumbnail: items[0].image?.thumbnailLink || null,
              },
            };
          } else {
            return {
              language: lang.label,
              languageCode: lang.code,
              query: query,
              image: null,
            };
          }
        } catch (error) {
          console.error(
            `Error fetching images for ${lang.label}:`,
            error.message
          );
          return {
            language: lang.label,
            languageCode: lang.code,
            query: query,
            image: null,
          };
        }
      })
    );

    res.json(results);
  } catch (error) {
    console.error("Multilang API error:", error.message);
    res.status(500).json({ error: "Failed to fetch multilingual images" });
  }
});

console.log("GOOGLE_API_KEY:", process.env.GOOGLE_API_KEY);
console.log("GOOGLE_CX:", process.env.GOOGLE_CX);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
