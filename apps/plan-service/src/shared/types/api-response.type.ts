export interface ApiResponse<TData = unknown> {
  success?: boolean
  data?: TData
  error?: string
}
