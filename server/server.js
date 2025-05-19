const express = require('express');
const multer = require('multer');
const path = require('path');
require('dotenv').config();
const app = express();
const { MongoClient, ServerApiVersion } = require('mongodb');

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

// Get database and collection
let db;
let Resume;

async function connectToDatabase() {
    try {
        await client.connect();
        db = client.db("resumeDB");
        
        // Create or update the collection with schema validation
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
        
        Resume = db.collection("resumes");
        
        // Create indexes
        await Resume.createIndex({ uid: 1 }, { unique: true });
        
        console.log("Successfully connected to MongoDB Atlas!");
    } catch (error) {
        console.error("Error connecting to MongoDB Atlas:", error);
        process.exit(1);
    }
}

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

// Upload endpoint
app.post('/upload-resume', upload.single('resume'), async (req, res) => {
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
            return res.status(403).json({ error: 'Resume already exists for this user' });
        }

        // Create new resume document
        const resume = {
            uid: req.body.uid,
            resumePath: req.file.path,
            uploadDate: new Date()
        };

        // Save to database
        await Resume.insertOne(resume);

        res.status(200).json({
            message: 'Resume uploaded successfully',
            filePath: req.file.path
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Error uploading resume' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File size too large. Maximum size is 5MB' });
        }
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 