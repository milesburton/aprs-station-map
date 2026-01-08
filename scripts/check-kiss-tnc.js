#!/usr/bin/env node

/**
 * KISS TNC Diagnostic Tool
 *
 * Checks connectivity to the KISS TNC and monitors for incoming packets.
 * This helps diagnose if the TNC is receiving RF data.
 */

import net from 'node:net'

const KISS_HOST = process.env.KISS_HOST || '172.17.0.1'
const KISS_PORT = Number.parseInt(process.env.KISS_PORT || '8001', 10)
const TIMEOUT = 10000 // 10 seconds

console.log('=== KISS TNC Diagnostic Tool ===\n')
console.log(`Attempting to connect to ${KISS_HOST}:${KISS_PORT}...\n`)

const client = new net.Socket()
let receivedData = false
const startTime = Date.now()

// Set timeout
const timeoutId = setTimeout(() => {
  if (!receivedData) {
    console.log('⏱️  Timeout: No data received in 10 seconds')
    console.log('\nPossible issues:')
    console.log('  1. KISS TNC is not sending data (no RF packets)')
    console.log('  2. SDR is not receiving any signals')
    console.log('  3. TNC configuration issue')
    console.log('\nTo check:')
    console.log('  - Verify SDR is connected and working')
    console.log('  - Check if Direwolf (or other TNC) is running')
    console.log('  - Verify KISS port configuration')
    console.log('  - Check antenna connection')
  }
  client.destroy()
  process.exit(receivedData ? 0 : 1)
}, TIMEOUT)

client.on('connect', () => {
  console.log('✅ Connected to KISS TNC successfully!')
  console.log('📡 Monitoring for incoming packets...\n')
})

client.on('data', (data) => {
  receivedData = true
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`[${elapsed}s] 📦 Received ${data.length} bytes`)
  console.log(`    Hex: ${data.toString('hex').slice(0, 64)}${data.length > 32 ? '...' : ''}`)

  // Check for KISS frame format (starts with 0xC0)
  if (data[0] === 0xc0) {
    console.log('    ✅ Valid KISS frame detected')
  } else {
    console.log('    ⚠️  Data does not start with KISS frame marker (0xC0)')
  }
  console.log()
})

client.on('error', (error) => {
  clearTimeout(timeoutId)
  console.log('❌ Connection error:', error.message)
  console.log('\nPossible issues:')
  console.log(`  1. KISS TNC is not running on ${KISS_HOST}:${KISS_PORT}`)
  console.log('  2. Firewall blocking connection')
  console.log('  3. Wrong host/port configuration')
  console.log('\nTo fix:')
  console.log('  - Start your KISS TNC software (e.g., Direwolf)')
  console.log('  - Check KISS_HOST and KISS_PORT environment variables')
  console.log('  - Verify network connectivity')
  process.exit(1)
})

client.on('close', () => {
  clearTimeout(timeoutId)
  if (receivedData) {
    console.log('✅ Connection closed. Data was received successfully!')
    process.exit(0)
  } else {
    console.log('⚠️  Connection closed without receiving any data')
    process.exit(1)
  }
})

// Connect to KISS TNC
client.connect(KISS_PORT, KISS_HOST)
