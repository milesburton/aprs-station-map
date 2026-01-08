// Simple backend health check script for npm run sanity
const http = require('http')

const HOST = process.env.SANITY_HOST || 'localhost'
const PORT = process.env.SANITY_PORT || 3001
const PATH = '/api/health'

const options = {
  hostname: HOST,
  port: PORT,
  path: PATH,
  method: 'GET',
  timeout: 3000,
}

const req = http.request(options, (res) => {
  let data = ''
  res.on('data', (chunk) => (data += chunk))
  res.on('end', () => {
    if (res.statusCode === 200 && data.includes('ok')) {
      console.log('✓ Backend health check passed:', data)
      process.exit(0)
    } else {
      console.error('✗ Backend health check failed:', res.statusCode, data)
      process.exit(1)
    }
  })
})

req.on('error', (err) => {
  console.error('✗ Backend health check error:', err.message)
  process.exit(1)
})

req.on('timeout', () => {
  console.error('✗ Backend health check timed out')
  req.destroy()
  process.exit(1)
})

req.end()
