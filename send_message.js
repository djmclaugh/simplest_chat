const fs = require('fs');
const https = require('https');

const certChainLocation = process.argv[2];
const certKeyLocation = process.argv[3];
const destinationFQDN = process.argv[4];
const port = Number.parseInt(process.argv[5]);
const message = process.argv[6];

var requestOptions = {
  host: destinationFQDN,
  port: Number.parseInt(port),
  path: '/',
  method: 'POST',
  cert: fs.readFileSync(certChainLocation),
  key: fs.readFileSync(certKeyLocation),
};

var req = https.request(requestOptions, function(res) {
  const code = res.statusCode;
  if (code === 204) {
    console.log('message sent!');
  } else {
    console.log('Unexpected status code: %d', code)
  }
});

req.on('error', e => {
  console.log(e);
});

req.write(message);

req.end();
