import Sentry from '@sentry/node';

if (typeof process.env.SENTRY_DSN === 'string') {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        sendDefaultPii: true,
        environment: process.env.ENVIRONMENT
    });
}