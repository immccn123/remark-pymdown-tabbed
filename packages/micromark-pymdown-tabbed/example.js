import fs from "fs";
import { micromark } from "micromark";
import { pymdownTabbed, pymdownTabbedHtml } from "./dev/index.js";

const doc = fs.readFileSync("example.md");

console.log(
  micromark(doc, {
    extensions: [pymdownTabbed()],
    htmlExtensions: [pymdownTabbedHtml()],
  })
);
