const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer')
const crypto = require('crypto')
require('dotenv').config()

const app = express()
app.use(cors())
app.use(express.json())

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err))

const userSchema = new mongoose.Schema({
  username:          { type: String },
  email:             { type: String, required: true, unique: true },
  password:          { type: String },
  googleId:          { type: String },
  resetToken:        { type: String },
  resetTokenExpiry:  { type: Date },
  createdAt:         { type: Date, default: Date.now }
})

const User = mongoose.model('User', userSchema)

function validatePassword(password) {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{10,}$/
  return regex.test(password)
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
    const existingUser = await User.findOne({ email })
    if (existingUser) return res.status(200).json({ message: 'Account already exists', user: existingUser })
    const user = await User.create({ username, email, googleId })
    res.status(201).json({ message: 'Account successfully created', user })
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

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    })

    await transporter.sendMail({
      from: `"Where Was I" <${process.env.EMAIL_USER}>`,
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

app.get('/', (req, res) => res.send('Where Was I API running'))
app.listen(5000, () => console.log('Server running on port 5000'))