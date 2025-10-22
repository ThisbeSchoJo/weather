import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// NWS API base URL
const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

// Helper function for making NWS API requests
async function makeNWSRequest(url) {
  const headers = {
    "User-Agent": USER_AGENT,
    Accept: "application/geo+json",
  };

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching data from NWS API:", error);
    throw error;
  }
}

// Format alert data
function formatAlert(feature) {
  const props = feature.properties;
  return [
    `Event: ${props.event || "Unknown"}`,
    `Area: ${props.areaDesc || "Unknown"}`,
    `Severity: ${props.severity || "Unknown"}`,
    `Status: ${props.status || "Unknown"}`,
    `Headline: ${props.headline || "No headline"}`,
    "---",
  ].join("\n");
}

// Create HTTP server
const server = createServer(async (req, res) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    // API Routes
    if (pathname === "/api/forecast" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const { latitude, longitude } = JSON.parse(body);

          if (typeof latitude !== "number" || typeof longitude !== "number") {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid latitude or longitude" }));
            return;
          }

          // Get grid point data
          const pointsUrl = `${NWS_API_BASE}/points/${latitude.toFixed(
            4
          )},${longitude.toFixed(4)}`;
          const pointsData = await makeNWSRequest(pointsUrl);

          if (!pointsData?.properties?.forecast) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: `Location ${latitude}, ${longitude} is not supported by the NWS API (US locations only)`,
              })
            );
            return;
          }

          // Get forecast data
          const forecastData = await makeNWSRequest(
            pointsData.properties.forecast
          );
          const periods = forecastData.properties?.periods || [];

          if (periods.length === 0) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "No forecast periods available" }));
            return;
          }

          // Format forecast periods
          const formattedForecast = periods.map((period) =>
            [
              `${period.name || "Unknown"}:`,
              `Temperature: ${period.temperature || "Unknown"}°${
                period.temperatureUnit || "F"
              }`,
              `Wind: ${period.windSpeed || "Unknown"} ${
                period.windDirection || ""
              }`,
              `${period.shortForecast || "No forecast available"}`,
              "---",
            ].join("\n")
          );

          const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join(
            "\n"
          )}`;

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ forecast: forecastText }));
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    if (pathname === "/api/alerts" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const { state } = JSON.parse(body);

          if (!state || typeof state !== "string" || state.length !== 2) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid state code" }));
            return;
          }

          const stateCode = state.toUpperCase();
          const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
          const alertsData = await makeNWSRequest(alertsUrl);

          const features = alertsData.features || [];
          if (features.length === 0) {
            const alertsText = `No active alerts for ${stateCode}`;
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ alerts: alertsText }));
            return;
          }

          const formattedAlerts = features.map(formatAlert);
          const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join(
            "\n"
          )}`;

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ alerts: alertsText }));
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error.message }));
        }
      });
      return;
    }

    // Serve static files
    let filePath = join(
      __dirname,
      "public",
      pathname === "/" ? "index.html" : pathname
    );

    // Security check - prevent directory traversal
    if (!filePath.startsWith(join(__dirname, "public"))) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    const ext = extname(filePath);
    const contentTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "application/javascript",
      ".json": "application/json",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".gif": "image/gif",
      ".svg": "image/svg+xml",
    };

    const contentType = contentTypes[ext] || "text/plain";
    const content = readFileSync(filePath);

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch (error) {
    console.error("Server error:", error);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Weather app server running at http://localhost:${PORT}`);
  console.log(
    "Open your browser and navigate to the URL above to use the weather app!"
  );
});
