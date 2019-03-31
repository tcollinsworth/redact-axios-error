import traverse from 'traverse'
import safeClone from 'safe-clone-deep'

export class AxiosErrorGroomer {
  constructor(includeRequestData = true, includeResponseData = true, includeQueryData = true) {
    this.includeRequestData = includeRequestData
    this.includeResponseData = includeResponseData
    this.includeQueryData = includeQueryData
  }

  includeRequestData(bool) {
    this.includeRequestData = bool
    return this
  }

  includeResponseData(bool) {
    this.includeResponseData = bool
    return this
  }

  includeQueryData(bool) {
    this.includeQueryData = bool
    return this
  }

  // recursively scan Error properties and redact any which are axios Errors, max depth 5
  getGroomedAxiosError(err) {
    if (err == null) return err

    let groomedError = err

    if (this.isAxiosError(groomedError)) groomedError = this.getGroomedAxiosErrorInternal(groomedError)

    const groomer = this

    traverse(groomedError).forEach(function traverser(e) {
      if (e === groomedError) return // continue

      if (this.circular) {
        this.remove()
        return // continue
      }

      if (this.level > 20) return // continue

      if (groomer.isAxiosError(e)) this.update(groomer.getGroomedAxiosErrorInternal(e)) // continue, no need to drill deeper
    })

    return groomedError
  }

  // server error response keys [ 'config', 'request', 'response' ]
  // no server exists error keys [ 'errno', 'code', 'syscall', 'address', 'port', 'config', 'request', 'response' ]
  getGroomedAxiosErrorInternal(err) {
    if (!this.isAxiosError(err)) return err

    const groomedAxiosError = new Error(err.message)
    if (err.stack != null) groomedAxiosError.stack = err.stack
    if (err.errno != null) groomedAxiosError.errno = err.errno
    if (err.code != null) groomedAxiosError.code = err.code
    if (err.syscall != null) groomedAxiosError.syscall = err.syscall
    if (err.address != null) groomedAxiosError.address = err.address
    if (err.port != null) groomedAxiosError.port = err.port

    groomedAxiosError.config = this.getClonedRedactedConfig(err.config)

    groomedAxiosError.request = this.getClonedRedactedRequest(err.request)

    groomedAxiosError.response = this.getClonedRedactedResponse(err.response)

    return groomedAxiosError
  }

  // response.keys 'status', 'statusText', 'headers', 'config', 'request', 'data'
  // eslint-disable-next-line class-methods-use-this
  getClonedRedactedResponse(errResponse) {
    const clonedResponse = {}
    if (errResponse == null) return clonedResponse

    if (errResponse.status != null) clonedResponse.status = errResponse.status
    if (errResponse.statusText != null) clonedResponse.statusText = errResponse.statusText
    if (errResponse.headers != null) clonedResponse.headers = safeClone(errResponse.headers)

    if (clonedResponse.headers != null) {
      if (clonedResponse.headers['set-cookie'] != null) delete clonedResponse.headers['set-cookie']

      if (clonedResponse.headers['x-newrelic-app-data'] != null) delete clonedResponse.headers['x-newrelic-app-data']
    }

    if (this.includeResponseData) {
      if (errResponse.data != null) clonedResponse.data = safeClone(errResponse.data)
    } else if (errResponse.data != null && errResponse.data != null) clonedResponse.data = '[REDACTED]'

    return clonedResponse
  }

  // eslint-disable-next-line class-methods-use-this
  getClonedRedactedConfig(errConfig) {
    const clonedConfig = {}
    if (errConfig == null) return clonedConfig

    if (errConfig.timeout != null) clonedConfig.timeout = errConfig.timeout
    if (errConfig.xsrfCookieName != null) clonedConfig.xsrfCookieName = errConfig.xsrfCookieName
    if (errConfig.xsrfHeaderName != null) clonedConfig.xsrfHeaderName = errConfig.xsrfHeaderName
    if (errConfig.maxContentLength != null) clonedConfig.maxContentLength = errConfig.maxContentLength
    if (errConfig.headers != null) clonedConfig.headers = safeClone(errConfig.headers)
    if (errConfig.method != null) clonedConfig.method = errConfig.method
    if (errConfig.data != null) clonedConfig.data = safeClone(errConfig.data)

    if (errConfig.baseURL != null) clonedConfig.baseURL = errConfig.baseURL
    if (errConfig.url != null) clonedConfig.url = errConfig.url

    this.redactConfig(clonedConfig)

    return clonedConfig
  }

  /**
   * Is this an axios error.
   *
   * @param {Object} err The error to test.
   * @returns {boolean} True if axios error.
   */
  // eslint-disable-next-line class-methods-use-this
  isAxiosError(err) {
    return err instanceof Error && err.config != null && err.request != null
  }

  getClonedRedactedRequest(errRequest) {
    if (errRequest == null) return null
    const clonedRequest = {}

    if (this.includeRequestData && errRequest.data != null) {
      clonedRequest.data = safeClone(errRequest.data)
    } else if (errRequest.data != null) clonedRequest.data = '[REDACTED]'

    return clonedRequest
  }

  redactConfig(clonedConfig) {
    if (clonedConfig == null) return clonedConfig

    this.redactHeadersAuthorization(clonedConfig)
    this.redactUrlCredentials(clonedConfig)

    return clonedConfig
  }

  // eslint-disable-next-line class-methods-use-this
  redactHeadersAuthorization(clonedConfig) {
    if (clonedConfig == null) return

    if (clonedConfig.headers != null) {
      if (clonedConfig.headers.Authorization != null) clonedConfig.headers.Authorization = '[REDACTED]'
      if (clonedConfig.headers.authorization != null) clonedConfig.headers.authorization = '[REDACTED]'
      if (clonedConfig.headers.AUTHORIZATION != null) clonedConfig.headers.AUTHORIZATION = '[REDACTED]'
    }
  }

  redactUrlCredentials(clonedConfig) {
    if (clonedConfig == null) return

    if (clonedConfig.baseURL != null) clonedConfig.baseURL = this.redactUrl(clonedConfig.baseURL)
    if (clonedConfig.url != null) clonedConfig.url = this.redactUrl(clonedConfig.url)

    if (!this.includeRequestData && clonedConfig.data != null) clonedConfig.data = '[REDACTED]'

    if (!this.includeQueryData && clonedConfig.url != null) {
      clonedConfig.url = clonedConfig.url.replace(/(\?.*)|(#.*)/g, '?[REDACTED]')
    }
  }

  // eslint-disable-next-line class-methods-use-this
  redactUrl(url) {
    if (url == null) return url
    return url.replace(/^((?:\w+:)?\/\/)(?:[^@/]+@)/, '$1')
  }
}
