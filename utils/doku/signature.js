import crypto from 'crypto';

function createDigest(payload) {
  const payloadString = JSON.stringify(payload).replace(/\r/g, '');
  return crypto.createHash('sha256').update(payloadString).digest('base64');
}

function generateSignature(clientId, secretKey, requestId, timestamp, targetPath, payload) {
  const digest = createDigest(payload);

  const stringToSign = [
    `Client-Id:${clientId}`,
    `Request-Id:${requestId}`,
    `Request-Timestamp:${timestamp}`,
    `Request-Target:${targetPath}`,
    `Digest:${digest}`
  ].join('\n');

  console.log('=== String to Sign ===\n' + stringToSign);

  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(stringToSign)
    .digest('base64');

  console.log('=== Generated Signature ===\n' + signature);

  return {
    signature,
    digest,
  };
}

export { generateSignature };
