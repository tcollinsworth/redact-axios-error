import { AxiosErrorGroomer } from './redact-axios-error.js'

export const config = {
  axiosErrorGroomer: null,
}

export function getAxiosErrorInterceptor(axiosErrorGroomer) {
  if (axiosErrorGroomer == null) {
    config.axiosErrorGroomer = new AxiosErrorGroomer()
  } else {
    config.axiosErrorGroomer = axiosErrorGroomer
  }

  // eslint-disable-next-line func-names
  const axiosErrorInterceptor = function (error) {
    if (axiosErrorInterceptor.config.axiosErrorGroomer == null) return Promise.reject(error)
    return Promise.reject(axiosErrorInterceptor.config.axiosErrorGroomer.getGroomedAxiosError(error))
  }
  axiosErrorInterceptor.config = config

  return axiosErrorInterceptor
}
