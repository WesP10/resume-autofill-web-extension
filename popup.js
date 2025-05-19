document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const status = document.getElementById('status');
    const saveButton = document.getElementById('saveButton');

    // Minimal user object
    let user = {
        name: '',
        uid: generateUID(),
        isInDB: false
    };

    // Load saved user data when popup opens
    chrome.storage.local.get(['userData'], function(result) {
        if (result.userData) {
            user = result.userData;
            document.getElementById('fullName').value = user.name || '';
        }
    });

    // Generate a unique ID for the user
    function generateUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // Handle file input click
    uploadButton.addEventListener('click', () => {
        fileInput.click();
    });

    // Handle drag and drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = '#f0f8ff';
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = 'white';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = 'white';
        const files = e.dataTransfer.files;
        handleFiles(files);
    });

    // Handle file input change
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Handle file upload
    function handleFiles(files) {
        const file = files[0];
        if (file) {
            // Check file type and upload to node server if valid
            const validDocumentTypes = [
                'application/pdf',  // PDF
                'application/msword',  // DOC
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',  // DOCX
                'text/plain'  // TXT
            ];
            if (!validDocumentTypes.includes(file.type)) {
                showStatus('Please upload a PDF, DOC, DOCX, or TXT file', 'error');
                return;
            }
            showStatus('Resume uploaded successfully!', 'success');
        }
    }

    // Handle save button click
    saveButton.addEventListener('click', () => {
        user.name = document.getElementById('fullName').value;

        if (!user.name && !user.isInDB) {
            showStatus('Please enter your name and upload your resume', 'error');
            return;
        }
        if (!user.name) {
            showStatus('Please enter your name', 'error');
            return;
        }
        if (!user.isInDB) {
            showStatus('Please upload your resume', 'error');
            return;
        }

        saveUserData();
        showStatus('Information saved successfully!', 'success');
    });

    // Save user data to chrome storage
    function saveUserData() {
        chrome.storage.local.set({ userData: user }, function() {
            console.log('User data saved');
        });
    }

    // Show status message
    function showStatus(message, type) {
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }
}); 