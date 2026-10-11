export class ApiResponse {
  constructor(statusCode, data, message = 'Success', pagination = null, path = null) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    if (path) {
      this.path = path;
    }
    this.message = message;
    this.data = data;
    if (pagination) {
      this.pagination = pagination;
    }
    this.timestamp = new Date().toISOString();
  }
}

