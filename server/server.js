const express = require('express');
const multer = require('multer');
const path = require('path');
require('dotenv').config();
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs').promises;

// Enable CORS for Chrome extension
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// Define Resume Schema
const resumeSchema = {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["uid", "resumePath", "uploadDate"],
            properties: {
                uid: {
                    bsonType: "string",
                    description: "must be a string and is required"
                },
                resumePath: {
                    bsonType: "string",
                    description: "must be a string and is required"
                },
                uploadDate: {
                    bsonType: "date",
                    description: "must be a date and is required"
                }
            }
        }
    }
};

// Add this after the resumeSchema definition
const userDataSchema = {
    validator: {
        $jsonSchema: {
            bsonType: "object",
            required: ["uid"],
            properties: {
                uid: {
                    bsonType: "string",
                    description: "must be a string and is required"
                },
                personal_information: {
                    bsonType: "object",
                    properties: {
                        full_name: { bsonType: "string" },
                        contact_details: {
                            bsonType: "object",
                            properties: {
                                email: { bsonType: "string" },
                                phone_number: { bsonType: "string" },
                                address: { bsonType: "string" }
                            }
                        },
                        linkedin_profile: { bsonType: "string" },
                        portfolio_website: { bsonType: "string" }
                    }
                },
                resume: {
                    bsonType: "object",
                    properties: {
                        objective: { bsonType: "string" },
                        education: { bsonType: "array" },
                        experience: { bsonType: "array" },
                        skills: { bsonType: "array" },
                        certifications: { bsonType: "array" },
                        projects: { bsonType: "array" },
                        languages: { bsonType: "array" },
                        hobbies: { bsonType: "array" }
                    }
                },
                cover_letter: {
                    bsonType: "object",
                    properties: {
                        recipient_name: { bsonType: "string" },
                        company_name: { bsonType: "string" },
                        subject: { bsonType: "string" },
                        body: { bsonType: "string" }
                    }
                },
                references: { bsonType: "array" }
            }
        }
    }
};

// Get database and collection
let db;
let Resume;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

async function setupCollections() {
    try {
        // Create or update the resumes collection
        try {
            await db.createCollection("resumes", resumeSchema);
            console.log("Created resumes collection with schema validation");
        } catch (error) {
            if (error.code === 48) { // Collection already exists
                await db.command({
                    collMod: "resumes",
                    validator: resumeSchema.validator
                });
                console.log("Updated resumes collection with schema validation");
            } else {
                throw error;
            }
        }
        
        // Create or update the userData collection
        try {
            await db.createCollection("userData", userDataSchema);
            console.log("Created userData collection with schema validation");
        } catch (error) {
            if (error.code === 48) { // Collection already exists
                await db.command({
                    collMod: "userData",
                    validator: userDataSchema.validator
                });
                console.log("Updated userData collection with schema validation");
            } else {
                throw error;
            }
        }
        
        // Set up collections
        Resume = db.collection("resumes");
        UserData = db.collection("userData");
        
        // Create indexes
        await Resume.createIndex({ uid: 1 }, { unique: true });
        await UserData.createIndex({ uid: 1 }, { unique: true });
        console.log("Created unique indexes on uid fields");
        
    } catch (error) {
        console.error("Error setting up collections:", error);
        throw error;
    }
}

async function connectToDatabase() {
    try {
        if (isConnected) return;
        
        await client.connect();
        isConnected = true;
        reconnectAttempts = 0;
        
        db = client.db("resumeDB");
        console.log('Connected to MongoDB Atlas');
        
        // Set up collections and indexes
        await setupCollections();
        
        console.log("Successfully connected to MongoDB Atlas!");
    } catch (error) {
        isConnected = false;
        console.error("Database connection error:", error);
        
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            setTimeout(connectToDatabase, 5000);
        } else {
            console.error('Max reconnection attempts reached. Please check your database connection.');
            process.exit(1);
        }
    }
}

// Monitor connection
client.on('close', () => {
    isConnected = false;
    console.log('Database connection closed');
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        connectToDatabase();
    }
});

// Call the connection function
connectToDatabase();

// Configure multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/') // Make sure this directory exists
    },
    filename: function (req, file, cb) {
        // Create unique filename using uid and original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, req.body.uid + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter function
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'), false);
    }
};

// Configure multer upload
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Middleware to parse JSON
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.post('/test', (req, res) => {
    console.log('POST /test - Received test data');
    console.log('Received data:', req.body);
    res.json({ message: 'Data received successfully', data: req.body });
});

// Upload endpoint
app.post('/upload-resume', upload.single('resume'), async (req, res) => {
    console.log('POST /upload-resume - Resume upload request');
    try {
        if (!req.file) {
            return res.status(401).json({ error: 'No file uploaded' });
        }

        if (!req.body.uid) {
            return res.status(402).json({ error: 'UID is required' });
        }

        // Check if resume already exists for this UID
        const existingResume = await Resume.findOne({ uid: req.body.uid });
        if (existingResume) {
            // If force is not true, return error
            if (req.body.force !== 'true') {
                return res.status(403).json({ error: 'Resume already exists for this user. Use force=true to replace.' });
            }

            // If force is true, delete the old file
            try {
                await fs.unlink(existingResume.resumePath);
                console.log('Deleted old resume file:', existingResume.resumePath);
            } catch (error) {
                console.error('Error deleting old resume file:', error);
                // Continue with upload even if delete fails
            }
        }

        // Create new resume document
        const resume = {
            uid: req.body.uid,
            resumePath: req.file.path,
            uploadDate: new Date()
        };

        // Save to database
        if (existingResume) {
            await Resume.updateOne({ uid: req.body.uid }, { $set: resume });
            console.log('Updated existing resume for user:', req.body.uid);
        } else {
            await Resume.insertOne(resume);
            console.log('Created new resume for user:', req.body.uid);
        }

        res.status(200).json({
            message: 'Resume uploaded successfully',
            filePath: req.file.path,
            replaced: !!existingResume
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Error uploading resume' });
    }
});

// Function to parse resume text into structured JSON
async function parseResumeText(filePath) {
    try {
        const text = await fs.readFile(filePath, 'utf8');
        
        // Initialize empty structure
        const resumeData = {
            personal_information: {
                full_name: "",
                contact_details: {
                    email: "",
                    phone_number: "",
                    address: ""
                },
                linkedin_profile: "",
                portfolio_website: ""
            },
            resume: {
                objective: "",
                education: [],
                experience: [],
                skills: [],
                certifications: [],
                projects: [],
                languages: [],
                hobbies: []
            }
        };

        // Basic parsing logic - you might want to enhance this based on your needs
        const lines = text.split('\n').map(line => line.trim()).filter(line => line);

        // Try to extract name (usually at the top)
        if (lines.length > 0) {
            resumeData.personal_information.full_name = lines[0];
        }

        // Try to extract email
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const emailMatch = text.match(emailRegex);
        if (emailMatch) {
            resumeData.personal_information.contact_details.email = emailMatch[0];
        }

        // Try to extract phone
        const phoneRegex = /(\+\d{1,3}[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/;
        const phoneMatch = text.match(phoneRegex);
        if (phoneMatch) {
            resumeData.personal_information.contact_details.phone_number = phoneMatch[0];
        }

        // Try to extract skills (looking for common skill keywords)
        const skillKeywords = ['JavaScript', 'Python', 'Java', 'C++', 'React', 'Node.js', 'SQL', 'MongoDB', 'AWS', 'Docker'];
        skillKeywords.forEach(skill => {
            if (text.toLowerCase().includes(skill.toLowerCase())) {
                resumeData.resume.skills.push(skill);
            }
        });

        return resumeData;
    } catch (error) {
        console.error('Error parsing resume:', error);
        throw error;
    }
}

// New endpoint to get parsed resume data
app.get('/resume-data/:uid', async (req, res) => {
    console.log('GET /resume-data/:uid - Fetching resume data');
    try {
        const { uid } = req.params;
        
        // Find resume in database
        const resume = await Resume.findOne({ uid });
        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        // Parse the resume text
        const parsedData = await parseResumeText(resume.resumePath);
        
        res.json(parsedData);
    } catch (error) {
        console.error('Error getting resume data:', error);
        res.status(500).json({ error: 'Error processing resume' });
    }
});

// In server.js, add basic input sanitization
function sanitizeInput(input) {
    if (Array.isArray(input)) {
        return input.map(sanitizeInput);
    }
    if (typeof input !== 'object' || input === null) {
        return input;
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(input)) {
        // Skip prototype pollution attempts
        if (key === '__proto__' || key === 'constructor') {
            continue;
        }
        // Recursively sanitize nested objects
        sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
}

// In server.js, add request validation
function validateRequest(req, res, next) {
    const { uid, userData } = req.body;
    
    const errors = [];
    
    if (!uid) {
        errors.push('UID is required');
    } else if (typeof uid !== 'string') {
        errors.push('UID must be a string');
    }
    
    if (!userData) {
        errors.push('User data is required');
    } else if (typeof userData !== 'object') {
        errors.push('User data must be an object');
    }
    
    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }
    
    next();
}

// In server.js, modify the save-user-data endpoint
app.post('/save-user-data', validateRequest, (req, res, next) => {
    console.log('POST /save-user-data - Saving user data');
    req.body.userData = sanitizeInput(req.body.userData);
    // console.log('Received data:', req.body);
    next();
}, async (req, res) => {
    try {
        const { uid, userData } = req.body;
        
        if (!uid || !userData) {
            return res.status(400).json({ error: 'UID and user data are required' });
        }

        // Helper function to ensure array data is properly formatted
        const ensureArray = (data) => Array.isArray(data) ? data.filter(item => item !== null && item !== undefined) : [];

        // Ensure the document structure matches the schema exactly
        const documentToSave = {
            uid: uid,
            personal_information: {
                full_name: userData.personal_information?.full_name || '',
                contact_details: {
                    email: userData.personal_information?.contact_details?.email || '',
                    phone_number: userData.personal_information?.contact_details?.phone_number || '',
                    address: userData.personal_information?.contact_details?.address || ''
                },
                linkedin_profile: userData.personal_information?.linkedin_profile || '',
                portfolio_website: userData.personal_information?.portfolio_website || ''
            },
            resume: {
                objective: userData.resume?.objective || '',
                education: ensureArray(userData.resume?.education),
                experience: ensureArray(userData.resume?.experience),
                skills: ensureArray(userData.resume?.skills),
                certifications: ensureArray(userData.resume?.certifications),
                projects: ensureArray(userData.resume?.projects),
                languages: ensureArray(userData.resume?.languages),
                hobbies: ensureArray(userData.resume?.hobbies)
            },
            cover_letter: {
                recipient_name: userData.cover_letter?.recipient_name || '',
                company_name: userData.cover_letter?.company_name || '',
                subject: userData.cover_letter?.subject || '',
                body: userData.cover_letter?.body || ''
            },
            references: ensureArray(userData.references)
        };

        console.log('Saving document:', JSON.stringify(documentToSave, null, 2));

        // Check if user data already exists
        const existingUser = await UserData.findOne({ uid });
        
        if (existingUser) {
            await UserData.updateOne({ uid }, { $set: documentToSave });
            console.log('Updated existing user data for:', uid);
        } else {
            await UserData.insertOne(documentToSave);
            console.log('Created new user data for:', uid);
        }

        res.status(200).json({ message: 'User data saved successfully' });
    } catch (error) {
        console.error('Error saving user data:', error);
        if (error.code === 121) {
            // MongoDB validation error
            res.status(400).json({ 
                error: 'Invalid data format',
                details: error.errInfo?.details?.schemaRulesNotSatisfied || []
            });
        } else {
            res.status(500).json({ error: 'Error saving user data' });
        }
    }
});

// Get user data
app.get('/user-data/:uid', async (req, res) => {
    console.log('GET /user-data/:uid - Fetching user data');
    try {
        const { uid } = req.params;
        const userData = await UserData.findOne({ uid });
        
        if (!userData) {
            return res.status(404).json({ error: 'User data not found' });
        }

        res.json(userData);
    } catch (error) {
        console.error('Error getting user data:', error);
        res.status(500).json({ error: 'Error retrieving user data' });
    }
});

// In server.js, add comprehensive error handling
function errorHandler(err, req, res, next) {
    console.error('Error:', err);

    // Handle specific error types
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size too large. Maximum size is 5MB' });
        }
        return res.status(400).json({ error: err.message });
    }

    // Handle MongoDB errors
    if (err.name === 'MongoError') {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'Duplicate entry' });
        }
        return res.status(500).json({ error: 'Database error' });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message });
    }

    // Default error
    res.status(500).json({ error: 'Internal server error' });
}

app.use(errorHandler);

// In server.js, add a simple in-memory rate limiter
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

function rateLimiter(req, res, next) {
    const ip = req.ip;
    const now = Date.now();
    
    // Clean up old entries
    for (const [key, value] of requestCounts.entries()) {
        if (now - value.timestamp > RATE_LIMIT_WINDOW) {
            requestCounts.delete(key);
        }
    }
    
    // Check rate limit
    const userRequests = requestCounts.get(ip) || { count: 0, timestamp: now };
    if (userRequests.count >= MAX_REQUESTS) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    
    // Update count
    requestCounts.set(ip, {
        count: userRequests.count + 1,
        timestamp: now
    });
    
    next();
}

// Apply to routes
app.use('/api/', rateLimiter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('=================================');
    console.log(`Server is running at:`);
    console.log(`http://localhost:${PORT}`);
    console.log('Available endpoints:');
    console.log(`- POST http://localhost:${PORT}/upload-resume`);
    console.log(`- POST http://localhost:${PORT}/test`);
    console.log(`- GET http://localhost:${PORT}/resume-data/:uid`);
    console.log(`- POST http://localhost:${PORT}/save-user-data`);
    console.log(`- GET http://localhost:${PORT}/user-data/:uid`);
    console.log('=================================');
}); 