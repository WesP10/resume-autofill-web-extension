// Background script for Job Application Assistant

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startFormFill') {
        // Get the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0]) {
                // First check if we can inject the content script
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    files: ['content.js']
                }).then(() => {
                    // After injection, send the message
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'startFormFill' })
                        .catch(error => {
                            console.error('Error sending message to content script:', error);
                        });
                }).catch(error => {
                    console.error('Error injecting content script:', error);
                });
            }
        });
    }
}); 