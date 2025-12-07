const express = require('express');
const winston = require('winston');
const path = require('path');
const client = require('prom-client');   // Prometheus client

const app = express();
const port = process.env.PORT || 3000;

// Logs directory
const logsDir = path.join(__dirname, '..', 'logs');

// Winston logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: path.join(logsDir, 'app.log') })
  ]
});

// Prometheus metrics setup
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});
register.registerMetric(httpRequestCounter);

// Middleware: log + count requests
app.use((req, res, next) => {
  logger.info({
    message: 'Incoming request',
    method: req.method,
    url: req.originalUrl
  });

  res.on('finish', () => {
    httpRequestCounter.inc({
      method: req.method,
      route: req.originalUrl,
      status: res.statusCode
    });
  });

  next();
});

// Health endpoint
app.get('/health', (req, res) => {
  logger.info({ message: 'Health check', status: 'UP' });
  res.status(200).json({ status: 'UP' });
});

// Data endpoint
app.get('/api/data', (req, res) => {
  const data = { message: 'Observability demo', timestamp: new Date().toISOString() };
  logger.info({ message: 'Served data', data });
  res.status(200).json(data);
});

// Error simulation endpoint
app.get('/api/error', (req, res) => {
  logger.error({ message: 'Simulated error', code: 'DEMO_ERROR' });
  res.status(500).json({ error: 'Simulated error' });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Start server
app.listen(port, () => {
  logger.info({ message: `Service running`, port });
});