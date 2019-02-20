import cloneDeep from 'lodash/cloneDeep'
import traverse from 'traverse'

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

    if (this.isAxiosError(err)) {
      groomedError = this.getGroomedAxiosErrorInternal(groomedError)
    }

    const groomer = this

    traverse(groomedError).forEach(function traverser(e) {
      if (this.circular) {
        this.remove()
        return // continue
      }
      if (this.level > 20) {
        return // continue
      }

      if (groomer.isAxiosError(e)) {
        this.update(groomer.getGroomedAxiosErrorInternal(e))
      }
    })

    return groomedError
  }

  // server error response keys [ 'config', 'request', 'response' ]
  // no server exists error keys [ 'errno', 'code', 'syscall', 'address', 'port', 'config', 'request', 'response' ]
  getGroomedAxiosErrorInternal(err) {
    if (!this.isAxiosError(err)) return err

    const groomedAxiosError = new Error(err.message)
    groomedAxiosError.stack = err.stack

    groomedAxiosError.config = this.getRedactedConfig(err.config)

    this.redactConfigData(groomedAxiosError.config)

    groomedAxiosError.errno = err.errno
    groomedAxiosError.code = err.code
    groomedAxiosError.syscall = err.syscall
    groomedAxiosError.address = err.address
    groomedAxiosError.port = err.port

    this.getRequest(err.request, groomedAxiosError)
    this.getResponse(err.response, groomedAxiosError)

    return groomedAxiosError
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

  redactConfigData(clonedConfig) {
    if (clonedConfig == null) return
    if (!this.includeRequestData && clonedConfig.data != null) {
      clonedConfig.data = '[REDACTED]'
    }
    if (!this.includeQueryData && clonedConfig.url != null) {
      clonedConfig.url = clonedConfig.url.replace(/(\?.*)|(#.*)/g, '?[REDACTED]')
    }
  }

  getRequest(request, groomedAxiosError) {
    if (request == null) return
    groomedAxiosError.request = {}

    if (this.includeRequestData) {
      groomedAxiosError.request.data = request.data
    }
  }

  // response.keys 'status', 'statusText', 'headers', 'config', 'request', 'data'
  getResponse(response, groomedAxiosError) {
    if (response == null) return

    groomedAxiosError.response = {}

    groomedAxiosError.response.status = response.status
    groomedAxiosError.response.statusText = response.statusText
    groomedAxiosError.response.headers = response.headers

    if (this.includeResponseData) {
      groomedAxiosError.response.data = response.data
    } else if (response.data != null) {
      groomedAxiosError.response.data = '[REDACTED]'
    }
  }

  getRedactedConfig(config) {
    if (config == null) return config

    const clonedConfig = cloneDeep(config)

    this.redactHeadersAuthorization(clonedConfig)
    this.redactUrlCredentials(clonedConfig)

    return clonedConfig
  }

  // eslint-disable-next-line class-methods-use-this
  redactHeadersAuthorization(clonedConfig) {
    if (clonedConfig == null) return

    if (clonedConfig.headers != null && clonedConfig.headers.Authorization != null) {
      if (clonedConfig.headers.Authorization != null) {
        clonedConfig.headers.Authorization = '[REDACTED]'
      }
      if (clonedConfig.headers.authorization != null) {
        clonedConfig.headers.authorization = '[REDACTED]'
      }
      if (clonedConfig.headers.AUTHORIZATION != null) {
        clonedConfig.headers.AUTHORIZATION = '[REDACTED]'
      }
    }
  }

  redactUrlCredentials(clonedConfig) {
    if (clonedConfig == null) return

    if (clonedConfig.baseURL != null) {
      clonedConfig.baseURL = this.redactUrl(clonedConfig.baseURL)
    }
    if (clonedConfig.url != null) {
      clonedConfig.url = this.redactUrl(clonedConfig.url)
    }
  }

  // eslint-disable-next-line class-methods-use-this
  redactUrl(url) {
    if (url == null) return url
    return url.replace(/^((?:\w+:)?\/\/)(?:[^@/]+@)/, '$1')
  }
}
