// @flow
import crypto from 'crypto';
import lowdb from '../lowdb';

// Password Must be 256 bytes (32 characters)
const IV_LENGTH = 16; // For AES, this is always 16

const encryptionTest = 'Test This String Correctly Decrypts';
const algorithm = 'aes-256-cbc';

export function encrypt(text: string, password: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(algorithm, new Buffer(password), iv);
  // $FlowFixMe
  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text, password) {
  const textParts = text.split(':');
  const iv = new Buffer(textParts.shift(), 'hex');
  const encryptedText = new Buffer(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    new Buffer(password),
    iv
  );
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

export default function loadEncryptedDb(
  name: string,
  defaults: *,
  password: string
) {
  const credentialsDb = lowdb(
    name,
    { ...defaults, encryptionTest },
    {
      serialize: (data) => encrypt(JSON.stringify(data), password),
      deserialize: (data) => JSON.parse(decrypt(data, password))
    }
  );

  if (credentialsDb.get('encryptionTest').value() !== encryptionTest) {
    throw new Error(`Incorrect Password, cannot decrypt ${name} store`);
  }

  return credentialsDb;
}
