export { pymdownTabbed } from "./lib/syntax.js";
export { pymdownTabbedHtml } from "./lib/html.js";

declare module "micromark-util-types" {
  interface TokenTypeMap {
    pymdownTabbedFlag: "pymdownTabbedFlag";
    pymdownTabbedTitle: "pymdownTabbedTitle";
    pymdownTabbedContent: "pymdownTabbedContent";
    pymdownTabbedIndent: "pymdownTabbedIndent";
    pymdownTabbed: "pymdownTabbed";
  }
}
