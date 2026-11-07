import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';

const port = Number(process.env.COURSEPULSE_HTTPS_PROXY_PORT || 3443);
const upstreamPort = Number(process.env.COURSEPULSE_UPSTREAM_PORT || 3000);
const keyPath = process.env.COURSEPULSE_TLS_KEY || '/tmp/coursepulse-test.key';
const certPath = process.env.COURSEPULSE_TLS_CERT || '/tmp/coursepulse-test.crt';

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  throw new Error('Local HTTPS proxy requires a generated TLS key and certificate.');
}

const server = https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, (request, response) => {
  const forwardedHost = request.headers.host || `127.0.0.1:${port}`;
  const headers = {
    ...request.headers,
    host: forwardedHost,
    'x-forwarded-proto': 'https',
    'x-forwarded-host': forwardedHost
  };
  const upstream = http.request({ hostname: '127.0.0.1', port: upstreamPort, path: request.url, method: request.method, headers }, upstreamResponse => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on('error', error => {
    response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    response.end(`CoursePulse CI HTTPS proxy error: ${error.message}`);
  });
  request.pipe(upstream);
});

server.listen(port, '127.0.0.1', () => process.stdout.write(`CoursePulse CI HTTPS proxy listening on ${port}\n`));
