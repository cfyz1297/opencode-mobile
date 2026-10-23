import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldSurfaceSpeechError } from './speech-errors.ts'

test('speech errors stay silent until the user starts listening', () => {
  assert.equal(shouldSurfaceSpeechError({ errorCode: 'not-allowed', userStarted: false }), false)
  assert.equal(shouldSurfaceSpeechError({ errorCode: 'audio-capture', userStarted: false }), false)
  assert.equal(shouldSurfaceSpeechError({ errorCode: 'not-allowed', userStarted: true }), true)
  assert.equal(shouldSurfaceSpeechError({ errorCode: 'no-speech', userStarted: true }), false)
})
