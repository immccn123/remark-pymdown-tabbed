/**
 * @typedef {import('micromark-util-types').HtmlExtension} Extension
 */

/**
 * Tabbed to HTML extension
 * 
 * @returns {Extension}
 */
export function pymdownTabbedHtml() {
  return {
    enter: {
      pymdownTabbed() {
        this.tag("<tabbed>");
      },
      pymdownTabbedTitle() {
        this.tag("<tabbed-title>");
        this.buffer();
      }
    },
    exit: {
      pymdownTabbed() {
        this.tag("</tabbed>");
      },
      pymdownTabbedTitle() {
        const data = this.resume();
        this.raw(data);
        this.tag("</tabbed-title>");
      }
    },
  };
}
