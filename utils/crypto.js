function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
}

function str2ab(str) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

export async function encrypt(message, secretKey) {
  // as usestate maybe
  let iv = window.crypto.getRandomValues(new Uint8Array(12));
  let encoded = (new TextEncoder()).encode(message);
  const algorithm = "AES-GCM"

  const ciphertext = await window.crypto.subtle.encrypt(
    {
      name: algorithm,
      iv: iv,
    },
    secretKey,
    encoded
  );

  // let buffer = new Uint8Array(ciphertext, 0, 5);
  return {
    algorithm: algorithm,
    iv: window.btoa(ab2str(iv)),
    message: window.btoa(ab2str(ciphertext))
  }
}

export async function decrypt(ciphertext, secretKey, iv, algorithm) {
  try {
    let decrypted = await window.crypto.subtle.decrypt(
      {
        name: algorithm,
        iv: str2ab(window.atob(iv)),
      },
      secretKey,
      str2ab(window.atob(ciphertext))
    );

    let dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (e) {
    console.error(e)
    return ""
  }
}

export async function exportCryptoKey(key) {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  const exportedKeyBuffer = new Uint8Array(exported);
  return `[${exportedKeyBuffer}]`
}

export function importKeyRaw(key) {
  const parsedKey = new Uint8Array(JSON.parse(key))
  return window.crypto.subtle.importKey("raw", parsedKey, { name: "ECDH", namedCurve: "P-384" }, true, [])
}

export async function deriveSharedSecret(publicKey, keyPair) {
  const decodedPublicKey = await importKeyRaw(publicKey)
  return window.crypto.subtle.deriveKey(
    {
      name: "ECDH",
      public: decodedPublicKey,
    },
    keyPair.privateKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}