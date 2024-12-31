// Metamask public key
const hexPublicKey = '04eca9957198a62ad8cda10f7f6d25cdf4d831fb62501860014a3bc858a7afed6e131c1cb43c14f33db2f11bbdba11539c56c357addd3a78f49cf01f83cc40ce19';

// Extract X and Y coordinates
const x = hexPublicKey.slice(2, 66);
const y = hexPublicKey.slice(66);

// Determine prefix (0x02 for even Y, 0x03 for odd Y)
const prefix = parseInt(y.slice(-1), 16) % 2 === 0 ? '02' : '03';

// Create compressed key
const compressedKey = prefix + x;

// Convert to Base64
const base64Key = btoa(
  String.fromCharCode.apply(
    null,
    compressedKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
  )
);

console.log('Base64 Public Key:', base64Key);