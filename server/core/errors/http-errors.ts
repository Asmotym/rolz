export class HttpError extends Error {
    status: number;
    code?: string;

    constructor(status: number, message: string, options?: { code?: string }) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.code = options?.code;
    }
}

export class NotFoundError extends HttpError {
    constructor(message = 'Not found') {
        super(404, message);
        this.name = 'NotFoundError';
    }
}

export class BadRequestError extends HttpError {
    constructor(message = 'Bad request') {
        super(400, message);
        this.name = 'BadRequestError';
    }
}

export class ForbiddenError extends HttpError {
    constructor(message = 'Forbidden') {
        super(403, message);
        this.name = 'ForbiddenError';
    }
}
