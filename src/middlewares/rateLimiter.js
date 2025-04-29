const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 1000, // 1000 requisições por minuto
    message: {
        status: 429,
        error: 'Too Many Requests',
        message: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV === 'test'
});

module.exports = { limiter };