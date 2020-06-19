const config = require('./config.json');
const fs = require('fs');
const https = require('https');

const serverOptions = {
  key: fs.readFileSync(config.key),
  cert: fs.readFileSync(config.cert),
  requestCert: true,
}

const server = https.createServer(serverOptions, (req, res) => {
  if (req.method !== 'POST' || req.url !== '/') {
    res.writeHead(404);
    res.end();
    return;
  }
  const origin = req.socket.getPeerCertificate().subject.CN;
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    console.log(origin + ': ' + body);
    res.writeHead(204);
    res.end();
  })
});

const port = Number.parseInt(process.argv[2]);
console.log("simplest chat listening on port " + port);
server.listen(port);
