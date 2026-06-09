const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { Resend } = require('resend')
const crypto = require('crypto')
require('dotenv').config()

const libraryRoutes = require('./routes/Library')

const app = express()
const resend = new Resend(process.env.RESEND_API_KEY)

app.use(cors())
app.use(express.json({ limit: '2mb' })) // needed for base64 images
app.use(express.urlencoded({ extended: true, limit: '2mb' }))

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err))

const userSchema = new mongoose.Schema({
  username:         { type: String },
  email:            { type: String, required: true, unique: true },
  password:         { type: String },
  googleId:         { type: String },
  avatar:           { type: String },   // base64
  resetToken:       { type: String },
  resetTokenExpiry: { type: Date },
  createdAt:        { type: Date, default: Date.now }
})

const User = mongoose.model('User', userSchema)

function validatePassword(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{10,}$/
  return regex.test(password)
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization
  if (!header) return res.status(401).json({ message: 'No token provided' })
  const token = header.split(' ')[1]
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = decoded.id
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

// Register
app.post('/auth/register', async (req, res) => {
  const { username, email, password } = req.body
  try {
    const existingUser = await User.findOne({ email })
    if (existingUser) return res.status(400).json({ message: 'Account already exists' })
    if (!validatePassword(password)) {
      return res.status(400).json({
        message: 'Password must be at least 10 characters and include uppercase, lowercase, number and special character'
      })
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    await User.create({ username, email, password: hashedPassword })
    res.status(201).json({ message: 'Account successfully created' })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body
  try {
    const user = await User.findOne({ email })
    if (!user) return res.status(404).json({ message: 'Account does not exist' })
    if (!user.password) return res.status(400).json({ message: 'This account uses Google login' })
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) return res.status(400).json({ message: 'Incorrect password' })
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.json({ message: 'Login successful', token })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Google OAuth
app.post('/auth/google', async (req, res) => {
  const { email, googleId, username } = req.body
  try {
    let user = await User.findOne({ email })
    if (user) {
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
      return res.status(200).json({ message: 'Login successful', token })
    }
    user = await User.create({ username, email, googleId })
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' })
    res.status(201).json({ message: 'Account successfully created', token })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Forgot Password
app.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body
  try {
    const user = await User.findOne({ email })
    if (!user) return res.status(404).json({ message: 'No account with that email' })
    if (!user.password) return res.status(400).json({ message: 'This account uses Google login' })
    const token = crypto.randomBytes(32).toString('hex')
    user.resetToken = token
    user.resetTokenExpiry = Date.now() + 1000 * 60 * 60
    await user.save()
    const resetLink = `${process.env.CLIENT_URL}/reset-password/${token}`
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: user.email,
      subject: 'Password Reset',
      html: `
        <p>You requested a password reset.</p>
        <p><a href="${resetLink}">Click here to reset your password</a></p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, ignore this email.</p>
      `
    })
    res.json({ message: 'Reset link sent to your email' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error' })
  }
})

// Reset Password
app.post('/auth/reset-password', async (req, res) => {
  const { token, password } = req.body
  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    })
    if (!user) return res.status(400).json({ message: 'Invalid or expired reset link' })
    if (!validatePassword(password)) {
      return res.status(400).json({
        message: 'Password must be at least 10 characters and include uppercase, lowercase, number and special character'
      })
    }
    user.password = await bcrypt.hash(password, 10)
    user.resetToken = undefined
    user.resetTokenExpiry = undefined
    await user.save()
    res.json({ message: 'Password reset successful' })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})

// Get current user
app.get('/user/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('username email avatar')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({ username: user.username, email: user.email, avatar: user.avatar || null })
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

// Upload avatar
app.post('/user/avatar', requireAuth, async (req, res) => {
  const { avatar } = req.body
  if (!avatar) return res.status(400).json({ message: 'No image provided' })
  try {
    await User.findByIdAndUpdate(req.userId, { avatar })
    res.json({ message: 'Avatar updated' })
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

// Update username
app.patch('/user/update-username', requireAuth, async (req, res) => {
  const { username } = req.body
  if (!username || !username.trim()) return res.status(400).json({ message: 'Username cannot be empty' })
  try {
    await User.findByIdAndUpdate(req.userId, { username: username.trim() })
    res.json({ message: 'Username updated' })
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

// Update email
app.patch('/user/update-email', requireAuth, async (req, res) => {
  const { email } = req.body
  if (!email || !email.trim()) return res.status(400).json({ message: 'Email cannot be empty' })
  try {
    const existing = await User.findOne({ email: email.trim() })
    if (existing && existing._id.toString() !== req.userId)
      return res.status(400).json({ message: 'Email already in use' })
    await User.findByIdAndUpdate(req.userId, { email: email.trim() })
    res.json({ message: 'Email updated' })
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

// Change password
app.patch('/user/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (!user.password) return res.status(400).json({ message: 'This account uses social login' })
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' })
    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        message: 'Password must be at least 10 characters and include uppercase, lowercase, number and special character'
      })
    }
    user.password = await bcrypt.hash(newPassword, 10)
    await user.save()
    res.json({ message: 'Password changed' })
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

// Delete account
app.delete('/user/delete', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.userId)
    res.json({ message: 'Account deleted' })
  } catch {
    res.status(500).json({ message: 'Server error' })
  }
})

app.use('/library', requireAuth, libraryRoutes)

app.get('/', (req, res) => res.send('Where Was I API running'))
app.listen(5000, () => console.log('Server running on port 5000'))
