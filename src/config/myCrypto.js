const crypto = require('crypto');
const MySecretKey = 'your_secret_key8888';
// 加密
function encrypt(text, secretKey) {
  const cipher = crypto.createCipher('aes-256-cbc', secretKey || MySecretKey);
  let encrypted = cipher.update(text, 'utf-8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// 解密
function decrypt(encryptedText, secretKey) {
  const decipher = crypto.createDecipher('aes-256-cbc', secretKey || MySecretKey);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
  decrypted += decipher.final('utf-8');
  return decrypted;
}

// 示例

// const originalText = 'Hello, World!';

// const encryptedText = encrypt(originalText, secretKey);
// console.log('加密后:', encryptedText);

// const decryptedText = decrypt(encryptedText, secretKey);
// console.log('解密后:', decryptedText);


export {
  decrypt, encrypt
};
