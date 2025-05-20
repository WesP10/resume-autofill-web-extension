// Background script for Job Application Assistant

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startFormFill') {
        // Get the active tab
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0]) {
                // Send message to content script
                chrome.tabs.sendMessage(tabs[0].id, { action: 'startFormFill' });
            }
        });
    }
}); 