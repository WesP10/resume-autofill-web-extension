document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const status = document.getElementById('status');
    const saveButton = document.getElementById('saveButton');

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
            // Here you would typically handle the file upload
            // For now, we'll just show a success message
            showStatus('Resume uploaded successfully!', 'success');
        }
    }

    // Handle save button click
    saveButton.addEventListener('click', () => {
        const fullName = document.getElementById('fullName').value;
        const email = document.getElementById('email').value;
        const phone = document.getElementById('phone').value;
        const location = document.getElementById('location').value;

        if (!fullName || !email || !phone || !location) {
            showStatus('Please fill in all fields', 'error');
            return;
        }

        // Here you would typically save the data
        showStatus('Information saved successfully!', 'success');
    });

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