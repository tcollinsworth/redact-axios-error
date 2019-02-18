# redact-axios-error

Axios errors are verbose when strigified and leak URL and header authorization.

This library trims them down to essential information removing circular references.
It redacts URL and header authorization.
It can optionally be configured to redact any of request, response, and query string data.

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
log.error(new AxiosErrorGroomer(true, true, true).getGroomedAxiosError(err), 'Some error message')
```

# Methods

   * `AxiosErrorGroomer (includeRequestData = true, includeResponseData = true, includeQueryData = true)` - constructor, defaults to NOT redact request, response, and query string data
   * `getGroomedAxiosError(error)` - trims and redacts if AxiosError, otherwise returns the Error unaltered
   * `isAxiosError(error)` - true if the Error is an Axios error, called by the getGroomedAxiosError method
   * `includeRequestData(bool)` - initializes kafka, connecting to broker, returns promise, but should not await if utilizing fallback, return this for chaining
   * `includeResponseData(bool)` - closes the kafka connection, returns promise, return this for chaining
   * `includeQueryData(bool)` - queue a message for publishing to kafka, the defaultTopic will be used unless topic is provided, return this for chaining
