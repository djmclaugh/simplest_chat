const fs = require('fs');
const https = require('https');

const certChainLocation = process.argv[2];
const certKeyLocation = process.argv[3];
const port = Number.parseInt(process.argv[4]);

const serverOptions = {
  key: fs.readFileSync(certKeyLocation),
  cert: fs.readFileSync(certChainLocation),
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

console.log("simplest chat listening on port " + port);
server.listen(port);
