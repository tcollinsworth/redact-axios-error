# redact-axios-error

Axios errors are verbose when stringified and leak URL and header authorization.

This library trims them down to essential information removing circular references.
It redacts URL and header authorization.
It can optionally be configured to redact any of request, response, and query string data.

Traverses all error properties inspecting for nested AxiosErrors and grooms/redacts to a max depth of at least 5.
Traversing is for redacting when an Error has for example a source or a cause AxiosError, however the property name could be anything.
The AxiosError should be the final source/cause Error as only select AxiosError properties are copied onto the groomedAxiosError.
All AxiosError parent Errors and properties are retained unaltered.

## Requirements

Node 8+

## Getting started

```console
npm i -S redact-axios-error
```

# Usage

```javascript
const groomer = new AxiosErrorGroomer()
log.error(groomer.getGroomedAxiosError(err), 'Some error message')

OR

log.error(new AxiosErrorGroomer().getGroomedAxiosError(err), 'Some error message')

OR

To redact request, response, and query string data:
log.error(new AxiosErrorGroomer(false, false, false).getGroomedAxiosError(err), 'Some error message')
```

# Methods

   * `AxiosErrorGroomer (includeRequestData = true, includeResponseData = true, includeQueryData = true)` - constructor, defaults to NOT redact request, response, and query string data
   * `getGroomedAxiosError(error)` - trims and redacts if AxiosError, otherwise returns the Error unaltered
   * `isAxiosError(error)` - true if the Error is an Axios error, called by the getGroomedAxiosError method
   * `includeRequestData(bool)` - default true, false redacts request data
   * `includeResponseData(bool)` - default true, false redacts response data
   * `includeQueryData(bool)` - default true, false redacts query string data

# Output Error JSON

## Bad Server

Not redacting request data or query string

```javascript
{
  "config": {
    "transformRequest": {},
    "transformResponse": {},
    "timeout": 5000,
    "xsrfCookieName": "XSRF-TOKEN",
    "xsrfHeaderName": "X-XSRF-TOKEN",
    "maxContentLength": -1,
    "headers": {
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "User-Agent": "axios/0.18.0",
      "Content-Length": 13
    },
    "method": "get",
    "baseURL": "http://badServer:3000",
    "data": "{\"some\":true}",
    "url": "http://badServer:3000/?foo=bar"
  },
  "errno": "ENOTFOUND",
  "code": "ENOTFOUND",
  "syscall": "getaddrinfo",
  "port": "3000",
  "request": {}
}
```

## Server Error

Redacting request/response data and query string

```javascript
{
  "config": {
    "transformRequest": {},
    "transformResponse": {},
    "timeout": 5000,
    "xsrfCookieName": "XSRF-TOKEN",
    "xsrfHeaderName": "X-XSRF-TOKEN",
    "maxContentLength": -1,
    "headers": {
      "Accept": "application/json, text/plain, */*",
      "Content-Type": "application/json",
      "Authorization": "[REDACTED]",
      "User-Agent": "axios/0.18.0",
      "Content-Length": 13
    },
    "method": "post",
    "baseURL": "http://localhost:3000",
    "url": "http://localhost:3000/errorPost?[REDACTED]",
    "data": "[REDACTED]"
  },
  "request": {},
  "response": {
    "status": 500,
    "statusText": "Internal Server Error",
    "headers": {
      "x-powered-by": "Express",
      "content-security-policy": "default-src 'self'",
      "x-content-type-options": "nosniff",
      "content-type": "text/html; charset=utf-8",
      "content-length": "3419",
      "date": "Mon, 18 Feb 2019 17:57:52 GMT",
      "connection": "close"
    },
    "data": "[REDACTED]"
  }
}
```
