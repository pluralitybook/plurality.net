import assert from 'node:assert/strict'
import test from 'node:test'
import app from '../src/index'

test('GET /au/:question streams text/plain stub', async () => {
  const res = await app.request('http://localhost/au/hello%20world?lang=zh', {
    headers: { Origin: 'http://localhost:8080' },
  })
  assert.equal(res.status, 200)
  assert.match(res.headers.get('Content-Type') ?? '', /text\/plain/)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8080')
  const text = await res.text()
  assert.match(text, /Plurality|hello/i)
})

test('GET /capacity returns available status JSON', async () => {
  const res = await app.request('http://localhost/capacity', {
    headers: { Origin: 'https://plurality.net' },
  })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { status: 'available' })
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://plurality.net')
})

test('GET /au rejects question over 100 scalars', async () => {
  const long = 'a'.repeat(101)
  const res = await app.request(`http://localhost/au/${encodeURIComponent(long)}`)
  assert.equal(res.status, 400)
})

test('OPTIONS /au returns CORS preflight for plurality.net', async () => {
  const res = await app.request('http://localhost/au/x', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://plurality.net',
      'Access-Control-Request-Method': 'GET',
    },
  })
  assert.equal(res.status, 204)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://plurality.net')
})