const config = require('./config.json');
const fs = require('fs');
const https = require('https');

const url = process.argv[2];
const port = Number.parseInt(process.argv[3]);
const message = process.argv[4];

var requestOptions = {
  host: url,
  port: Number.parseInt(port),
  path: '/',
  method: 'POST',
  cert: fs.readFileSync(config.cert),
  key: fs.readFileSync(config.key),
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
