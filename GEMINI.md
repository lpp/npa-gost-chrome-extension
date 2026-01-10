## Project Overview

This project is a Google Chrome extension designed to generate GOST-compliant citations for legal documents found on the `consultant.ru` website. It provides a simple user interface within the browser to create and copy these citations.

The extension is built with standard web technologies:
*   **JavaScript (`popup.js`):** Contains the core logic for fetching document information, parsing it, and formatting the citation.
*   **HTML (`popup.html`):** Defines the structure of the extension's popup window.
*   **CSS (`popup.css`):** Provides styling for the popup.
*   **`manifest.json`:** The standard manifest file that defines the extension's properties, permissions, and behavior for the Chrome browser.

## Running the Extension

This extension does not have a formal build process. To run it in your browser for development or use, follow these steps:

1.  Clone or download this repository to your local machine.
2.  Open Google Chrome and navigate to the extensions page: `chrome://extensions`.
3.  Enable "Developer mode" using the toggle switch, usually found in the top-right corner.
4.  Click the "Load unpacked" button.
5.  Select the directory where you saved the project files.

The extension's icon will appear in your browser's toolbar, and it will be ready to use.

## Development Conventions

*   The extension's logic is primarily contained within `popup.js`.
*   It interacts with the active `consultant.ru` tab to get document details.
*   The script fetches data from a `consultant.ru` CGI endpoint, parses the HTML response to find the document title and publication source, and then formats it according to GOST standards.
*   The formatting logic in `formatGostLink` supports several publication sources via regex matching:
    *   "Собрание законодательства РФ"
    *   "Вестник Банка России"
    *   "Учет, налоги, право" (from "Официальные документы")
*   The extension now automatically triggers the "Создать ссылку по ГОСТ" button click when the popup is opened, generating the citation immediately.
*   If the publication source is not found or cannot be formatted, a fallback citation is generated using the document's URL and an access date.
*   There are no external libraries or dependencies. The code uses standard browser APIs like `fetch`, `DOMParser`, and `navigator.clipboard`.
*   The `README.md` suggests the project was largely generated using an AI tool (Gemini CLI), which may explain the self-contained and direct nature of the code.
