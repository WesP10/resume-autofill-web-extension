document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const status = document.getElementById('status');
    const saveButton = document.getElementById('saveButton');
    const resumeStatus = document.getElementById('resumeStatus');
    const initialState = document.getElementById('initialState');
    const loadedState = document.getElementById('loadedState');
    const displayName = document.getElementById('displayName');
    const editButton = document.getElementById('editButton');
    const editState = document.getElementById('editState');
    const exitEditButton = document.getElementById('exitEditButton');
    const editForm = document.getElementById('editForm');

    // Minimal user object
    let user = {
        name: '',
        uid: generateUID(),
        isInDB: false
    };

    // Update UI state
    function updateUIState() {
        if (user.name && user.isInDB) {
            initialState.classList.add('hidden');
            loadedState.classList.remove('hidden');
            editState.classList.add('hidden');
            displayName.textContent = user.name;
        } else {
            initialState.classList.remove('hidden');
            loadedState.classList.add('hidden');
            editState.classList.add('hidden');
        }
    }

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
            updateUIState();
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
                formData.append('force', 'true');

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

                // Save initial user data to MongoDB
                const initialUserData = {
                    personal_information: {
                        full_name: user.name || '',
                        contact_details: {
                            email: '',
                            phone_number: '',
                            address: ''
                        },
                        linkedin_profile: '',
                        portfolio_website: ''
                    },
                    resume: {
                        objective: '',
                        education: [],
                        experience: [],
                        skills: [],
                        certifications: [],
                        projects: [],
                        languages: [],
                        hobbies: []
                    },
                    cover_letter: {
                        recipient_name: '',
                        company_name: '',
                        subject: '',
                        body: ''
                    },
                    references: []
                };

                const userDataResponse = await fetch('http://localhost:3000/save-user-data', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        uid: user.uid,
                        userData: initialUserData
                    })
                });

                if (!userDataResponse.ok) {
                    console.error('Error saving initial user data');
                }

                // Update local user object with the initial data
                user = { ...user, ...initialUserData };
                saveUserData();
                updateResumeStatus();
                updateUIState();
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

    // Show edit form
    function showEditForm() {
        console.log('Showing edit form, current user data:', user);
        initialState.classList.add('hidden');
        loadedState.classList.add('hidden');
        editState.classList.remove('hidden');
        populateEditForm();
    }

    // Populate edit form with user data
    function populateEditForm() {
        console.log('Populating edit form with user data:', user);
        
        // Personal Information
        const personalInfo = user.personal_information || {};
        const contactDetails = personalInfo.contact_details || {};
        
        document.getElementById('fullName').value = personalInfo.full_name || '';
        document.getElementById('email').value = contactDetails.email || '';
        document.getElementById('phone').value = contactDetails.phone_number || '';
        document.getElementById('address').value = contactDetails.address || '';
        document.getElementById('linkedin').value = personalInfo.linkedin_profile || '';
        document.getElementById('portfolio').value = personalInfo.portfolio_website || '';

        // Resume Information
        const resumeInfo = user.resume || {};
        document.getElementById('objective').value = resumeInfo.objective || '';
        document.getElementById('skills').value = Array.isArray(resumeInfo.skills) ? resumeInfo.skills.join(', ') : '';
        document.getElementById('hobbies').value = Array.isArray(resumeInfo.hobbies) ? resumeInfo.hobbies.join(', ') : '';

        // Cover Letter
        const coverLetter = user.cover_letter || {};
        document.getElementById('recipientName').value = coverLetter.recipient_name || '';
        document.getElementById('companyName').value = coverLetter.company_name || '';
        document.getElementById('subject').value = coverLetter.subject || '';
        document.getElementById('coverLetterBody').value = coverLetter.body || '';

        // Populate lists with proper error handling
        try {
            populateList('educationList', resumeInfo.education || [], createEducationItem);
            populateList('experienceList', resumeInfo.experience || [], createExperienceItem);
            populateList('certificationsList', resumeInfo.certifications || [], createCertificationItem);
            populateList('projectsList', resumeInfo.projects || [], createProjectItem);
            populateList('languagesList', resumeInfo.languages || [], createLanguageItem);
            populateList('referencesList', user.references || [], createReferenceItem);
        } catch (error) {
            console.error('Error populating lists:', error);
        }
    }

    // Create list item templates
    function createEducationItem(education) {
        return `
            <div class="list-item">
                <button type="button" class="remove-button">
                    <span class="material-icons">close</span>
                </button>
                <div class="form-group">
                    <label>Degree</label>
                    <input type="text" name="education[degree]" value="${education?.degree || ''}">
                </div>
                <div class="form-group">
                    <label>Institution</label>
                    <input type="text" name="education[institution]" value="${education?.institution || ''}">
                </div>
                <div class="form-group">
                    <label>Graduation Year</label>
                    <input type="number" name="education[graduation_year]" value="${education?.graduation_year || ''}">
                </div>
            </div>
        `;
    }

    function createExperienceItem(experience) {
        return `
            <div class="list-item">
                <button type="button" class="remove-button">
                    <span class="material-icons">close</span>
                </button>
                <div class="form-group">
                    <label>Job Title</label>
                    <input type="text" name="experience[job_title]" value="${experience?.job_title || ''}">
                </div>
                <div class="form-group">
                    <label>Company</label>
                    <input type="text" name="experience[company]" value="${experience?.company || ''}">
                </div>
                <div class="form-group">
                    <label>Duration</label>
                    <input type="text" name="experience[duration]" value="${experience?.duration || ''}">
                </div>
                <div class="form-group">
                    <label>Responsibilities</label>
                    <textarea name="experience[responsibilities]" rows="3">${Array.isArray(experience?.responsibilities) ? experience.responsibilities.join('\n') : ''}</textarea>
                </div>
            </div>
        `;
    }

    function createCertificationItem(certification) {
        return `
            <div class="list-item">
                <button type="button" class="remove-button">
                    <span class="material-icons">close</span>
                </button>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="certifications[name]" value="${certification?.name || ''}">
                </div>
                <div class="form-group">
                    <label>Year</label>
                    <input type="number" name="certifications[year]" value="${certification?.year || ''}">
                </div>
            </div>
        `;
    }

    function createProjectItem(project) {
        return `
            <div class="list-item">
                <button type="button" class="remove-button">
                    <span class="material-icons">close</span>
                </button>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="projects[name]" value="${project?.name || ''}">
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea name="projects[description]" rows="2">${project?.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Technologies</label>
                    <input type="text" name="projects[technologies]" value="${Array.isArray(project?.technologies) ? project.technologies.join(', ') : ''}">
                </div>
            </div>
        `;
    }

    function createLanguageItem(language) {
        return `
            <div class="list-item">
                <button type="button" class="remove-button">
                    <span class="material-icons">close</span>
                </button>
                <div class="form-group">
                    <label>Language</label>
                    <input type="text" name="languages[language]" value="${language?.language || ''}">
                </div>
                <div class="form-group">
                    <label>Proficiency</label>
                    <input type="text" name="languages[proficiency]" value="${language?.proficiency || ''}">
                </div>
            </div>
        `;
    }

    function createReferenceItem(reference) {
        return `
            <div class="list-item">
                <button type="button" class="remove-button">
                    <span class="material-icons">close</span>
                </button>
                <div class="form-group">
                    <label>Name</label>
                    <input type="text" name="references[name]" value="${reference?.name || ''}">
                </div>
                <div class="form-group">
                    <label>Relationship</label>
                    <input type="text" name="references[relationship]" value="${reference?.relationship || ''}">
                </div>
                <div class="form-group">
                    <label>Contact</label>
                    <input type="text" name="references[contact]" value="${reference?.contact || ''}">
                </div>
            </div>
        `;
    }

    // Populate list with items
    function populateList(listId, items, createItemFn) {
        const list = document.getElementById(listId);
        list.innerHTML = items.map(item => createItemFn(item)).join('');
    }

    // Handle edit button click
    editButton.addEventListener('click', async () => {
        console.log('Edit button clicked, current user data:', user);
        // Reload user data before showing edit form
        await loadUserData();
        showEditForm();
    });

    // Handle exit edit button click
    exitEditButton.addEventListener('click', () => {
        editState.classList.add('hidden');
        loadedState.classList.remove('hidden');
    });

    // Handle add buttons
    document.querySelectorAll('.add-button').forEach(button => {
        button.addEventListener('click', () => {
            const section = button.dataset.section;
            const list = document.getElementById(`${section}List`);
            const createFn = {
                education: createEducationItem,
                experience: createExperienceItem,
                certifications: createCertificationItem,
                projects: createProjectItem,
                languages: createLanguageItem,
                references: createReferenceItem
            }[section];

            if (createFn) {
                list.insertAdjacentHTML('beforeend', createFn({}));
            }
        });
    });

    // Handle remove buttons
    document.addEventListener('click', (e) => {
        if (e.target.closest('.remove-button')) {
            e.target.closest('.list-item').remove();
        }
    });

    // Handle form submission
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Collect form data
        const formData = new FormData(editForm);
        const userData = {
            personal_information: {
                full_name: formData.get('fullName'),
                contact_details: {
                    email: formData.get('email'),
                    phone_number: formData.get('phone'),
                    address: formData.get('address')
                },
                linkedin_profile: formData.get('linkedin'),
                portfolio_website: formData.get('portfolio')
            },
            resume: {
                objective: formData.get('objective'),
                education: collectListItems('education'),
                experience: collectListItems('experience'),
                skills: formData.get('skills').split(',').map(s => s.trim()).filter(Boolean),
                certifications: collectListItems('certifications'),
                projects: collectListItems('projects'),
                languages: collectListItems('languages'),
                hobbies: formData.get('hobbies').split(',').map(s => s.trim()).filter(Boolean)
            },
            cover_letter: {
                recipient_name: formData.get('recipientName'),
                company_name: formData.get('companyName'),
                subject: formData.get('subject'),
                body: formData.get('coverLetterBody')
            },
            references: collectListItems('references')
        };

        try {
            // Update user data in MongoDB
            const response = await fetch('http://localhost:3000/save-user-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uid: user.uid,
                    userData: userData
                })
            });

            if (!response.ok) {
                throw new Error('Failed to save user data');
            }

            // Update local user object
            user = { ...user, ...userData };
            saveUserData();
            updateUIState();
            showStatus('Information saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving user data:', error);
            showStatus('Error saving information. Please try again.', 'error');
        }
    });

    // Helper function to collect list items
    function collectListItems(section) {
        const items = [];
        const list = document.getElementById(`${section}List`);
        list.querySelectorAll('.list-item').forEach(item => {
            const data = {};
            item.querySelectorAll('input, textarea').forEach(input => {
                const name = input.name.match(/\[(.*?)\]/)?.[1];
                if (name) {
                    if (input.type === 'number') {
                        data[name] = parseInt(input.value) || null;
                    } else if (input.name.includes('technologies')) {
                        data[name] = input.value.split(',').map(s => s.trim()).filter(Boolean);
                    } else if (input.name.includes('responsibilities')) {
                        data[name] = input.value.split('\n').filter(Boolean);
                    } else {
                        data[name] = input.value;
                    }
                }
            });
            if (Object.keys(data).length > 0) {
                items.push(data);
            }
        });
        return items;
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
        updateUIState();
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

    // Add function to load user data from MongoDB when popup opens
    async function loadUserData() {
        try {
            console.log('Loading user data for UID:', user.uid);
            const response = await fetch(`http://localhost:3000/user-data/${user.uid}`);
            if (response.ok) {
                const userData = await response.json();
                console.log('Received user data from server:', userData);
                // Preserve the uid and isInDB status while updating with new data
                user = { 
                    ...user,
                    ...userData,
                    uid: user.uid,
                    isInDB: true
                };
                console.log('Updated user object:', user);
                document.getElementById('fullName').value = user.personal_information?.full_name || '';
                updateResumeStatus();
                updateUIState();
                saveUserData(); // Save the updated user data to chrome storage
            } else {
                console.error('Failed to load user data:', response.status);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    // Call loadUserData when popup opens
    chrome.storage.local.get(['userData'], function(result) {
        if (result.userData) {
            console.log('Found user data in storage:', result.userData);
            user = result.userData;
            loadUserData(); // Load data from MongoDB
        } else {
            console.log('No user data found in storage');
        }
    });
}); 