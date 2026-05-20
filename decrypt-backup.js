const CryptoJS = require('crypto-js');
const fs = require('fs');
const zlib = require('zlib');

const encryptedData = fs.readFileSync(process.argv[2], 'utf8');
const password = process.argv[3] || '1';

try {
  const bytes = CryptoJS.AES.decrypt(encryptedData, password);
  const decrypted = bytes.toString(CryptoJS.enc.Utf8);
  
  if (!decrypted) {
    console.error('解密失败：密码可能不正确');
    process.exit(1);
  }
  
  // decrypted 是 base64 编码的 gzip 压缩数据
  const compressedBuffer = Buffer.from(decrypted, 'base64');
  const jsonData = zlib.gunzipSync(compressedBuffer).toString('utf8');
  
  const data = JSON.parse(jsonData);
  console.log(JSON.stringify(data, null, 2));
} catch (err) {
  console.error('错误:', err.message);
  process.exit(1);
}
