import express from 'express'
import cors from 'cors'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
app.use(cors())
app.use(express.json())

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

// Configure multer to save files in the uploads folder and keep original extensions
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tripId = req.body.tripId || 'general'
    const destFolder = path.join(UPLOADS_DIR, tripId)
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true })
    }
    cb(null, destFolder)
  },
  filename: function (req, file, cb) {
    // Generate a unique file name starting with the timestamp
    const ext = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_\.]/g, '')
    cb(null, `${Date.now()}-${base}${ext}`)
  }
})

const upload = multer({ storage })

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve static files from the uploads directory
app.use('/uploads', express.static(UPLOADS_DIR))

// Upload endpoint
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }
  
  const tripId = req.body.tripId || 'general'
  
  // Use the configured public base URL (set via PUBLIC_URL env var) so stored
  // download URLs are always correct, regardless of reverse-proxy host headers.
  const baseUrl = process.env.PUBLIC_URL
    ? process.env.PUBLIC_URL.replace(/\/$/, '')
    : `${req.protocol}://${req.get('host')}`
  const publicUrl = `${baseUrl}/uploads/${tripId}/${req.file.filename}`
  
  res.json({
    success: true,
    file: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      path: `uploads/${tripId}/${req.file.filename}`,
      url: publicUrl
    }
  })
})

// Delete endpoint
app.post('/delete', (req, res) => {
  const { path: filePath } = req.body
  
  if (!filePath) {
    return res.status(400).json({ error: 'Missing path argument' })
  }
  
  // Prevent path traversal attacks
  const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '')
  const absolutePath = path.join(__dirname, normalizedPath)
  
  // Ensure the user is only deleting files from the uploads directory
  if (!absolutePath.startsWith(UPLOADS_DIR)) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  
  try {
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath)
    }
    res.json({ success: true, message: 'File deleted' })
  } catch (error) {
    console.error('Error deleting file:', error)
    res.status(500).json({ error: 'Failed to delete file' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`Hostinger Storage API running on http://localhost:${PORT}`)
})
