document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const status = document.getElementById('status');
    const saveButton = document.getElementById('saveButton');
    const resumeStatus = document.getElementById('resumeStatus');

    // Minimal user object
    let user = {
        name: '',
        uid: generateUID(),
        isInDB: false
    };

    // Update resume status indicator
    function updateResumeStatus() {
        if (user.isInDB) {
            resumeStatus.className = 'resume-status uploaded';
            resumeStatus.querySelector('.status-icon').textContent = 'check_circle';
            resumeStatus.querySelector('.status-text').textContent = 'Resume uploaded';
        } else {
            resumeStatus.className = 'resume-status not-uploaded';
            resumeStatus.querySelector('.status-icon').textContent = 'radio_button_unchecked';
            resumeStatus.querySelector('.status-text').textContent = 'No resume uploaded';
        }
    }

    // Load saved user data when popup opens
    chrome.storage.local.get(['userData'], function(result) {
        if (result.userData) {
            user = result.userData;
            document.getElementById('fullName').value = user.name || '';
            updateResumeStatus();
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
    async function handleFiles(files) {
        const file = files[0];
        if (file) {
            // Check file type
            const allowedTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain'
            ];

            if (!allowedTypes.includes(file.type)) {
                showStatus('Invalid file type. Please upload PDF, DOC, DOCX, or TXT files only.', 'error');
                return;
            }

            // Check file size (5MB limit)
            if (file.size > 5 * 1024 * 1024) {
                showStatus('File size too large. Maximum size is 5MB.', 'error');
                return;
            }

            try {
                const formData = new FormData();
                formData.append('resume', file);
                formData.append('uid', user.uid);

                showStatus('Uploading resume...', 'info');

                const response = await fetch('http://localhost:3000/upload-resume', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                user.isInDB = true;
                saveUserData();
                updateResumeStatus();
                showStatus('Resume uploaded successfully!', 'success');
            } catch (error) {
                console.error('Upload error:', error);
                if (error.message === 'Failed to fetch') {
                    showStatus('Cannot connect to server. Please make sure the server is running on port 3000.', 'error');
                } else {
                    showStatus(error.message || 'Error uploading resume. Please try again.', 'error');
                }
            }
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