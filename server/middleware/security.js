import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const isDev=process.env.NODE_ENV!=='production';

export const securityHeaders = helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: isDev ? false : {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'data:', 'https:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com', 'https://woo-chat-bot-widget.netlify.app'],
      frameSrc: ['https://js.stripe.com', 'https://hooks.stripe.com'],
      connectSrc: ["'self'", 'https://*.supabase.co', 'https://api.stripe.com'],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  }
});

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});

export const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false
});
