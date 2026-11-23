import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const portArg = process.argv.find((arg) => arg.startsWith("--port="))?.split("=")[1]
  ?? (process.argv.includes("--port") ? process.argv[process.argv.indexOf("--port") + 1] : undefined);

const app = express();
const PORT = Number(portArg) || Number(process.env.PORT) || 3000;

app.use(express.static(__dirname));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`EasyMMC running at http://localhost:${PORT} (0.0.0.0:${PORT})`);
});
