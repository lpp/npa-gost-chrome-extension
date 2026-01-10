document.addEventListener('DOMContentLoaded', function () {
  const generateBtn = document.getElementById('generate');
  const resultText = document.getElementById('result');
  const openConsultantBtn = document.getElementById('openConsultant');

  openConsultantBtn.addEventListener('click', function() {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.update(tabs[0].id, { url: 'https://www.consultant.ru/cons/cgi/online.cgi' });
    });
  });

  generateBtn.addEventListener('click', function () {
    resultText.value = 'Generating...';
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      const url = tabs[0].url;
      if (!url || !url.includes('consultant.ru')) {
        resultText.value = 'Error: Please navigate to a consultant.ru document page.';
        return;
      }

      generateGostCitation(url)
        .then(citation => {
          resultText.value = citation;
          // Copy the citation to the clipboard
          navigator.clipboard.writeText(citation).then(() => {
            const originalButtonText = generateBtn.textContent;
            generateBtn.textContent = 'Ссылка скопирована в буфер обмена!';
            setTimeout(() => {
              generateBtn.textContent = originalButtonText;
            }, 2000); // Revert after 2 seconds
          }).catch(err => {
            console.error('Failed to copy text: ', err);
          });
        })
        .catch(error => {
          resultText.value = `Error: ${error.message}`;
        });
    });
  });

  async function generateGostCitation(consultantUrl) {
    const parsedUrl = new URL(consultantUrl);
    const params = new URLSearchParams(parsedUrl.search);
    const n = params.get('n');
    const base = params.get('base');

    if (!n || !base) {
      throw new Error('Could not extract document number (n) or base from the URL.');
    }

    const cgiUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;
    const infoUrl = new URL(cgiUrl);
    infoUrl.searchParams.set('req', 'doc');
    infoUrl.searchParams.set('base', base);
    infoUrl.searchParams.set('n', n);
    infoUrl.searchParams.set('content', 'text');
    infoUrl.searchParams.set('dst', params.get('dst') || '1000000001');

    const consultantData = await fetchConsultantData(infoUrl.href);

    if (consultantData.error) {
        throw new Error(consultantData.error);
    }

    const esseContentHtml = consultantData.esse?.content;

    if (esseContentHtml) {
        const { documentTitle, publicationInfo } = extractDocumentInfoFromPopupHtml(esseContentHtml);

        if (documentTitle.includes("not found")) {
            throw new Error(`Failed to extract title.`);
        }
        
        return formatGostLink(documentTitle, publicationInfo, consultantUrl);
    } else {
        throw new Error("Could not find 'esse.content' HTML in the JSON response.");
    }
  }

  async function fetchConsultantData(url) {
    const headers = {
      'Accept': 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest'
    };
    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  }

  function extractDocumentInfoFromPopupHtml(popupHtml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(popupHtml, 'text/html');

    // --- Generic Publication Info Extraction (Direct translation from Python) ---
    let publicationInfo = "Publication info not found";
    const pubHeaderSpan = Array.from(doc.querySelectorAll('span.b')).find(span => span.textContent.trim() === 'Источник публикации');
    if (pubHeaderSpan) {
        let currentElem = pubHeaderSpan.parentElement; // This is the div.T
        while (currentElem) {
            currentElem = currentElem.nextElementSibling;
            if (!currentElem) break;

            const text = currentElem.textContent.trim();
            if (text.includes("Собрание законодательства РФ") || text.includes("Вестник Банка России") || text.includes("Учет, налоги, право")) {
                publicationInfo = text;
                break;
            }
            // Stop if we hit the next header (identified by another span.b)
            if (currentElem.querySelector('span.b')) {
                break;
            }
        }
    }

    // --- Generic Title Extraction (Direct translation from Python) ---
    let documentTitle = "Title not found";
    const titleHeaderSpan = Array.from(doc.querySelectorAll('span.b')).find(span => span.textContent.trim() === 'Название документа');
    if (titleHeaderSpan) {
        const new_title_parts = [];
        let currentElem = titleHeaderSpan.parentElement; // The div.T
        
        while (currentElem = currentElem.nextElementSibling) {
            // If the element has a class and it's not 'U', we've left the title section.
            if (currentElem.classList.length > 0 && !currentElem.classList.contains('U')) {
                break;
            }
            // The original python code was looking for the next 'T' class, which is equivalent to finding a class that is not 'U'
            // and contains other classes, like "T MPP"
            if (currentElem.classList.contains('T')) {
                break;
            }

            new_title_parts.push(currentElem.textContent.trim());
        }
        
        if (new_title_parts.length > 0) {
            documentTitle = new_title_parts.join(' ').trim();
        }
    }
            
    return { documentTitle, publicationInfo };
  }

  function formatGostLink(title, publicationInfo, consultantUrl) {
    let formattedPublication;

    const pubMatchSzrf = /"(Собрание законодательства РФ)", \d{2}\.\d{2}\.(\d{4}), N ([\d\s\(\)\S]+?), ст\. (\d+)[.,]?/.exec(publicationInfo);
    if (pubMatchSzrf) {
        const [, sourceName, pubYear, pubNumberPart, pubArticle] = pubMatchSzrf;
        formattedPublication = `${sourceName.trim()}. - ${pubYear.trim()}. - № ${pubNumberPart.trim()}. - Ст. ${pubArticle.trim()}.`;
        return `${title} // ${formattedPublication}`;
    }

    const pubMatchUntp = /"Официальные документы", N (\d+), .*(\d{4}) \(еженедельное приложение к газете "(Учет, налоги, право)"\)/.exec(publicationInfo);
    if (pubMatchUntp) {
        const [, pubNumber, pubYear, sourceName] = pubMatchUntp;
        formattedPublication = `${sourceName.trim()}. - ${pubYear.trim()}. - N ${pubNumber.trim()}.`;
        return `${title} // ${formattedPublication}`;
    }

    const pubMatchVbr = /"(Вестник Банка России)",\s*[N№]\s*(\d+),\s*\d{2}\.\d{2}\.(\d{4})/.exec(publicationInfo);
    if (pubMatchVbr) {
        const [, sourceName, pubNumber, pubYear] = pubMatchVbr;
        formattedPublication = `${sourceName.trim()}. - ${pubYear.trim()}. - № ${pubNumber.trim()}.`;
        return `${title} // ${formattedPublication}`;
    }

    const parsedUrl = new URL(consultantUrl);
    const params = new URLSearchParams(parsedUrl.search);
    const n = params.get('n');
    const base = params.get('base');
    const req = params.get('req');
    const shortUrl = `${parsedUrl.origin}${parsedUrl.pathname}?req=${req}&base=${base}&n=${n}`;

    const today = new Date();
    const threeDaysAgo = new Date(today);
    threeDaysAgo.setDate(today.getDate() - 3);

    const day = String(threeDaysAgo.getDate()).padStart(2, '0');
    const month = String(threeDaysAgo.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const year = threeDaysAgo.getFullYear();

    const formattedDate = `${day}.${month}.${year}`;

    return `${title} // СПС КонсультантПлюс. - URL: ${shortUrl} (дата обращения: ${formattedDate})`;
  }
});
