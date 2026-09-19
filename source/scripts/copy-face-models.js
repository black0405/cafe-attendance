// Copies the three face-api model files the kiosk needs into public/models.
// Runs on npm postinstall so dev and the installer build both have them.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "@vladmandic", "face-api", "model");
const dst = path.join(__dirname, "..", "public", "models");
const wanted = ["tiny_face_detector_model", "face_landmark_68_tiny_model", "face_recognition_model"];

fs.mkdirSync(dst, { recursive: true });
for (const f of fs.readdirSync(src)) {
  if (wanted.some((w) => f.startsWith(w))) fs.copyFileSync(path.join(src, f), path.join(dst, f));
}
console.log("face models copied to public/models");
