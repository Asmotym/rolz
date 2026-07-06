import type { Request, Response, NextFunction } from "express";

export function sentry(_error: unknown, _request: Request, response: Response, next: NextFunction) {
    response.statusCode = 500;
    // @ts-ignore
    response.end(response.sentry + "\n");
    
    next();
}
