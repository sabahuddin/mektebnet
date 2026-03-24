import AdmZip from "adm-zip";
import path from "path";

const ZIP_PATH = path.join(path.dirname(new URL(import.meta.url).pathname), "../../attached_assets/edu_1774348311515.zip");
const zip = new AdmZip(ZIP_PATH);
const entries = zip.getEntries();

const kvizEntries = entries.filter(e => e.entryName.includes("kvizovi") && e.entryName.endsWith(".html"));
console.log("Total kviz files:", kvizEntries.length);
console.log("First few:", kvizEntries.slice(0, 5).map(e => e.entryName));

const first = kvizEntries.find(e => !e.entryName.includes("index"));
if (first) {
  const html = first.getData().toString("utf8");
  console.log("\nFile:", first.entryName);
  console.log("Size:", html.length);

  const allQIdx = html.indexOf("allQuestions");
  if (allQIdx >= 0) {
    console.log("Found allQuestions at:", allQIdx);
    console.log("Context:\n", html.substring(allQIdx, allQIdx + 1000));
  } else {
    console.log("allQuestions NOT found");
    // Check for alternative patterns
    ["question", "Answer", "options", "var quiz", "const quiz", "questions ="].forEach(p => {
      const i = html.indexOf(p);
      if (i >= 0) console.log(`Found "${p}" at ${i}:`, html.substring(i, i + 200));
    });
  }
}
