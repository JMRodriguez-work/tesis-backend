export class ApiResponse<T = unknown> {
  data: T
  message: string
  status: number

  constructor({ data, message, status }: { data: T; message: string; status: number }) {
    this.data = data
    this.message = message
    this.status = status
  }
}

export class ApiError extends Error {
  status: number
  data?: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}
