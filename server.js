import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ACTIVE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.7-flash'
];

const TARGET_COUNTRIES = {
  "Brazil": { gl: "br", hl: "pt-BR", lang: "Portuguese" },
  "Indonesia": { gl: "id", hl: "id", lang: "Indonesian" },
  "Germany": { gl: "de", hl: "de", lang: "German" },
  "Mexico": { gl: "mx", hl: "es-419", lang: "Spanish" },
  "France": { gl: "fr", hl: "fr", lang: "French" },
  "Philippines": { gl: "ph", hl: "tl", lang: "English / Tagalog" },
  "Japan": { gl: "jp", hl: "ja", lang: "Japanese" },
  "Russia": { gl: "ru", hl: "ru", lang: "Russian" },
  "Spain": { gl: "es", hl: "es", lang: "Spanish" },
  "Vietnam": { gl: "vn", hl: "vi", lang: "Vietnamese" }
};

// Check query saturation directly against Google Autocomplete
async function getVerifiedGoogleMetrics(query, gl, hl) {
  const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}&gl=${gl}&hl=${hl}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (res.ok) {
      const data = await res.json();
      const suggestions = data[1] || [];
      const count = suggestions.length;

      if (count >= 10) {
        return { volume: "1M+ / High Demand", difficulty: "High" };
      } else if (count >= 7) {
        return { volume: "100K - 1M", difficulty: "Medium-High" };
      } else if (count >= 4) {
        return { volume: "10K - 100K", difficulty: "Medium" };
      } else if (count > 0) {
        return { volume: "1K - 10K", difficulty: "Low" };
      }
    }
  } catch (err) {}
  return { volume: "< 1K", difficulty: "Low" };
}

app.post('/api/research', async (req, res) => {
  const { niche } = req.body;
  if (!niche || !niche.trim()) {
    return res.status(400).json({ error: 'Niche is required' });
  }

  const prompt = `
Act as an international SEO native linguist.
Target Niche: "${niche}"

For each of these 10 countries:
Brazil, Indonesia, Germany, Mexico, France, Philippines, Japan, Russia, Spain, Vietnam.

Provide EXACTLY 10 native-language search terms people actually type into Google for this niche. Include ultra-high volume verbs and head terms (1M+ search level) down to secondary keywords.

Return strictly raw JSON in this exact structure:
{
  "website_summary": "1-2 sentence overview of the website and tools provided.",
  "countries": {
    "Brazil": ["kw1", "kw2", "kw3", "kw4", "kw5", "kw6", "kw7", "kw8", "kw9", "kw10"],
    "Indonesia": ["kw1", "kw2", "kw3", "kw4", "kw5", "kw6", "kw7", "kw8", "kw9", "kw10"],
    "Germany": ["kw1", "kw2", "kw3", "kw4", "kw5", "kw6", "kw7", "kw8", "kw9", "kw10"],
    "Mexico": ["kw1", "kw2", "kw3", "kw4", "kw5", "kw6", "kw7", "kw8", "kw9", "kw10"],
    "France": ["kw1", "kw2", "kw3", "kw4", "kw5", "kw6", "kw7", "kw8", "kw9", "kw10"],
    "Philippines": ["kw1", "kw2", "kw3", "kw4", "kw5", "kw6", "kw7", "kw8", "kw9", "kw10"],
    "Japan": ["kw1", "kw2", "kw3", "kw4", "kw5", "kw6", "kw7", "kw8", "kw9", "kw10"],
    "Russia": ["kw1", "kw2", "kw3", "kw4", "kw5", "kw6", "kw7", "kw8", "kw9", "kw10"],
    "Spain": ["kw1", "kw2", "kw3", "kw4", "kw5", "kw6", "kw7", "kw8", "kw9", "kw10"],
    "Vietnam": ["kw1", "kw2", "kw3", "kw4", "kw5", "kw6", "kw7", "kw8", "kw9", "kw10"]
  }
}
`;

  let parsedData = null;
  for (const model of ACTIVE_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      if (response && response.text) {
        parsedData = JSON.parse(response.text);
        break;
      }
    } catch (err) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  if (!parsedData || !parsedData.countries) {
    return res.status(503).json({ error: 'Failed to generate keyword data. Please try again.' });
  }

  // Handle both array and object responses from Gemini safely
  const countriesEntries = Array.isArray(parsedData.countries)
    ? parsedData.countries.map(c => [c.country || c.name, c.keywords])
    : Object.entries(parsedData.countries);

  const verifiedCountries = [];

  for (const [countryName, keywords] of countriesEntries) {
    const meta = TARGET_COUNTRIES[countryName] || { gl: 'us', hl: 'en', lang: 'Native' };
    const keywordList = [];
    const safeKeywords = Array.isArray(keywords) ? keywords : [];

    for (const kw of safeKeywords) {
      const kwString = typeof kw === 'string' ? kw : (kw.keyword || String(kw));
      const metrics = await getVerifiedGoogleMetrics(kwString, meta.gl, meta.hl);
      keywordList.push({
        keyword: kwString,
        verified_volume: metrics.volume,
        difficulty: metrics.difficulty
      });
    }

    verifiedCountries.push({
      country: countryName,
      language: meta.lang,
      keywords: keywordList
    });
  }

  res.json({
    website_summary: parsedData.website_summary || niche,
    countries: verifiedCountries
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});