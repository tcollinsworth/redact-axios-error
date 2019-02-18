import { test } from 'ava'
import express from 'express'
import bodyParser from 'body-parser'
import axios from 'axios'
import stringify from 'json-stringify-safe'

import { AxiosErrorGroomer } from '../index'

const app = express()
const port = 3000

let axiosClient
let reqHeaders

let server

test.before(() => {
  app.use(bodyParser.json())
  app.use(bodyParser.urlencoded({
    extended: true,
  }))
  app.use((req, res, next) => {
    logRequest(req)
    next()
  })
  app.get('/happyGet', (req, res) => {
    res.json({foo:'Hello World!'})
  })
  app.post('/errorPost', (req, res) => {
    throwTestError()
  })
  app.get('/errorGet', (req, res) => {
    throwTestError()
  })
  server = app.listen(port, () => console.log(`Example app listening on port ${port}!`))

  axiosClient = axios.create({
    timeout: 5000,
  })
})

function throwTestError() {
  throw new Error('test')
}

test.after.always(() => {
  if (server) {
    server.close()
  }
})

test('happyGet', async t => {
  const resp = await get("http://user:pass@localhost:3000", '/happyGet?foo=bar', 'foo', 'bar', {some:true})
  t.pass()
})

test('notFound url auth with query params', async t => {
  try {
    const resp = await get("http://user:pass@localhost:3000", '/notFound?foo=bar', 'foo', 'bar', {some:true})
    t.fail()
  } catch (err) {
    const groomer = new AxiosErrorGroomer()
    const groomedError = groomer.getGroomedAxiosError(err)
    logGroomedError(groomedError)

    t.is(groomedError.config.baseURL, "http://localhost:3000")
    t.is(groomedError.config.url, "http://localhost:3000/notFound?foo=bar")
    t.is(groomedError.config.data, "{\"some\":true}")
    t.truthy(groomedError.response.data)
    t.falsy(groomedError.config.headers.Authorization)
  }
})

test('notFound url auth', async t => {
  try {
    const resp = await get("http://user:pass@localhost:3000", '/notFound', 'foo', 'bar', {some:true})
    t.fail()
  } catch (err) {
    const groomer = new AxiosErrorGroomer()
    const groomedError = groomer.getGroomedAxiosError(err)
    logGroomedError(groomedError)

    t.is(groomedError.config.baseURL, "http://localhost:3000")
    t.is(groomedError.config.url, "http://localhost:3000/notFound")
    t.is(groomedError.config.data, "{\"some\":true}")
    t.truthy(groomedError.response.data)
    t.falsy(groomedError.config.headers.Authorization)
  }
})

test('notFound url auth, no include data flags', async t => {
  try {
    const resp = await get("http://user:pass@localhost:3000", '/notFound?foo=bar', 'foo', 'bar', {some:true})
    t.fail()
  } catch (err) {
    const groomer = new AxiosErrorGroomer(false, false, false)
    const groomedError = groomer.getGroomedAxiosError(err)
    logGroomedError(groomedError)

    t.is(groomedError.config.baseURL, "http://localhost:3000")
    t.is(groomedError.config.url, "http://localhost:3000/notFound?[REDACTED]")
    t.is(groomedError.config.data, "[REDACTED]")
    t.is(groomedError.response.data, "[REDACTED]")
    t.falsy(groomedError.config.headers.Authorization)
  }
})

test('badServer', async t => {
  try {
    const resp = await get("http://user:pass@badServer:3000", '/?foo=bar', 'foo', 'bar', {some:true})
    t.fail()
  } catch (err) {
    const groomer = new AxiosErrorGroomer()
    const groomedError = groomer.getGroomedAxiosError(err)
    logGroomedError(groomedError)

    t.is(groomedError.config.baseURL, "http://badServer:3000")
    t.is(groomedError.config.url, "http://badServer:3000/?foo=bar")
    t.is(groomedError.config.data, "{\"some\":true}")
    t.falsy(groomedError.response)
    t.falsy(groomedError.config.headers.Authorization)

    t.is(groomedError.errno, "ENOTFOUND")
    t.is(groomedError.code, "ENOTFOUND")
    t.is(groomedError.syscall, "getaddrinfo")
    t.is(groomedError.port, "3000")
    t.deepEqual(groomedError.request, {data: undefined})
  }
})

//axios strips header authorization if url authorization exists
test('error post url authorization', async t => {
  try {
    const resp = await post("http://user:pass@localhost:3000", '/errorPost?foo=bar', 'foo', 'bar', {some:true})
    t.fail()
  } catch (err) {
    const groomer = new AxiosErrorGroomer()
    const groomedError = groomer.getGroomedAxiosError(err)
    logGroomedError(groomedError)

    t.is(groomedError.config.baseURL, "http://localhost:3000")
    t.is(groomedError.config.url, "http://localhost:3000/errorPost?foo=bar")
    t.is(groomedError.config.data, "{\"some\":true}")
    t.truthy(groomedError.response.data)
    t.falsy(groomedError.config.headers.Authorization)
  }
})

//axios strips header authorization if url authorization exists
test('error post header authorization', async t => {
  try {
    const resp = await post("http://localhost:3000", '/errorPost?foo=bar', 'foo', 'bar', {some:true})
    t.fail()
  } catch (err) {
    const groomer = new AxiosErrorGroomer()
    const groomedError = groomer.getGroomedAxiosError(err)
    logGroomedError(groomedError)

    t.is(groomedError.config.baseURL, "http://localhost:3000")
    t.is(groomedError.config.url, "http://localhost:3000/errorPost?foo=bar")
    t.is(groomedError.config.data, "{\"some\":true}")
    t.truthy(groomedError.response.data)
    t.is(groomedError.config.headers.Authorization, '[REDACTED]')
  }
})

async function get(baseurl, urlPrefix, uid, pwd, data) {
  return await axiosClient.get(urlPrefix, {
    baseURL: baseurl,
    headers: {
      Authorization: `Basic ${new Buffer.from(`${uid}:${pwd}`).toString('base64')}`,
      'Content-Type': 'application/json'
    },
    data
  })
}

async function post(baseurl, urlPrefix, uid, pwd, data) {
  return await axiosClient.post(urlPrefix, data, {
    baseURL: baseurl,
    headers: {
      Authorization: `Basic ${new Buffer.from(`${uid}:${pwd}`).toString('base64')}`,
      'Content-Type': 'application/json'
    }
  })
}

function logGroomedError(groomedError) {
  //console.log(stringify(groomedError, null, '  '))
}

function logRequest(req) {
  //console.log(req.path, 'req body', req.body != null, 'data', req.data != null, 'query', req.query != null, 'body', req.body, 'data', req.data, 'query', req.query)
}
