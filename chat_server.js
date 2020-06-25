const assert = require('assert').strict;
const fs = require('fs');
const http = require('http');
const https = require('https');
// Idealy, we shouldn't need to use third party libraries for this, but I wasn't able to find a way
// to easily parse an X.509 certificate using the built-in libraries only.
// I'm sure there's an easy way to do it with the help of the https or tls libraries though...
// Need to investigate further.
const pki = require('node-forge').pki;
const argv = require('minimist')(process.argv.slice(2));

console.log();

/**
 * Process command line arguments
 */

// --isBehindProxy ~ default: false
//
// Whether or not a reverse proxy server will handle the TLS handshake for this server.
//
// If --isBehindProxy is enabled, the identity of the requester will be determined by looking at
// the certificate in the X-SSL-CERT header of the request (as opposed to the certificate obtained
// during the mutual authentication TLS handshake, since it is now the responsibility of the proxy
// to do that)
//
// WARNING: If --isBehindProxy is enabled, all requests will be trusted and no further
// authtnetication will be done. The public certificate in the X-SSL-CERT header will be accepted no
// questions asked. This can easily be used to spoof the requester's identity. This can happen if
// the mutual authentication TLS handshake is not done properly by the reverse proxy or if the
// client can somehow bypass the proxy and access this server directly. Ensure that both your
// reverse proxy and firewall are properly set up before enabling this flag.
//
// Only enable this flag if you know what you are doing.
assert(
  argv.isBehindProxy === undefined || argv.isBehindProxy === true,
  '--isBehindProxy should only be present or not. It should not have a value.'
);
const isBehindProxy = argv.isBehindProxy !== undefined ? true: false;
if (isBehindProxy) {
  console.log("Running with 'isBehindProxy' flag enabled.");
  console.log("!!! You should only enable this flag if you know what you are doing. !!!");
  console.log("Ensure that all requests reaching this server have passed mutual authentication beforehand.");
  console.log("It is the proxy's responsibiltiy to ensure that the clients are who they claim they are.");
  console.log("It is your responsibiltiy to ensure that the clients can only access this server via the proxy.");
  console.log();
}

// -c, --cert ~ default: undefined
//
// The location of the full certificate chain this server should use to identify themselves to the
// requester.
//
// If not set, an http server will be created instead of an https server. This is usually only
// desirable if this server is behind a trusted proxy server that handles the https connection.
//
// Must be set unless --isBehindProxy is also enabled.
assert(
  argv.c === undefined || argv.cert === undefined,
  'Only one of -c or --cert should be set.'
);
const certChainLocation = argv.c ? argv.c : argv.cert;
assert(
  certChainLocation === undefined || typeof certChainLocation === 'string',
  '-c or --cert should be assigned a value if present.'
);
assert(
  certChainLocation !== undefined || isBehindProxy,
  '-c or --cert must be set if not running behind a proxy server.'
);
if (certChainLocation === undefined) {
  console.log("No certificate specified. Creating HTTP server instead of HTTPS server.");
  console.log();
}

// -k, --key ~ default: undefined
//
// The location of the private key this server should use to identify themselves to the requester.
//
// Required if and only if a certificate has been specified.
assert(
  argv.k === undefined || argv.key === undefined,
  'Only one of -k or --key should be set.'
);
const certKeyLocation = argv.k ? argv.k : argv.key;
assert(
  certKeyLocation === undefined || typeof certKeyLocation === 'string',
  '-k or --key should be assigned a value if present.'
);
assert(
  (typeof certKeyLocation === 'undefined') === (typeof certChainLocation === 'undefined'),
  'A private key should be specified if and only if a certificate chain has been specified.'
);

// -p, --port ~ default: 80 if no cert specified, 443 if cert chain specified
//
// Which port this server will run on.
assert(
  argv.p === undefined || argv.port === undefined,
  'Only one of -p or --port should be set.'
);
let portString =  argv.p ? argv.p : argv.port;
if (portString === undefined) {
  portString = certChainLocation === undefined ? '80' : '443';
}
const port = Number.parseInt(portString);

// -h, --host ~ default: 'localhost' if no cert specified, 'undefined' if cert chain specified
//
// Which host this server will be bound to.
//
// If --isBehindProxy enabled, the default for --host becomes 'localhost' to help prevent requests
// bypassing the proxy server, but, depending on your setup, this might not be sufficient.
// If --isBehindProxy enabled, please ensure that the only way to access this server is through the
// intended proxy server (by means of a firewall or any other required measure).
assert(
  argv.h === undefined || argv.host === undefined,
  'Only one of -h or --host should be set.'
);
let host =  argv.h ? argv.h : argv.host;
if (host === undefined && isBehindProxy) {
  host = 'localhost';
}

/**
 * Set up server options.
 */
const serverOptions = {
  requestCert: !isBehindProxy,
};
if (certChainLocation) {
  serverOptions.cert = fs.readFileSync(certChainLocation);
  serverOptions.key = fs.readFileSync(certKeyLocation);
}

function processRequest(req, res) {
  // Only endpoint allowed is a POST at '/'.
  if (req.method !== 'POST' || req.url !== '/') {
    res.writeHead(405);
    res.end();
    return;
  }
  const origin = getOrigin(req);
  if (origin === undefined) {
    res.writeHead(400);
    res.end();
    return;
  }
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    console.log(origin + ': ' + body);
    res.writeHead(204);
    res.end();
  });
}

function getOrigin(req) {
  if (isBehindProxy) {
    // If the server is behind a proxy, the proxy should have added the client certificate to the
    // X-SSL-CERT header.
    const URIEncodedCert = req.headers['x-ssl-cert'];
    if (URIEncodedCert === undefined) {
      console.error("x-ssl-cert header missing from request");
      return undefined;
    }
    try {
      const rawCert = decodeURIComponent(URIEncodedCert);
      return pki.certificateFromPem(rawCert).subject.getField('CN').value;
    } catch(e) {
      console.error("Error while parsing x-ssl-cert header:");
      console.error(e);
      return undefined;
    }
  } else {
    // If the server is not behind a proxy, it did the tls handshake itself and should have the
    // certificate attached to the socket.
    return req.socket.getPeerCertificate().subject.CN;
  }
}

const server =
    certChainLocation === undefined
        ? http.createServer(serverOptions, processRequest)
        : https.createServer(serverOptions, processRequest);

server.listen(port, host);
console.log("simplest chat listening on port " + port);
console.log();
