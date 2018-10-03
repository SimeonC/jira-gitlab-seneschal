// @flow
import crypto from 'crypto';
import lowdb from './adapter';

// Password Must be 256 bytes (32 characters)
const IV_LENGTH = 16; // For AES, this is always 16

const encryptionTest = 'Test This String Correctly Decrypts';
const algorithm = 'aes-256-cbc';

export function encrypt(text: string, encryptionKey: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(
    algorithm,
    new Buffer(encryptionKey),
    iv
  );
  // $FlowFixMe
  let encrypted = cipher.update(text);

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string, encryptionKey: string): string {
  const textParts = text.split(':');
  const iv = new Buffer(textParts.shift(), 'hex');
  const encryptedText = new Buffer(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    new Buffer(encryptionKey),
    iv
  );
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}

export default function loadEncryptedDb(
  name: string,
  defaults: *,
  encryptionKey: string,
  options?: { serialize?: ({}) => string, deserialize?: (string) => {} } = {}
) {
  if (Buffer.byteLength(encryptionKey) !== 32) {
    throw new Error(
      `Key 'lowdbEncryptionKey' in 'config.json' must be 32 characters long, it is currently ${Buffer.byteLength(
        encryptionKey
      )}`
    );
  }
  const credentialsDb = lowdb(
    name,
    { ...defaults, encryptionTest },
    {
      ...options,
      serialize: (data) => {
        let parsedData = JSON.stringify(data);
        if (options.serialize) {
          parsedData = options.serialize(data);
        }
        return encrypt(parsedData, encryptionKey);
      },
      deserialize: (data) => {
        const serializedData = decrypt(data, encryptionKey);
        if (options.deserialize) {
          return options.deserialize(serializedData);
        }
        return JSON.parse(serializedData);
      }
    }
  );

  if (credentialsDb.get('encryptionTest').value() !== encryptionTest) {
    throw new Error(`Incorrect Password, cannot decrypt ${name} store`);
  }

  return credentialsDb;
}
