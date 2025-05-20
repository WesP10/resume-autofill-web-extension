// Content script for job application form filling
let userData = null;
let isProcessing = false;

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startFormFill') {
        handleFormFill();
    }
});

// Function to get user data from storage
async function getUserData() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['userData'], function(result) {
            resolve(result.userData);
        });
    });
}

// Function to get DOM structure
function getDOMStructure() {
    const formElements = document.querySelectorAll('form, input, select, textarea');
    const domStructure = Array.from(formElements).map(element => {
        return {
            tag: element.tagName.toLowerCase(),
            type: element.type || '',
            id: element.id || '',
            name: element.name || '',
            label: getElementLabel(element),
            placeholder: element.placeholder || '',
            required: element.required || false,
            options: element.tagName.toLowerCase() === 'select' ? 
                Array.from(element.options).map(opt => opt.text) : []
        };
    });
    return domStructure;
}

// Helper function to get element label
function getElementLabel(element) {
    // Try to find label by id
    if (element.id) {
        const label = document.querySelector(`label[for="${element.id}"]`);
        if (label) return label.textContent.trim();
    }
    
    // Try to find parent label
    const parentLabel = element.closest('label');
    if (parentLabel) return parentLabel.textContent.trim();
    
    // Try to find nearby text
    const parent = element.parentElement;
    if (parent) {
        const textNodes = Array.from(parent.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent.trim())
            .filter(text => text);
        if (textNodes.length > 0) return textNodes[0];
    }
    
    return '';
}

// Function to call LLM API
async function callLLM(domStructure, userData) {
    try {
        const response = await fetch('http://localhost:3000/analyze-form', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                domStructure,
                userData
            })
        });

        if (!response.ok) {
            throw new Error('Failed to analyze form');
        }

        return await response.json();
    } catch (error) {
        console.error('Error calling LLM:', error);
        return null;
    }
}

// Function to fill form fields
function fillFormFields(fillInstructions) {
    fillInstructions.forEach(instruction => {
        const element = findElement(instruction.selector);
        if (element) {
            element.value = instruction.value;
            // Trigger change event
            element.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

// Helper function to find element
function findElement(selector) {
    // Try different selector strategies
    const strategies = [
        () => document.getElementById(selector),
        () => document.querySelector(`[name="${selector}"]`),
        () => document.querySelector(`[placeholder="${selector}"]`),
        () => document.querySelector(`label:contains("${selector}") + input`),
        () => document.querySelector(`label:contains("${selector}") + select`),
        () => document.querySelector(`label:contains("${selector}") + textarea`)
    ];

    for (const strategy of strategies) {
        const element = strategy();
        if (element) return element;
    }

    return null;
}

// Main function to handle form filling
async function handleFormFill() {
    if (isProcessing) return;
    isProcessing = true;

    try {
        // Get user data
        userData = await getUserData();
        if (!userData) {
            console.error('No user data found');
            return;
        }

        // Get DOM structure
        const domStructure = getDOMStructure();
        console.log('DOM Structure:', domStructure);

        // Call LLM to analyze form and get fill instructions
        const fillInstructions = await callLLM(domStructure, userData);
        if (!fillInstructions) {
            console.error('Failed to get fill instructions');
            return;
        }

        // Fill the form
        fillFormFields(fillInstructions);

        // Notify user
        showNotification('Form filled successfully!');
    } catch (error) {
        console.error('Error filling form:', error);
        showNotification('Error filling form. Please try again.', 'error');
    } finally {
        isProcessing = false;
    }
}

// Function to show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `job-application-assistant-notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        border-radius: 4px;
        background-color: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        z-index: 10000;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Add styles for notifications
const style = document.createElement('style');
style.textContent = `
    .job-application-assistant-notification {
        font-family: Arial, sans-serif;
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
    }
    @keyframes slideIn {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
    }
`;
document.head.appendChild(style); 