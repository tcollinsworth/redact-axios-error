import test from 'ava'
import express from 'express'
import bodyParser from 'body-parser'
import axios from 'axios'
import stringify from 'json-stringify-safe'
import lodash from 'lodash'
import safeClone from 'safe-clone-deep'

import { config, getAxiosErrorInterceptor, AxiosErrorGroomer } from '../index.js'

const isLogRequest = false
const isLogGroomedError = false

const { cloneDeep } = lodash

const app = express()
const port = 3000

let axiosClient

let server

test.before(() => {
  const axiosErrorInterceptor = getAxiosErrorInterceptor()

  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({
    extended: true,
  }))
  app.use((req, res, next) => {
    logRequest(req)
    next()
  })
  app.get('/happyGet', (req, res) => {
    res.json({ foo: 'Hello World!' })
  })
  app.post('/errorPost', () => {
    throwTestError()
  })
  app.get('/errorGet', () => {
    throwTestError()
  })
  // eslint-disable-next-line no-console
  server = app.listen(port, () => console.log(`Example app listening on port ${port}!`))

  axiosClient = axios.create({
    timeout: 5000,
  })

  axiosClient.interceptors.response.use(null, axiosErrorInterceptor)
})

test.beforeEach(() => {
  config.axiosErrorGroomer = new AxiosErrorGroomer()
})

test.after(async (t) => {
  // try successful request after error request to be sure redact didn't affect axios
  const resp = await happyAxiosRequest()
  t.is(200, resp.status)
})

function throwTestError() {
  throw new Error('test')
}

test.after.always(() => {
  if (server) {
    server.close()
  }
})

test('happyGet', async (t) => {
  const { err } = await get('http://user:pass@localhost:3000', '/happyGet?foo=bar', 'foo', 'bar', { some: true })
  t.falsy(err)
  t.pass()
})

test('notFound, url auth, with query params', async (t) => {
  try {
    await get('http://user:pass@localhost:3000', '/notFound?foo=bar', 'foo', 'bar', { some: true })
    t.fail()
  } catch (err) {
    logGroomedError(err)

    t.is(err.config.baseURL, 'http://localhost:3000')
    t.true(err.config.url.includes('/notFound?foo=bar'))
    t.is(err.config.data, '{"some":true}')
    t.truthy(err.response.data)
    t.falsy(err.config.headers.Authorization)
    t.falsy(stringify(err).includes('pass'))
  }
})

test('notFound, url auth', async (t) => {
  try {
    await get('http://user:pass@localhost:3000', '/notFound', 'foo', 'bar', { some: true })
    t.fail()
  } catch (err) {
    logGroomedError(err)

    t.is(err.config.baseURL, 'http://localhost:3000')
    t.true(err.config.url.includes('/notFound'))
    t.is(err.config.data, '{"some":true}')
    t.truthy(err.response.data)
    t.falsy(err.config.headers.Authorization)
    t.falsy(stringify(err).includes('pass'))
  }
})

test('notFound, url auth, no include data flags', async (t) => {
  config.axiosErrorGroomer = new AxiosErrorGroomer(false, false, false)

  try {
    await get('http://user:pass@localhost:3000', '/notFound?foo=bar', 'foo', 'bar', { some: true })
    t.fail()
  } catch (err) {
    logGroomedError(err)

    t.is(err.config.baseURL, 'http://localhost:3000')
    t.true(err.config.url.includes('/notFound?[REDACTED]'))
    t.is(err.config.data, '[REDACTED]')
    t.is(err.response.data, '[REDACTED]')
    t.falsy(err.config.headers.Authorization)
    t.falsy(stringify(err).includes('pass'))
  }
})

test('badServer', async (t) => {
  try {
    await get('http://user:pass@badServer:3000', '/?foo=bar', 'foo', 'bar', { some: true })
    t.fail()
  } catch (err) {
    const errBefore = safeClone(err)

    logGroomedError(err)

    const errAfter = safeClone(err)
    t.deepEqual(errBefore, errAfter)

    t.is(err.config.baseURL, 'http://badServer:3000')
    t.true(err.config.url.includes('/?foo=bar'))
    t.is(err.config.data, '{"some":true}')
    t.falsy(err.config.headers.Authorization)

    t.is(err.errno, -3008)
    t.is(err.code, 'ENOTFOUND')
    t.is(err.syscall, 'getaddrinfo')
    t.deepEqual({}, err.response)
    t.falsy(stringify(err).includes('pass'))
  }
})

// axios strips header authorization if url authorization exists
test('error post, url authorization', async (t) => {
  try {
    await post('http://user:pass@localhost:3000', '/errorPost?foo=bar', 'foo', 'bar', { some: true })
    t.fail()
  } catch (err) {
    logGroomedError(err)

    t.is(err.config.baseURL, 'http://localhost:3000')
    t.true(err.config.url.includes('/errorPost?foo=bar'))
    t.is(err.config.data, '{"some":true}')
    t.truthy(err.response.data)
    t.falsy(err.config.headers.Authorization)
    t.falsy(stringify(err).includes('pass'))
  }
})

// axios strips header authorization if url authorization exists
test('error post, header authorization', async (t) => {
  try {
    await post('http://localhost:3000', '/errorPost?foo=bar', 'foo', 'bar', { some: true })
    t.fail()
  } catch (err) {
    logGroomedError(err)

    t.is(err.config.baseURL, 'http://localhost:3000')
    t.true(err.config.url.includes('/errorPost?foo=bar'))
    t.is(err.config.data, '{"some":true}')
    t.truthy(err.response.data)
    t.is(err.config.headers.Authorization, '[REDACTED]')
    t.falsy(stringify(err).includes('pass'))
  }
})

// axios strips header authorization if url authorization exists
test('error post, header authorization, redacting all', async (t) => {
  config.axiosErrorGroomer = new AxiosErrorGroomer(false, false, false)

  try {
    await post('http://localhost:3000', '/errorPost?foo=bar', 'foo', 'bar', { some: true })
    t.fail()
  } catch (err) {
    logGroomedError(err)

    t.is(err.config.baseURL, 'http://localhost:3000')
    t.true(err.config.url.includes('/errorPost?[REDACTED]'))
    t.is(err.config.data, '[REDACTED]')
    t.is(err.response.data, '[REDACTED]')
    t.is(err.config.headers.Authorization, '[REDACTED]')
    t.falsy(stringify(err).includes('pass'))
  }
})

// axios strips header authorization if url authorization exists
test('Non Axios Error with cause Axios error post, header authorization, redacting all', async (t) => {
  config.axiosErrorGroomer = null

  try {
    await post('http://localhost:3000', '/errorPost?foo=bar', 'foo', 'bar', { some: true })
    t.fail()
  } catch (err) {
    const parentNonAxiosError = new Error('parentNonAxiosError')
    parentNonAxiosError.cause = err

    config.axiosErrorGroomer = new AxiosErrorGroomer(false, false, false)
    const groomedError = config.axiosErrorGroomer.getGroomedAxiosError(parentNonAxiosError)
    logGroomedError(groomedError)

    t.is(groomedError.cause.config.baseURL, 'http://localhost:3000')
    t.true(groomedError.cause.config.url.includes('/errorPost?[REDACTED]'))
    t.is(groomedError.cause.config.data, '[REDACTED]')
    t.is(groomedError.cause.response.data, '[REDACTED]')
    t.is(groomedError.cause.config.headers.Authorization, '[REDACTED]')
    t.falsy(stringify(groomedError).includes('pass'))
  }
})

// axios strips header authorization if url authorization exists
test('Non Axios Error with cause Axios error, with circular parent cause, post, header authorization, redacting all', async (t) => {
  config.axiosErrorGroomer = null

  try {
    await post('http://localhost:3000', '/errorPost?foo=bar', 'foo', 'bar', { some: true })
    t.fail()
  } catch (err) {
    const parentNonAxiosError = new Error('parentNonAxiosError')
    parentNonAxiosError.cause = err
    err.cause = parentNonAxiosError // circular

    config.axiosErrorGroomer = new AxiosErrorGroomer(false, false, false)
    const groomedError = config.axiosErrorGroomer.getGroomedAxiosError(parentNonAxiosError)
    logGroomedError(groomedError)

    t.is(groomedError.cause.config.baseURL, 'http://localhost:3000')
    t.true(groomedError.cause.config.url.includes('/errorPost?[REDACTED]'))
    t.is(groomedError.cause.config.data, '[REDACTED]')
    t.is(groomedError.cause.response.data, '[REDACTED]')
    t.is(groomedError.cause.config.headers.Authorization, '[REDACTED]')
    t.falsy(stringify(err).includes('pass'))
  }
})

// axios strips header authorization if url authorization exists
test('5th level is AxiosError, post, header authorization, redacting all', async (t) => {
  config.axiosErrorGroomer = null

  try {
    await post('http://localhost:3000', '/errorPost?foo=bar', 'foo', 'bar', { some: true })
    t.fail()
  } catch (err) {
    const parentError = new Error('test')
    let cause = parentError
    for (let i = 0; i < 4; i++) {
      cause.cause = cloneDeep(cause)
      cause = cause.cause
    }
    cause.cause = err // the axios error at the end

    // const start = new Date().getTime()
    config.axiosErrorGroomer = new AxiosErrorGroomer(false, false, false)
    const groomedError = config.axiosErrorGroomer.getGroomedAxiosError(parentError)
    logGroomedError(groomedError)
    // console.log('duration', new Date().getTime() - start)

    t.is(cause.cause.config.baseURL, 'http://localhost:3000')
    t.true(cause.cause.config.url.includes('/errorPost?[REDACTED]'))
    t.is(cause.cause.config.data, '[REDACTED]')
    t.is(cause.cause.response.data, '[REDACTED]')
    t.is(cause.cause.config.headers.Authorization, '[REDACTED]')
    t.falsy(stringify(err).includes('pass'))
  }
})

async function get(baseurl, urlPrefix, uid, pwd, data) {
  const resp = await axiosClient.get(urlPrefix, {
    baseURL: baseurl,
    headers: {
      Authorization: `Basic ${Buffer.from(`${uid}:${pwd}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    data,
  })
  return resp
}

async function post(baseurl, urlPrefix, uid, pwd, data) {
  const resp = await axiosClient.post(urlPrefix, data, {
    baseURL: baseurl,
    headers: {
      Authorization: `Basic ${Buffer.from(`${uid}:${pwd}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
  })
  return resp
}

async function happyAxiosRequest() {
  const resp = await get('http://user:pass@localhost:3000', '/happyGet?foo=bar', 'foo', 'bar', { some: true })
  return resp
}

function logGroomedError(groomedError) {
  if (isLogGroomedError) {
    // eslint-disable-next-line no-console
    console.log(groomedError.message, stringify(groomedError, null, '  '))
  }
}

function logRequest(req) {
  if (isLogRequest) {
    // eslint-disable-next-line no-console
    console.log(req.path, 'req body', req.body != null, 'data', req.data != null, 'query', req.query != null, 'body', req.body, 'data', req.data, 'query', req.query)
  }
}
