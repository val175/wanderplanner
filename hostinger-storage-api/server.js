import express from 'express'
import cors from 'cors'
import multer from 'multer'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { jwtVerify, createRemoteJWKSet } from 'jose'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Firebase ID token verification (same pattern as api/_auth.js) ──
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'wanderplanner-dbee7'
const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
)

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  try {
    const { payload } = await jwtVerify(authHeader.slice(7), JWKS, {
      issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
      audience: FIREBASE_PROJECT_ID,
    })
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

// Trip ids are generated client-side as [a-z0-9] strings; strip anything else
// so they can never traverse out of the uploads directory.
function sanitizeTripId(tripId) {
  return String(tripId || 'general').replace(/[^a-zA-Z0-9-_]/g, '') || 'general'
}

const ALLOWED_ORIGINS = [
  'https://planner.vlbonite.co',
  ...(process.env.EXTRA_ORIGINS ? process.env.EXTRA_ORIGINS.split(',') : []),
]

const app = express()
app.use(cors({
  origin(origin, cb) {
    // Allow non-browser requests (no Origin) and localhost for development
    if (!origin || ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) {
      return cb(null, true)
    }
    cb(new Error('Not allowed by CORS'))
  },
}))
app.use(express.json())

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

// Configure multer to save files in the uploads folder and keep original extensions
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const tripId = sanitizeTripId(req.body.tripId)
    const destFolder = path.join(UPLOADS_DIR, tripId)
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true })
    }
    cb(null, destFolder)
  },
  filename: function (req, file, cb) {
    // Generate a unique file name starting with the timestamp
    const ext = path.extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '')
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9-_\.]/g, '')
    cb(null, `${Date.now()}-${base}${ext}`)
  }
})

const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } })

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve static files from the uploads directory.
// Download URLs act as capability URLs (unguessable tripId path segment);
// never serve uploads with HTML content types to avoid stored-XSS on this host.
app.use('/uploads', express.static(UPLOADS_DIR, {
  setHeaders(res, filePath) {
    if (/\.(html?|xhtml|svg|xml)$/i.test(filePath)) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    }
    res.setHeader('X-Content-Type-Options', 'nosniff')
  },
}))

// Upload endpoint
app.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  const tripId = sanitizeTripId(req.body.tripId)

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
app.post('/delete', requireAuth, (req, res) => {
  const { path: filePath } = req.body

  if (!filePath || typeof filePath !== 'string') {
    return res.status(400).json({ error: 'Missing path argument' })
  }

  const absolutePath = path.resolve(__dirname, filePath)

  // Ensure the user is only deleting files from the uploads directory
  if (!absolutePath.startsWith(UPLOADS_DIR + path.sep)) {
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
