import type { Request, Response, NextFunction } from "express";

export function cors(request: Request, response: Response, next: NextFunction) {
    const allowedOrigins = ['localhost:5173', 'rolz.asmotym.fr'];
    const allowedMethods = ['GET', 'POST', 'OPTIONS'];
    const origin = request.headers.origin || '';

    if (allowedOrigins.indexOf(origin) !== -1) {
        response.header('Access-Control-Allow-Origin', origin);
    } else {
        response.header('Access-Control-Allow-Origin', '*');
    }

    response.header('Access-Control-Allow-Credentials', 'true');
    response.header('Access-Control-Allow-Methods', allowedMethods.join(', '));
    response.header('Access-Control-Allow-Headers', 'Content-Type');

    if (request.method === 'OPTIONS') {
        response.sendStatus(200);
    } else {
        next();
    }
}