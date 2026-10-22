// build208/server/node_modules/jose/dist/webapi/lib/buffer_utils.js
var encoder = new TextEncoder();
var decoder = new TextDecoder();
var strictDecoder = new TextDecoder("utf-8", { fatal: true });
var MAX_INT32 = 2 ** 32;
function concat(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0), buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers)
    buf.set(buffer, i), i += buffer.length;
  return buf;
}
var NON_ASCII = /[^\x00-\x7f]/;
function encode(string) {
  if (typeof string == "string" && string.length >= 128) {
    if (NON_ASCII.test(string))
      throw new TypeError("non-ASCII string encountered in encode()");
    return encoder.encode(string);
  }
  const bytes = new Uint8Array(string.length);
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code > 127)
      throw new TypeError("non-ASCII string encountered in encode()");
    bytes[i] = code;
  }
  return bytes;
}
function encodeBase64(input, url = false) {
  if (Uint8Array.prototype.toBase64)
    return input.toBase64({ alphabet: url ? "base64url" : "base64", omitPadding: url });
  const CHUNK_SIZE = 32768, arr = [];
  for (let i = 0; i < input.length; i += CHUNK_SIZE)
    arr.push(String.fromCharCode.apply(null, input.subarray(i, i + CHUNK_SIZE)));
  const encoded = btoa(arr.join(""));
  return url ? encoded.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_") : encoded;
}
function decodeBase64(encoded, url = false) {
  if (Uint8Array.fromBase64)
    return Uint8Array.fromBase64(encoded, { alphabet: url ? "base64url" : "base64" });
  if (url) {
    if (encoded.includes("+") || encoded.includes("/"))
      throw new TypeError("Invalid base64url");
    encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  }
  const binary = atob(encoded), bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// build208/server/node_modules/jose/dist/webapi/util/errors.js
var JOSEError = class extends Error {
  static code = "ERR_JOSE_GENERIC";
  code = "ERR_JOSE_GENERIC";
  constructor(message3, options) {
    super(message3, options), this.name = this.constructor.name, Error.captureStackTrace?.(this, this.constructor);
  }
};
var JOSENotSupported = class extends JOSEError {
  static code = "ERR_JOSE_NOT_SUPPORTED";
  code = "ERR_JOSE_NOT_SUPPORTED";
};
var JWSInvalid = class extends JOSEError {
  static code = "ERR_JWS_INVALID";
  code = "ERR_JWS_INVALID";
};
var JWTInvalid = class extends JOSEError {
  static code = "ERR_JWT_INVALID";
  code = "ERR_JWT_INVALID";
};

// build208/server/node_modules/jose/dist/webapi/util/base64url.js
var invalid = "The input to be decoded is not correctly encoded.";
function decode(input) {
  try {
    return decodeBase64(typeof input == "string" ? input : decoder.decode(input), true);
  } catch (cause) {
    throw new TypeError(invalid, { cause });
  }
}
function encode2(input) {
  return encodeBase64(typeof input == "string" ? encoder.encode(input) : input, true);
}

// build208/server/node_modules/jose/dist/webapi/lib/validate.js
function isObject(input) {
  if (typeof input != "object" || input === null || Object.prototype.toString.call(input) !== "[object Object]")
    return false;
  const prototype = Object.getPrototypeOf(input);
  return prototype === null || Object.getPrototypeOf(prototype) === null;
}
function isDisjoint(...headers) {
  const parameters = /* @__PURE__ */ new Set();
  for (const header of headers)
    if (header)
      for (const parameter of Object.keys(header)) {
        if (parameters.has(parameter))
          return false;
        parameters.add(parameter);
      }
  return true;
}
function assertNotSet(value2, name) {
  if (value2 !== void 0)
    throw new TypeError(`${name} can only be called once`);
}
var JWS_RECOGNIZED = { __proto__: null, b64: true };
function validateCritDuplicates(Err, protectedHeader) {
  const { crit } = protectedHeader ?? {};
  if (Array.isArray(crit) && new Set(crit).size !== crit.length)
    throw new Err('"crit" (Critical) Header Parameter MUST NOT contain duplicate values');
}
function validateCrit(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
  if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0)
    throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
  if (!protectedHeader || protectedHeader.crit === void 0)
    return [];
  if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input != "string" || input.length === 0))
    throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  const recognized = recognizedOption === void 0 ? recognizedDefault : { __proto__: null, ...recognizedOption, ...recognizedDefault };
  for (const parameter of protectedHeader.crit) {
    if (!(parameter in recognized))
      throw new JOSENotSupported(`Extension Header Parameter "${parameter}" is not recognized`);
    if (!Object.hasOwn(joseHeader, parameter) || joseHeader[parameter] === void 0)
      throw new Err(`Extension Header Parameter "${parameter}" is missing`);
    if (recognized[parameter] && (!Object.hasOwn(protectedHeader, parameter) || protectedHeader[parameter] === void 0))
      throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
  }
  return protectedHeader.crit;
}
function validateB64(protectedHeader, extensions) {
  if (extensions.includes("b64")) {
    const b64 = protectedHeader.b64;
    if (typeof b64 != "boolean")
      throw new JWSInvalid('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    return b64;
  }
  return true;
}
function serializeJoseHeader(Err, header) {
  let serialized, parsed;
  try {
    serialized = JSON.stringify(header), parsed = JSON.parse(serialized);
  } catch (cause) {
    throw new Err("JOSE Header is not valid JSON", { cause });
  }
  if (!isObject(parsed))
    throw new Err("JOSE Header is not a JSON object");
  return [parsed, serialized];
}

// build208/server/node_modules/jose/dist/webapi/lib/key.js
var tag = (key) => key[Symbol.toStringTag];
var jwkMatchesOp = (entry, key, usage) => {
  const { alg } = entry;
  if (key.use !== void 0) {
    const expected = usage === "sign" || usage === "verify" ? "sig" : "enc";
    if (key.use !== expected)
      throw new TypeError(`Invalid key for this operation, its "use" must be "${expected}" when present`);
  }
  if (key.alg !== void 0 && key.alg !== alg)
    throw new TypeError(`Invalid key for this operation, its "alg" must be "${alg}" when present`);
  if (Array.isArray(key.key_ops)) {
    const expectedKeyOp = usage === "encrypt" || usage === "decrypt" ? entry.ops?.[usage === "encrypt" ? 0 : 1] : usage;
    if (expectedKeyOp && !key.key_ops.includes(expectedKeyOp))
      throw new TypeError(`Invalid key for this operation, its "key_ops" must include "${expectedKeyOp}" when present`);
  }
};
async function prepareKey(entry, key, usage) {
  const { alg, secret } = entry, privateKey = usage === "decrypt" || usage === "sign";
  if (secret && key instanceof Uint8Array)
    return key;
  let normalized, keyObject;
  if (isObject(key)) {
    if (normalized = normalizeJwk(key), typeof normalized.kty != "string")
      throw invalidKeyType(alg, key, secret);
    if (!(secret ? normalized.kty === "oct" && typeof normalized.k == "string" : normalized.kty !== "oct" && (privateKey ? normalized.kty === "AKP" && typeof normalized.priv == "string" || typeof normalized.d == "string" : normalized.d === void 0 && normalized.priv === void 0)))
      throw new TypeError(secret ? 'JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present' : `JSON Web Key for this operation must be a ${privateKey ? "private" : "public"} JWK`);
    if (jwkMatchesOp(entry, normalized, usage), normalized.kty === "oct")
      return decode(normalized.k);
    if (!Object.isFrozen(key)) {
      const { key_ops } = key;
      Array.isArray(key_ops) && Object.freeze(key_ops), Object.freeze(key);
    }
  } else {
    if (!isKeyLike(key))
      throw invalidKeyType(alg, key, secret);
    const expectedType = secret ? "secret" : privateKey ? "private" : "public";
    if (key.type !== expectedType && (secret || ["secret", "public", "private"].includes(key.type)))
      throw new TypeError(`${tag(key)} instances must be of type "${expectedType}" for the ${alg} algorithm`);
    if (isCryptoKey(key))
      return key;
    if (keyObject = key, keyObject.type === "secret")
      return keyObject.export();
  }
  cache ||= /* @__PURE__ */ new WeakMap();
  const cacheKey = key;
  let cached = cache.get(cacheKey);
  if (cached?.[alg])
    return cached[alg];
  if (cached || cache.set(cacheKey, cached = {}), keyObject && typeof keyObject.toCryptoKey == "function") {
    const isPublic = keyObject.type === "public", crv = nist[keyObject.asymmetricKeyDetails?.namedCurve], params = entry.resolve?.({ crv, asymmetricKeyType: keyObject.asymmetricKeyType }) ?? entry.subtle;
    return cached[alg] = keyObject.toCryptoKey(params, isPublic, entry.usages[isPublic ? 0 : 1]);
  }
  return normalized ??= keyObject.export({ format: "jwk" }), normalized.alg = alg, cached[alg] = await jwkToKey(entry, normalized);
}
var cache;
var nist = {
  __proto__: null,
  prime256v1: "P-256",
  secp384r1: "P-384",
  secp521r1: "P-521"
};
var isCryptoKey = (key) => {
  if (key?.[Symbol.toStringTag] === "CryptoKey")
    return true;
  try {
    return key instanceof CryptoKey;
  } catch {
    return false;
  }
};
var isKeyObject = (key) => key?.[Symbol.toStringTag] === "KeyObject";
var isKeyLike = (key) => isCryptoKey(key) || isKeyObject(key);
function message(msg, actual, ...types) {
  if (types.length > 2) {
    const last = types.pop();
    msg += `one of type ${types.join(", ")}, or ${last}.`;
  } else types.length === 2 ? msg += `one of type ${types[0]} or ${types[1]}.` : msg += `of type ${types[0]}.`;
  return actual == null ? msg += ` Received ${actual}` : typeof actual == "function" && actual.name ? msg += ` Received function ${actual.name}` : typeof actual == "object" && actual != null && actual.constructor?.name && (msg += ` Received an instance of ${actual.constructor.name}`), msg;
}
function invalidKeyType(alg, actual, secret) {
  const types = ["CryptoKey", "KeyObject", "JSON Web Key"];
  return secret && types.push("Uint8Array"), new TypeError(message(`Key for the ${alg} algorithm must be `, actual, ...types));
}
var unusable = (name, prop = "algorithm.name") => new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`);
function checkUsage(key, usage) {
  if (usage && !key.usages.includes(usage))
    throw new TypeError(`CryptoKey does not support this operation, its usages must include ${usage}.`);
}
function checkModulusLength(alg, key) {
  const { modulusLength } = key.algorithm;
  if (typeof modulusLength != "number" || modulusLength < 2048)
    throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
}
function checkCryptoKey(key, expected, usage) {
  const algorithm = key.algorithm;
  if (algorithm.name !== expected.name)
    throw unusable(expected.name);
  if (expected.hash && algorithm.hash?.name !== expected.hash)
    throw unusable(expected.hash, "algorithm.hash");
  if (expected.namedCurve && algorithm.namedCurve !== expected.namedCurve)
    throw unusable(expected.namedCurve, "algorithm.namedCurve");
  if (expected.length !== void 0 && algorithm.length !== expected.length)
    throw unusable(expected.length, "algorithm.length");
  checkUsage(key, usage);
}
function snapshotJwk(jwk) {
  return { __proto__: null, ...jwk };
}
function normalizeJwk(jwk) {
  const normalized = snapshotJwk(jwk);
  if (normalized.ext !== void 0 && typeof normalized.ext != "boolean")
    throw new TypeError('"ext" (Extractable) Parameter must be a boolean');
  if (normalized.key_ops !== void 0) {
    const value2 = normalized.key_ops, keyOps = Array.isArray(value2) ? [...value2] : void 0;
    if (!keyOps || keyOps.some((operation) => typeof operation != "string") || new Set(keyOps).size !== keyOps.length)
      throw new TypeError('"key_ops" (Key Operations) Parameter must be an array of unique strings');
    normalized.key_ops = keyOps;
  }
  return normalized;
}
function validateExtractableOption(extractable) {
  if (extractable !== void 0 && typeof extractable != "boolean")
    throw new TypeError('"extractable" option must be a boolean');
  return extractable;
}
async function jwkToKey(entry, jwk, extractable) {
  if (!entry.kty.includes(jwk.kty))
    throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
  const algorithm = entry.resolve?.({ kty: jwk.kty, crv: jwk.crv }) ?? entry.subtle, isPrivate = !!(jwk.d || jwk.priv), keyData = { ...jwk, ext: extractable ?? jwk.ext };
  return keyData.kty !== "AKP" && delete keyData.alg, delete keyData.use, crypto.subtle.importKey("jwk", keyData, algorithm, keyData.ext ?? !isPrivate, jwk.key_ops ?? entry.usages[isPrivate ? 1 : 0]);
}
async function rawKey(key, expected, usage, extractable = false) {
  return key instanceof Uint8Array && (key = await crypto.subtle.importKey("raw", key, expected, extractable, [usage])), checkCryptoKey(key, expected, usage), key;
}

// build208/server/node_modules/jose/dist/webapi/lib/key_descriptor.js
function table(entries) {
  const out = { __proto__: null };
  for (const alg in entries)
    out[alg] = { ...entries[alg], alg };
  return out;
}

// build208/server/node_modules/jose/dist/webapi/lib/jwe_algorithms.js
var wrap = [
  ["encrypt", "wrapKey"],
  ["decrypt", "unwrapKey"]
];
var derive = [[], ["deriveBits"]];
var none = [[], []];
function rsaes(bits) {
  return {
    kty: ["RSA"],
    mode: "key-encryption",
    subtle: { name: "RSA-OAEP", hash: `SHA-${bits}` },
    usages: wrap,
    ops: ["wrapKey", "unwrapKey"]
  };
}
function ecdh(mode) {
  return {
    kty: ["EC", "OKP"],
    mode,
    subtle: { name: "ECDH" },
    resolve: ({ kty, crv, asymmetricKeyType }) => {
      if (crv === "X25519" || asymmetricKeyType === "x25519")
        return { name: "X25519" };
      if (kty === "OKP")
        throw new JOSENotSupported('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      return { name: "ECDH", namedCurve: crv };
    },
    usages: derive,
    ops: [void 0, "deriveBits"]
  };
}
function aeskw(bits, gcm = false) {
  return {
    kty: ["oct"],
    mode: "key-wrapping",
    secret: true,
    subtle: { name: gcm ? "AES-GCM" : "AES-KW", length: bits },
    usages: none,
    ops: gcm ? ["encrypt", "decrypt"] : ["wrapKey", "unwrapKey"]
  };
}
function pbes2() {
  return {
    kty: ["oct"],
    mode: "key-wrapping",
    secret: true,
    subtle: { name: "PBKDF2" },
    usages: none,
    ops: ["deriveBits", "deriveBits"]
  };
}
var JWE = table({
  dir: {
    kty: ["oct"],
    mode: "direct-encryption",
    secret: true,
    subtle: { name: "AES-GCM" },
    usages: none,
    ops: ["encrypt", "decrypt"]
  },
  "RSA-OAEP": rsaes(1),
  "RSA-OAEP-256": rsaes(256),
  "RSA-OAEP-384": rsaes(384),
  "RSA-OAEP-512": rsaes(512),
  "ECDH-ES": ecdh("direct-key-agreement"),
  "ECDH-ES+A128KW": ecdh("key-agreement-with-key-wrapping"),
  "ECDH-ES+A192KW": ecdh("key-agreement-with-key-wrapping"),
  "ECDH-ES+A256KW": ecdh("key-agreement-with-key-wrapping"),
  A128KW: aeskw(128),
  A192KW: aeskw(192),
  A256KW: aeskw(256),
  A128GCMKW: aeskw(128, true),
  A192GCMKW: aeskw(192, true),
  A256GCMKW: aeskw(256, true),
  "PBES2-HS256+A128KW": pbes2(),
  "PBES2-HS384+A192KW": pbes2(),
  "PBES2-HS512+A256KW": pbes2()
});
var contentOps = ["encrypt", "decrypt"];
function contentEncryption(bits, cbc = false) {
  return {
    kty: ["oct"],
    secret: true,
    subtle: { name: cbc ? "AES-CBC" : "AES-GCM", length: bits },
    usages: none,
    ops: contentOps,
    cekBits: bits,
    ivBits: cbc ? 128 : 96,
    cbc
  };
}
var ENC = table({
  A128GCM: contentEncryption(128),
  A192GCM: contentEncryption(192),
  A256GCM: contentEncryption(256),
  "A128CBC-HS256": contentEncryption(256, true),
  "A192CBC-HS384": contentEncryption(384, true),
  "A256CBC-HS512": contentEncryption(512, true)
});

// build208/server/node_modules/jose/dist/webapi/lib/jws_algorithms.js
var sig = [["verify"], ["sign"]];
function hmac(bits) {
  const subtle = { name: "HMAC", hash: `SHA-${bits}` };
  return { kty: ["oct"], secret: true, subtle, signing: subtle, usages: sig };
}
function rsa(bits, saltLength) {
  const subtle = { name: saltLength ? "RSA-PSS" : "RSASSA-PKCS1-v1_5", hash: `SHA-${bits}` };
  return {
    kty: ["RSA"],
    subtle,
    signing: saltLength ? { ...subtle, saltLength } : subtle,
    usages: sig,
    minRsaBits: 2048
  };
}
function ecdsa(crv, bits) {
  return {
    kty: ["EC"],
    crv,
    subtle: { name: "ECDSA", namedCurve: crv },
    signing: { name: "ECDSA", hash: `SHA-${bits}` },
    usages: sig
  };
}
function eddsa() {
  const subtle = { name: "Ed25519" };
  return {
    kty: ["OKP"],
    crv: "Ed25519",
    subtle,
    signing: subtle,
    usages: sig
  };
}
function mldsa(bits) {
  const subtle = { name: `ML-DSA-${bits}` };
  return {
    kty: ["AKP"],
    subtle,
    signing: subtle,
    usages: sig
  };
}
var JWS = table({
  HS256: hmac(256),
  HS384: hmac(384),
  HS512: hmac(512),
  RS256: rsa(256),
  RS384: rsa(384),
  RS512: rsa(512),
  PS256: rsa(256, 32),
  PS384: rsa(384, 48),
  PS512: rsa(512, 64),
  ES256: ecdsa("P-256", 256),
  ES384: ecdsa("P-384", 384),
  ES512: ecdsa("P-521", 512),
  EdDSA: eddsa(),
  Ed25519: eddsa(),
  "ML-DSA-44": mldsa(44),
  "ML-DSA-65": mldsa(65),
  "ML-DSA-87": mldsa(87)
});
function jwsAlgorithm(alg) {
  const entry = typeof alg == "string" ? JWS[alg] : void 0;
  if (!entry)
    throw new JOSENotSupported(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  return entry;
}

// build208/server/node_modules/jose/dist/webapi/lib/jwt_claims_set.js
var epoch = (date) => Math.floor(date.getTime() / 1e3);
var multipliers = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
  y: 31557600
};
var REGEX = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
function invalidDuration() {
  throw new TypeError("Invalid time period format");
}
function secs(str) {
  typeof str != "string" && invalidDuration();
  const matched = REGEX.exec(str);
  (!matched || matched[4] && matched[1]) && invalidDuration();
  const value2 = parseFloat(matched[2]), numericDate2 = Math.round(value2 * multipliers[matched[3][0].toLowerCase()]);
  return Number.isFinite(numericDate2) || invalidDuration(), matched[1] === "-" || matched[4] === "ago" ? -numericDate2 : numericDate2;
}
function validateInput(label, input) {
  if (!Number.isFinite(input))
    throw new TypeError(`Invalid ${label} input`);
  return input;
}
function validateStringClaim(claim, value2) {
  if (typeof value2 != "string")
    throw new TypeError(`"${claim}" claim must be a string`);
}
function validateAudienceClaim(value2) {
  if (typeof value2 != "string" && (!Array.isArray(value2) || Array.from(value2).some((member) => typeof member != "string")))
    throw new TypeError('"aud" claim must be a string or an array of strings');
}
function numericDate(value2, label) {
  return typeof value2 == "number" ? validateInput(label, value2) : value2 instanceof Date ? validateInput(label, epoch(value2)) : epoch(/* @__PURE__ */ new Date()) + secs(value2);
}
var producerPayloads;
function producerPayload(producer) {
  return producerPayloads.get(producer);
}
function jwtData(producer) {
  const payload = producerPayload(producer);
  for (const claim of ["iat", "nbf", "exp"]) {
    const value2 = payload[claim];
    if (typeof value2 == "number" && !Number.isFinite(value2))
      throw new TypeError(`"${claim}" claim must be a finite number`);
  }
  return encoder.encode(JSON.stringify(payload));
}
var JWTClaimsBuilder = class {
  constructor(payload = {}) {
    if (!isObject(payload))
      throw new TypeError("JWT Claims Set MUST be an object");
    (producerPayloads ||= /* @__PURE__ */ new WeakMap()).set(this, structuredClone(payload));
  }
  setIssuer(value2) {
    return validateStringClaim("iss", value2), producerPayload(this).iss = value2, this;
  }
  setSubject(value2) {
    return validateStringClaim("sub", value2), producerPayload(this).sub = value2, this;
  }
  setAudience(value2) {
    return validateAudienceClaim(value2), producerPayload(this).aud = value2, this;
  }
  setJti(value2) {
    return validateStringClaim("jti", value2), producerPayload(this).jti = value2, this;
  }
  setNotBefore(value2) {
    return producerPayload(this).nbf = numericDate(value2, "setNotBefore"), this;
  }
  setExpirationTime(value2) {
    return producerPayload(this).exp = numericDate(value2, "setExpirationTime"), this;
  }
  setIssuedAt(value2) {
    const payload = producerPayload(this);
    return value2 === void 0 ? payload.iat = epoch(/* @__PURE__ */ new Date()) : typeof value2 == "string" ? payload.iat = validateInput("setIssuedAt", epoch(/* @__PURE__ */ new Date()) + secs(value2)) : payload.iat = numericDate(value2, "setIssuedAt"), this;
  }
};

// build208/server/node_modules/jose/dist/webapi/lib/jws_sign.js
async function createSignature(input, key, rejectUnencoded) {
  let [payload, protectedHeader, unprotectedHeader, crit] = input, protectedHeaderString = "";
  if (protectedHeader !== void 0) {
    const normalized = serializeJoseHeader(JWSInvalid, protectedHeader);
    protectedHeader = normalized[0], protectedHeaderString = encode2(normalized[1]);
  }
  if (unprotectedHeader !== void 0 && (unprotectedHeader = serializeJoseHeader(JWSInvalid, unprotectedHeader)[0]), !protectedHeader && !unprotectedHeader)
    throw new JWSInvalid("either setProtectedHeader or setUnprotectedHeader must be called before #sign()");
  if (!isDisjoint(protectedHeader, unprotectedHeader))
    throw new JWSInvalid("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  const joseHeader = { ...protectedHeader, ...unprotectedHeader };
  validateCritDuplicates(JWSInvalid, protectedHeader);
  const b64 = validateB64(protectedHeader, validateCrit(JWSInvalid, JWS_RECOGNIZED, crit, protectedHeader, joseHeader));
  b64 || rejectUnencoded?.();
  const { alg } = joseHeader;
  if (typeof alg != "string" || !alg)
    throw new JWSInvalid('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  const entry = jwsAlgorithm(alg);
  let payloadS = "", payloadB = payload, data;
  if (b64) {
    const encoded = input[4];
    encoded ? (payloadS = encoded[0] ??= encode2(payload), payloadB = encoded[1] ??= encode(payloadS)) : (payloadS = encode2(payload), data = encoder.encode(`${protectedHeaderString}.${payloadS}`));
  }
  data ??= concat(encode(protectedHeaderString), encode("."), payloadB);
  const k = await rawKey(await prepareKey(entry, key, "sign"), entry.subtle, "sign");
  entry.minRsaBits && checkModulusLength(entry.alg, k);
  const jws = {
    signature: encode2(new Uint8Array(await crypto.subtle.sign(entry.signing, k, data))),
    payload: payloadS
  };
  return protectedHeader && (jws.protected = protectedHeaderString), unprotectedHeader && (jws.header = unprotectedHeader), [jws, b64];
}
async function createCompactSignature(payload, protectedHeader, crit, key, rejectUnencoded) {
  const [jws] = await createSignature([payload, protectedHeader, void 0, crit], key, rejectUnencoded);
  return `${jws.protected}.${jws.payload}.${jws.signature}`;
}

// build208/server/node_modules/jose/dist/webapi/jwt/sign.js
var SignJWT_base = JWTClaimsBuilder;
var SignJWT = class extends SignJWT_base {
  #protectedHeader;
  setProtectedHeader(protectedHeader) {
    return assertNotSet(this.#protectedHeader, "setProtectedHeader"), this.#protectedHeader = protectedHeader, this;
  }
  async sign(key, options) {
    return createCompactSignature(jwtData(this), this.#protectedHeader, options?.crit, key, () => {
      throw new JWTInvalid("JWTs MUST NOT use unencoded payload");
    });
  }
};

// build208/server/node_modules/jose/dist/webapi/lib/key_algorithm.js
var algArgument = '"alg" (Algorithm)';
function unsupportedAlg(source = 'JWK "alg" (Algorithm) Parameter') {
  throw new JOSENotSupported(`Invalid or unsupported ${source} value`);
}
function keyAlgorithm(alg, source) {
  return (typeof alg == "string" ? JWS[alg] ?? JWE[alg] : void 0) ?? unsupportedAlg(source);
}

// build208/server/node_modules/jose/dist/webapi/lib/asn1.js
var bytesEqual = (a, b) => {
  if (a.byteLength !== b.length)
    return false;
  for (let i = 0; i < a.byteLength; i++)
    if (a[i] !== b[i])
      return false;
  return true;
};
var createASN1State = (data) => ({ data, pos: 0 });
var readByte = (state) => {
  const byte = state.data[state.pos++];
  if (byte === void 0)
    throw new Error("Unexpected end of ASN.1 input");
  return byte;
};
var parseLength = (state) => {
  const first = readByte(state);
  if (first & 128) {
    const lengthOfLen = first & 127;
    let length = 0;
    for (let i = 0; i < lengthOfLen; i++)
      length = length << 8 | readByte(state);
    return length;
  }
  return first;
};
var expectTag = (state, expectedTag, errorMessage) => {
  if (readByte(state) !== expectedTag)
    throw new Error(errorMessage);
};
var getSubarray = (state, length) => {
  if (length < 0 || state.pos + length > state.data.length)
    throw new Error("Unexpected end of ASN.1 input");
  const result = state.data.subarray(state.pos, state.pos + length);
  return state.pos += length, result;
};
var parseAlgorithmOID = (state) => {
  expectTag(state, 6, "Expected algorithm OID");
  const oidLen = parseLength(state);
  return getSubarray(state, oidLen);
};
function parseKeyHeader(state, keyFormat) {
  if (expectTag(state, 48, `Invalid ${keyFormat === "spki" ? "SPKI" : "PKCS#8"} structure`), parseLength(state), keyFormat === "pkcs8") {
    expectTag(state, 2, "Expected version field");
    const length = parseLength(state);
    state.pos += length;
  }
  expectTag(state, 48, "Expected algorithm identifier"), parseLength(state);
}
var parseECAlgorithmIdentifier = (state) => {
  const algOid = parseAlgorithmOID(state);
  if (bytesEqual(algOid, [43, 101, 110]))
    return "X25519";
  if (!bytesEqual(algOid, [42, 134, 72, 206, 61, 2, 1]))
    throw new Error("Unsupported key algorithm");
  expectTag(state, 6, "Expected curve OID");
  const curveOidLen = parseLength(state), curveOid = getSubarray(state, curveOidLen);
  if (bytesEqual(curveOid, [42, 134, 72, 206, 61, 3, 1, 7]))
    return "P-256";
  if (bytesEqual(curveOid, [43, 129, 4, 0, 34]))
    return "P-384";
  if (bytesEqual(curveOid, [43, 129, 4, 0, 35]))
    return "P-521";
  throw new Error("Unsupported named curve");
};
var genericImport = async (keyFormat, keyData, alg, options) => {
  const extractable = validateExtractableOption(options?.extractable), entry = keyAlgorithm(alg, algArgument);
  entry.secret && unsupportedAlg(algArgument);
  const isPublic = keyFormat === "spki";
  let algorithm;
  if (entry.resolve)
    try {
      const state = createASN1State(keyData);
      parseKeyHeader(state, keyFormat), algorithm = entry.resolve({ crv: parseECAlgorithmIdentifier(state) });
    } catch {
      throw new JOSENotSupported("Invalid or unsupported key format");
    }
  else
    algorithm = entry.subtle;
  return crypto.subtle.importKey(keyFormat, keyData, algorithm, extractable ?? isPublic, entry.usages[isPublic ? 0 : 1]);
};
var processPEMData = (pem, pattern) => decodeBase64(pem.replace(pattern, ""));
var fromPKCS8 = (pem, alg, options) => {
  const keyData = processPEMData(pem, /(?:-----(?:BEGIN|END) PRIVATE KEY-----|\s)/g);
  return genericImport("pkcs8", keyData, alg, options);
};

// build208/server/node_modules/jose/dist/webapi/key/import.js
async function importPKCS8(pkcs8, alg, options) {
  if (typeof pkcs8 != "string" || pkcs8.indexOf("-----BEGIN PRIVATE KEY-----") !== 0)
    throw new TypeError('"pkcs8" must be PKCS#8 formatted string');
  return fromPKCS8(pkcs8, alg, options);
}

// build208/server/gateway208.mjs
var LIMIT = 16 * 1024 * 1024;
var HEX = /^[a-f0-9]{64}$/;
var ID = /^[-a-zA-Z0-9]{1,100}$/;
var fail = (message3, status = 400, code) => {
  const e = new Error(message3);
  e.status = status;
  e.code = code;
  e.expose208 = true;
  throw e;
};
var object = (x) => !!x && typeof x === "object" && !Array.isArray(x);
var stable = (x) => JSON.stringify(x, (_, v) => object(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v);
var equal = (a, b) => stable(a) === stable(b);
var sha = async (text) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (x) => x.toString(16).padStart(2, "0")).join("");
var matches = (s) => (s.fixtures || []).flat(2).concat(s.cup?.rounds?.flat() || [], s.cup?.thirdPlace26 ? [s.cup.thirdPlace26] : [], s.playoffs || []);
function validateLeague208(data, head) {
  if (!object(data) || data.schema !== 2 || !object(data.images) || Object.keys(data.images).length || !Array.isArray(data.seasons) || !data.seasons.length || data.seasons.length > 200) fail("Formato del torneo inv\xE1lido.");
  if (!Array.isArray(head.assets) || head.assets.length > 1e3 || new Set(head.assets).size !== head.assets.length || head.assets.some((x) => !HEX.test(x)) || !object(head.imageRefs) || Object.keys(head.imageRefs).length > 1e3 || Object.entries(head.imageRefs).some(([id, hash]) => !ID.test(id) || !head.assets.includes(hash))) fail("Referencias de im\xE1genes inv\xE1lidas.");
  const ids = /* @__PURE__ */ new Set(), image = (id) => id == null || typeof id === "string" && Object.hasOwn(head.imageRefs, id);
  for (const s of data.seasons) {
    if (!object(s) || !ID.test(s.id) || ids.has(s.id) || typeof s.name !== "string" || !s.name.trim() || s.name.length > 100 || typeof s.closed !== "boolean" || !object(s.teams) || !object(s.teamMeta) || !Array.isArray(s.groups) || s.groups.length !== 3 || s.groups.some((g) => !Array.isArray(g) || g.length !== 12)) fail("Temporada o equipos inv\xE1lidos.");
    ids.add(s.id);
    if (["drafts", "mediaDraft", "matchConflicts23"].some((k) => Object.hasOwn(s, k))) fail("Los borradores privados no se publican.");
    const teams = s.groups.flat(), teamSet = new Set(teams);
    if (teamSet.size !== 36 || teams.some((t) => !ID.test(t) || typeof s.teams[t] !== "string" || !s.teams[t].trim() || s.teams[t].length > 100)) fail("Equipos inv\xE1lidos.");
    if (!object(s.penalties) || Object.entries(s.penalties).some(([id, n]) => !teamSet.has(id) || !Number.isInteger(n) || n < 0)) fail("Sanciones inv\xE1lidas.");
    if (s.activeCompetitions !== void 0 && (!Array.isArray(s.activeCompetitions) || s.activeCompetitions.length !== 4 || s.activeCompetitions.some((x) => typeof x !== "boolean"))) fail("Competiciones inv\xE1lidas.");
    if (!Array.isArray(s.fixtures) || s.fixtures.length !== 3 || s.fixtures.some((d) => !Array.isArray(d) || d.length !== 22 || d.some((r) => !Array.isArray(r) || r.length !== 6))) fail("Calendario inv\xE1lido.");
    for (let d = 0; d < 3; d++) for (let r = 0; r < 22; r++) for (const m of s.fixtures[d][r]) if (m.h !== null && !s.groups[d].includes(m.h) || m.w !== null && !s.groups[d].includes(m.w)) fail("El encuentro contiene equipos de otra divisi\xF3n.");
    if (s.cup && (!Array.isArray(s.cup.rounds) || s.cup.rounds.length < 1 || s.cup.rounds.length > 4 || s.cup.rounds.some((r, i) => !Array.isArray(r) || r.length !== 8 / 2 ** i))) fail("Copa inv\xE1lida.");
    if (s.playoffs && (!Array.isArray(s.playoffs) || s.playoffs.length > 2)) fail("Repechajes inv\xE1lidos.");
    const mids = /* @__PURE__ */ new Set();
    for (const m of matches(s)) {
      if (!object(m) || !ID.test(m.id) || mids.has(m.id) || m.h !== null && !teamSet.has(m.h) || m.w !== null && !teamSet.has(m.w) || m.h !== null && m.h === m.w) fail("Partido inv\xE1lido.");
      mids.add(m.id);
      if (m.a === null !== (m.b === null) || [m.a, m.b].some((n) => n !== null && (!Number.isInteger(n) || n < 0 || n > 99)) || (m.h === null || m.w === null) && m.a !== null) fail("Resultado inv\xE1lido.");
      if (m.winner && (![m.h, m.w].includes(m.winner) || m.a === null)) fail("Ganador inv\xE1lido.");
      for (const field of ["scorers", "assists"]) {
        const lists = m[field] || [[], []];
        if (!Array.isArray(lists) || lists.length !== 2 || lists.some((l, i) => !Array.isArray(l) || l.some((p) => typeof p.name !== "string" || !p.name.trim() || p.name.length > 100 || !Number.isInteger(p.goals) || p.goals < 1) || l.reduce((n, p) => n + p.goals, 0) > (i ? m.b : m.a))) fail("Goles o asistencias inv\xE1lidos.");
      }
    }
    const players = /* @__PURE__ */ new Set();
    for (const t of teams) {
      const meta = s.teamMeta[t];
      if (!object(meta) || !image(meta.image) || !Array.isArray(meta.players) || meta.players.length > 200) fail("Plantel inv\xE1lido.");
      for (const p of meta.players) {
        if (!object(p) || !ID.test(p.id) || players.has(p.id) || typeof p.name !== "string" || !p.name.trim() || p.name.length > 80 || !image(p.image) || typeof p.active !== "boolean" || !(p.number === null || Number.isInteger(p.number) && p.number >= 0 && p.number <= 99) || !["", "PT", "DFC", "LI", "LD", "MCD", "MC", "MI", "MD", "MO", "SD", "EI", "ED", "DC"].includes(p.position)) fail("Jugador inv\xE1lido.");
        players.add(p.id);
      }
    }
    for (const n of s.reports || []) if (n.media && (!object(n.media) || n.media.kind !== "image" || !head.assets.includes(n.media.asset22) || Object.hasOwn(n.media, "data"))) fail("Noticia inv\xE1lida.");
    if (s.closed && (!s.summary || !Array.isArray(s.summary.champions) || s.summary.champions.length !== 3 || !Array.isArray(s.summary.movements))) fail("Historial inv\xE1lido.");
  }
  return data;
}
function validateEditor208(previous, next, oldHead, newHead, isOwner) {
  validateLeague208(next, newHead);
  if (isOwner) return;
  if (!previous) fail("El due\xF1o debe publicar primero el torneo.", 403);
  for (const key of /* @__PURE__ */ new Set([...Object.keys(previous), ...Object.keys(next)])) if (!["seasons", "images"].includes(key) && !equal(previous[key], next[key])) fail("Este ajuste est\xE1 reservado al due\xF1o.", 403);
  if (!equal(previous.seasons.map((s) => s.id), next.seasons.map((s) => s.id))) fail("Solo el due\xF1o puede crear, eliminar o reordenar temporadas.", 403);
  const protectedFields = ["id", "name", "closed", "groups", "activeCompetitions", "summary", "medalRecords25", "cupQualification23", "cupCutoffPML"];
  for (let i = 0; i < previous.seasons.length; i++) {
    const old = previous.seasons[i], s = next.seasons[i];
    if (old.closed) {
      if (!equal(old, s)) fail("No se puede modificar una temporada archivada.", 403);
      continue;
    }
    for (const k of protectedFields) if (!equal(old[k], s[k])) fail("La configuraci\xF3n y el cierre de temporadas corresponden al due\xF1o.", 403);
    for (let d = 0; d < 3; d++) if (old.activeCompetitions?.[d] === false && !equal(old.fixtures[d], s.fixtures[d])) fail("La competici\xF3n est\xE1 desactivada.", 403);
    if (old.activeCompetitions?.[3] === false && !equal(old.cup, s.cup)) fail("La copa est\xE1 desactivada.", 403);
    const oldMedia = (old.reports || []).filter((n) => n.media), newMedia = (s.reports || []).filter((n) => n.media);
    if (!equal(oldMedia, newMedia)) fail("Us\xE1 Publicar imagen para publicar una noticia.", 403);
  }
  const archived = JSON.stringify(previous.seasons.filter((s) => s.closed));
  for (const [id, hash] of Object.entries(oldHead.imageRefs || {})) if (archived.includes(JSON.stringify(id)) && newHead.imageRefs[id] !== hash) fail("No se pueden reemplazar im\xE1genes del historial archivado.", 403);
}
function decode2(v) {
  if (v.stringValue !== void 0) return v.stringValue;
  if (v.integerValue !== void 0) return Number(v.integerValue);
  if (v.doubleValue !== void 0) return v.doubleValue;
  if (v.booleanValue !== void 0) return v.booleanValue;
  if (v.nullValue !== void 0) return null;
  if (v.timestampValue !== void 0) return v.timestampValue;
  if (v.arrayValue) return (v.arrayValue.values || []).map(decode2);
  if (v.mapValue) return fields(v.mapValue.fields || {});
  return null;
}
var fields = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, decode2(v)]));
function value(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(value) } };
  return { mapValue: { fields: encode3(v) } };
}
var encode3 = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, value(v)]));
var tokenCache = null;
async function serviceToken(env) {
  let sa;
  try {
    sa = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT || "");
  } catch {
    fail("Falta activar la protecci\xF3n de Firebase en el servidor.", 503);
  }
  if (sa.project_id !== env.FIREBASE_PROJECT_ID || !sa.client_email || !sa.private_key) fail("La credencial del servidor no corresponde a este proyecto.", 503);
  if (tokenCache?.email === sa.client_email && tokenCache.expires > Date.now() + 6e4) return tokenCache.token;
  const key = await importPKCS8(sa.private_key, "RS256");
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/datastore" }).setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(sa.client_email).setAudience("https://oauth2.googleapis.com/token").setIssuedAt().setExpirationTime("1h").sign(key);
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }), signal: AbortSignal.timeout(15e3) });
  const d = await res.json();
  if (!res.ok || !d.access_token) fail("No se pudo autorizar el guardado protegido. Revis\xE1 la credencial del servidor.", 503);
  tokenCache = { email: sa.client_email, token: d.access_token, expires: Date.now() + Math.min(Number(d.expires_in) || 3600, 3600) * 1e3 };
  return tokenCache.token;
}
async function callFS(env, token, path, body) {
  const root = "https://firestore.googleapis.com/v1/projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents";
  const r = await fetch(root + path, { method: body ? "POST" : "GET", headers: { Authorization: "Bearer " + token, ...body ? { "Content-Type": "application/json" } : {} }, ...body ? { body: JSON.stringify(body) } : {}, signal: AbortSignal.timeout(2e4) });
  if (!r.ok) {
    if (r.status === 409 || r.status === 412) fail("Otro editor public\xF3 cambios. Se integrar\xE1n antes de reintentar.", 409, "cloud/conflict");
    fail("Firebase no pudo completar el guardado protegido.", 503);
  }
  return r.json();
}
async function currentLeague(env, token) {
  const doc = await callFS(env, token, "/leagues/main/data/head"), h = fields(doc.fields);
  if (!Number.isInteger(h.pages) || h.pages < 1 || h.pages > 256) fail("Formato de nube incompatible.", 503);
  const chunks = [];
  for (let start = 0; start < h.pages; start += 4) {
    const list = await Promise.all(Array.from({ length: Math.min(4, h.pages - start) }, async (_, j) => {
      const i = start + j, p = fields((await callFS(env, token, "/leagues/main/data/" + encodeURIComponent(h.revision + "-" + i))).fields);
      if (p.revision !== h.revision || p.index !== i || typeof p.text !== "string") fail("La versi\xF3n compartida est\xE1 incompleta.", 409);
      return p.text;
    }));
    chunks.push(...list);
  }
  const text = chunks.join("");
  if (await sha(text) !== h.hash) fail("No se pudo verificar el torneo compartido.", 503);
  return { doc, head: h, data: JSON.parse(text) };
}
async function gateway208(path, body, user, { env, request, moderator: moderator2 }) {
  if (path === "/league/capabilities" && request.method === "GET") return { version: "2.0.8", configured: !!env.FIREBASE_SERVICE_ACCOUNT };
  if (request.method !== "POST" || !["/league/check", "/league/publish"].includes(path)) fail("Ruta inexistente.", 404);
  const owner = user.sub === env.OWNER_UID;
  if (!owner && !await moderator2(request, env, user.sub)) fail("No ten\xE9s permiso para publicar cambios del torneo.", 403);
  const token = await serviceToken(env);
  if (path === "/league/check") {
    if (!owner) fail("Solo el due\xF1o puede comprobar la configuraci\xF3n.", 403);
    await callFS(env, token, "/leagues/main/data/head");
    return { ready: true, version: "2.0.8" };
  }
  if (typeof body.text !== "string" || new TextEncoder().encode(body.text).length > LIMIT || !object(body.head) || typeof body.base !== "string") fail("Publicaci\xF3n inv\xE1lida o demasiado grande.");
  if (await sha(body.text) !== body.head.hash) fail("La publicaci\xF3n est\xE1 incompleta.");
  const current = await currentLeague(env, token);
  if (current.head.revision !== body.base) fail("Otro editor public\xF3 cambios.", 409, "cloud/conflict");
  let data;
  try {
    data = JSON.parse(body.text);
  } catch {
    fail("El torneo no es v\xE1lido.");
  }
  validateEditor208(current.data, data, current.head, body.head, owner);
  const previous = new Set(current.head.assets || []), missing = body.head.assets.filter((h) => !previous.has(h));
  for (let i = 0; i < missing.length; i += 4) await Promise.all(missing.slice(i, i + 4).map(async (key) => {
    const a = fields((await callFS(env, token, "/leagues/main/assets/" + key)).fields);
    if (typeof a.data !== "string" || a.data.length > 4e5 || !/^data:image\/(png|jpeg|webp);base64,/.test(a.data) || await sha(a.data) !== key) fail("No se pudo verificar una imagen del torneo.");
  }));
  const revision = crypto.randomUUID(), pages = [];
  for (let i = 0; i < body.text.length; ) {
    let end = Math.min(i + 18e4, body.text.length);
    if (end < body.text.length && /[\uD800-\uDBFF]/.test(body.text[end - 1])) end--;
    pages.push(body.text.slice(i, end));
    i = end;
  }
  const prefix = "projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents/leagues/main/data/";
  for (let i = 0; i < pages.length; i += 4) await callFS(env, token, ":commit", { writes: pages.slice(i, i + 4).map((text, j) => ({ update: { name: prefix + revision + "-" + (i + j), fields: encode3({ revision, index: i + j, text }) }, currentDocument: { exists: false }, updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }] })) });
  const head = { format: 22, revision, pages: pages.length, hash: body.head.hash, assets: body.head.assets, imageRefs: body.head.imageRefs, author: user.sub };
  await callFS(env, token, ":commit", { writes: [{ update: { name: prefix + "head", fields: encode3(head) }, currentDocument: { updateTime: current.doc.updateTime }, updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }] }] });
  return { head };
}

// build208/server/worker-core.mjs
var __defProp = Object.defineProperty;
var __name = (target, value2) => __defProp(target, "name", { value: value2, configurable: true });
var GameError = class extends Error {
  static {
    __name(this, "GameError");
  }
  constructor(message22, status = 400) {
    super(message22);
    this.status = status;
  }
};
function dateAR(now = Date.now()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(new Date(now));
  const x = Object.fromEntries(f.map((p) => [p.type, p.value]));
  return { day: `${x.year}-${x.month}-${x.day}`, weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(x.weekday) };
}
__name(dateAR, "dateAR");
function available(kind, now = Date.now()) {
  const d = dateAR(now).weekday;
  return kind === "mines" ? [1, 2].includes(d) : kind === "penalties" ? [3, 4].includes(d) : false;
}
__name(available, "available");
function randomInt(n) {
  const range = 4294967296, limit = range - range % n;
  let x;
  do {
    x = crypto.getRandomValues(new Uint32Array(1))[0];
  } while (x >= limit);
  return x % n;
}
__name(randomInt, "randomInt");
function createGame(kind, rng = randomInt) {
  if (kind === "mines") {
    const board = [...Array(15).fill(1), ...Array(10).fill(2), ...Array(5).fill(5), "x2", "x4", "x6", "mine", "mine", "mine"];
    for (let i = board.length - 1; i > 0; i--) {
      const j = rng(i + 1);
      [board[i], board[j]] = [board[j], board[i]];
    }
    return { secret: board, state: { revealed: [], total: 0, mines: 0 }, status: "active", payout: 0 };
  }
  if (kind === "penalties") return { secret: Array.from({ length: 5 }, () => rng(3)), state: { shots: [], goals: 0 }, status: "active", payout: 0 };
  throw new GameError("Juego inexistente.");
}
__name(createGame, "createGame");
function playGame(g, action) {
  if (g.status !== "active") throw new GameError("La partida ya termin\xF3.", 409);
  const next = structuredClone(g), s = next.state;
  if (g.kind === "mines") {
    if (action.type === "cashout") {
      next.status = "won";
      next.payout = s.total;
      return next;
    }
    const i = action.cell;
    if (action.type !== "reveal" || !Number.isInteger(i) || i < 0 || i >= 36) throw new GameError("Eleg\xED una casilla v\xE1lida.");
    if (s.revealed.includes(i)) throw new GameError("Esa casilla ya est\xE1 descubierta.", 409);
    s.revealed.push(i);
    const cell = g.secret[i];
    if (cell === "mine") {
      s.mines++;
      if (s.mines === 3) {
        s.total = 0;
        next.status = "lost";
      }
    } else if (typeof cell === "string") s.total *= Number(cell.slice(1));
    else s.total += cell;
    if (next.status === "active" && s.revealed.length === 36) {
      next.status = "won";
      next.payout = s.total;
    }
  } else {
    if (action.type !== "shoot" || !Number.isInteger(action.direction) || action.direction < 0 || action.direction > 2) throw new GameError("Eleg\xED izquierda, centro o derecha.");
    const keeper = g.secret[s.shots.length], goal = action.direction !== keeper;
    s.shots.push({ direction: action.direction, keeper, goal });
    if (goal) s.goals++;
    if (s.shots.length === 5) {
      next.payout = [0, 0, 10, 25, 50, 100][s.goals];
      next.status = next.payout ? "won" : "lost";
    }
  }
  return next;
}
__name(playGame, "playGame");
function publicGame(row) {
  if (!row) return null;
  const secret = typeof row.secret === "string" ? JSON.parse(row.secret) : row.secret;
  const state = typeof row.state === "string" ? JSON.parse(row.state) : row.state;
  const out = { id: row.id, kind: row.kind, day: row.day, status: row.status, version: row.version, state, payout: row.payout };
  if (row.kind === "mines") out.cells = secret.map((v, i) => state.revealed.includes(i) || row.status !== "active" ? v : null);
  return out;
}
__name(publicGame, "publicGame");
async function firestore(request, env, path) {
  const r = await fetch("https://firestore.googleapis.com/v1/projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents/" + path, { headers: { Authorization: request.headers.get("Authorization") || "" }, signal: AbortSignal.timeout(12e3) });
  if (!r.ok) throw new GameError("No se pudo verificar la liga en Firebase.", 503);
  return (await r.json()).fields;
}
__name(firestore, "firestore");
var cachedLeague = null;
async function league(request, env) {
  const h = await firestore(request, env, "leagues/main/data/head");
  const revision = h.revision?.stringValue, n = Number(h.pages?.integerValue);
  if (!revision || !Number.isInteger(n) || n < 1 || n > 256) throw new GameError("La liga no tiene un formato v\xE1lido.", 503);
  if (cachedLeague?.revision === revision && cachedLeague.hash === h.hash?.stringValue) return cachedLeague.data;
  let text = "";
  for (let offset = 0; offset < n; offset += 6) {
    const pages = await Promise.all(Array.from({ length: Math.min(6, n - offset) }, async (_, j) => {
      const i = offset + j, p = await firestore(request, env, "leagues/main/data/" + encodeURIComponent(revision + "-" + i));
      if (p.revision?.stringValue !== revision || Number(p.index?.integerValue) !== i) throw new GameError("La liga est\xE1 actualiz\xE1ndose.", 409);
      return p.text?.stringValue || "";
    }));
    text += pages.join("");
  }
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, "0")).join("");
  if (hash !== h.hash?.stringValue) throw new GameError("No se pudo verificar la liga.", 503);
  cachedLeague = { revision, hash, data: JSON.parse(text) };
  return cachedLeague.data;
}
__name(league, "league");
async function moderator(request, env, uid) {
  if (uid === env.OWNER_UID) return true;
  try {
    return (await firestore(request, env, "roles/" + encodeURIComponent(uid))).role?.stringValue === "moderator";
  } catch {
    return false;
  }
}
__name(moderator, "moderator");
function fixtures(s) {
  const out = [];
  for (let d = 0; d < 3; d++) {
    if (s.activeCompetitions?.[d] === false) continue;
    (s.fixtures?.[d] || []).forEach((round, r) => round.forEach((m) => out.push({ ...m, competition: d, round: r + 1 })));
  }
  if (s.activeCompetitions?.[3] !== false) (s.cup?.rounds || []).forEach((round, r) => round.forEach((m) => out.push({ ...m, competition: "cup", round: r + 1 })));
  return out.filter((m) => m.id && s.teams?.[m.h] && s.teams?.[m.w] && m.h !== m.w).map((m) => ({ ...m, home: s.teams[m.h], away: s.teams[m.w] }));
}
__name(fixtures, "fixtures");
var validID = /* @__PURE__ */ __name((id) => typeof id === "string" && /^[-a-zA-Z0-9]{16,64}$/.test(id), "validID");
var publicPost = /* @__PURE__ */ __name((p) => ({ id: p.id, uid: p.uid, author: p.author, season: p.season, cost: p.cost, status: p.status, version: p.version, content: JSON.parse(p.payload), reason: p.reason, createdAt: p.created_at, updatedAt: p.updated_at }), "publicPost");
function validate(s, p, complete = false) {
  if (!p || typeof p !== "object" || Array.isArray(p)) throw new GameError("Noticia inv\xE1lida.");
  const title = typeof p.title === "string" ? p.title.trim() : "", body = typeof p.body === "string" ? p.body.trim() : "", division = String(p.division ?? "general"), team = typeof p.team === "string" ? p.team : "general", image = typeof p.image === "string" ? p.image : "";
  if (title.length > 200 || body.length > 6e3) throw new GameError("El t\xEDtulo o el texto superan el l\xEDmite.");
  if (!["general", "0", "1", "2", "cup"].includes(division)) throw new GameError("Divisi\xF3n inv\xE1lida.");
  if (division !== "general" && s.activeCompetitions?.[division === "cup" ? 3 : Number(division)] === false) throw new GameError("Esa competici\xF3n est\xE1 desactivada.", 409);
  const groups = (s.groups || []).filter((_, d) => s.activeCompetitions?.[d] !== false);
  if (team !== "general" && (!groups.flat().includes(team) || division !== "general" && division !== "cup" && !s.groups[Number(division)]?.includes(team))) throw new GameError("El equipo no pertenece a una divisi\xF3n activa.");
  if (image) {
    const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
    if (!m || image.length > 14e5) throw new GameError("Eleg\xED una imagen JPG, PNG o WebP de hasta 1 MB.");
    let bytes;
    try {
      bytes = atob(m[2]);
    } catch {
      throw new GameError("Imagen inv\xE1lida.");
    }
    const ok = m[1] === "jpeg" ? bytes.startsWith("\xFF\xD8\xFF") : m[1] === "png" ? bytes.startsWith("\x89PNG\r\n\n") : bytes.startsWith("RIFF") && bytes.slice(8, 12) === "WEBP";
    if (!ok) throw new GameError("Imagen inv\xE1lida.");
  }
  if (complete && !title) throw new GameError("Complet\xE1 el t\xEDtulo.");
  if (complete && !image) throw new GameError("Eleg\xED una imagen.");
  return { title, body, division, team, image };
}
__name(validate, "validate");
function newsCursor208(request, mine) {
  const value2 = new URL(request.url).searchParams.get("before");
  if (!value2) return null;
  const parts = value2.split(":");
  if (parts.length !== 3 || !["0", "1"].includes(parts[0]) || !/^\d{1,16}$/.test(parts[1]) || !validID(parts[2])) throw new GameError("P\xE1gina inv\xE1lida.");
  return { draft: Number(parts[0]), time: Number(parts[1]), id: parts[2] };
}
function newsPage208(rows, mine) {
  const page = rows.slice(0, 10), last = page.at(-1);
  return { posts: page.map(publicPost), next: rows.length > 10 ? [mine && last.status === "draft" ? 1 : 0, last.created_at, last.id].join(":") : null };
}
async function posts(path, body, user, { request, env, db, now }) {
  const uid = user.sub, q = /* @__PURE__ */ __name((sql, ...v) => db.prepare(sql).bind(...v), "q"), method = request.method;
  const reading = ["/posts/mine", "/posts/feed", "/posts/queue"].includes(path);
  if (method !== (reading ? "GET" : "POST")) throw new GameError("M\xE9todo no permitido.", 405);
  if (path === "/posts/mine") {
    const cursor = newsCursor208(request, true);
    const where = cursor ? " AND ((status='draft')<? OR ((status='draft')=? AND (created_at<? OR (created_at=? AND id<?))))" : "";
    const args = cursor ? [uid, cursor.draft, cursor.draft, cursor.time, cursor.time, cursor.id] : [uid];
    const rows = (await q("SELECT * FROM news_posts WHERE uid=? AND id NOT IN (SELECT post_id FROM news_withdrawals)" + where + " ORDER BY (status='draft') DESC,created_at DESC,id DESC LIMIT 11", ...args).all()).results;
    return newsPage208(rows, true);
  }
  if (path === "/posts/queue") {
    if (!await moderator(request, env, uid)) throw new GameError("Solo los administradores pueden revisar noticias.", 403);
    const cursor = newsCursor208(request, false);
    const where = cursor ? " AND (created_at>? OR (created_at=? AND id>?))" : "";
    const rows = (await q("SELECT * FROM news_posts WHERE status='pending'" + where + " ORDER BY created_at,id LIMIT 11", ...cursor ? [cursor.time, cursor.time, cursor.id] : []).all()).results;
    return newsPage208(rows, false);
  }
  if (path === "/posts/withdraw") {
    if (!validID(body.id)) throw new GameError("Noticia inv\xE1lida.");
    const row2 = await q("SELECT * FROM news_posts WHERE id=?", body.id).first();
    if (!row2) throw new GameError("Noticia no encontrada.", 404);
    if (row2.uid !== uid) throw new GameError("Solo el autor puede retirarla.", 403);
    const previous = await q("SELECT post_id FROM news_withdrawals WHERE post_id=? AND uid=?", row2.id, uid).first();
    if (previous) return { ok: true, refunded: row2.cost };
    if (!["draft", "pending"].includes(row2.status)) throw new GameError("La noticia ya fue revisada y no puede retirarse con devoluci\xF3n.", 409);
    await q("INSERT OR IGNORE INTO news_withdrawals(post_id,uid,previous_status,at) SELECT id,uid,status,? FROM news_posts WHERE id=? AND uid=? AND version=? AND status IN('draft','pending')", now, row2.id, uid, row2.version).run();
    if (!await q("SELECT post_id FROM news_withdrawals WHERE post_id=? AND uid=?", row2.id, uid).first()) throw new GameError("La noticia acaba de ser revisada. Actualiz\xE1 para ver su estado.", 409);
    return { ok: true, refunded: row2.cost };
  }
  const state = await league(request, env), seasonID = reading ? new URL(request.url).searchParams.get("season") : body.season, s = state.seasons?.find((s2) => s2.id === seasonID);
  if (path === "/posts/feed") {
    if (!s) throw new GameError("Temporada inexistente.", 404);
    const raw = new URL(request.url).searchParams.get("before"), parts = raw?.split(":");
    if (raw && (!/^\d{1,16}$/.test(parts[0]) || !validID(parts[1]))) throw new GameError("P\xE1gina inv\xE1lida.");
    const time = parts ? Number(parts[0]) : Number.MAX_SAFE_INTEGER, id = parts ? parts[1] : "\uFFFF";
    const rows = await q("SELECT * FROM news_posts WHERE status='approved' AND season=? AND (updated_at<? OR (updated_at=? AND id<?)) ORDER BY updated_at DESC,id DESC LIMIT 6", s.id, time, time, id).all();
    return { posts: rows.results.filter((p) => {
      try {
        validate(s, JSON.parse(p.payload));
        return true;
      } catch {
        return false;
      }
    }).map(publicPost), next: rows.results.length === 6 ? rows.results.at(-1).updated_at + ":" + rows.results.at(-1).id : null };
  }
  if (path === "/posts/buy") {
    if (!validID(body.id) || !s || s.closed) throw new GameError("Eleg\xED una temporada abierta.");
    const old = await q("SELECT * FROM news_posts WHERE id=?", body.id).first();
    if (old) {
      if (old.uid !== uid || old.season !== s.id) throw new GameError("Solicitud ya utilizada.", 409);
      return { post: publicPost(old) };
    }
    const draft = await q("SELECT * FROM news_posts WHERE uid=? AND status='draft'", uid).first();
    if (draft) return { post: publicPost(draft) };
    const free = await moderator(request, env, uid);
    await q("INSERT OR IGNORE INTO wallets(uid,name,created_at) VALUES(?,?,?)", uid, String(user.name || "Jugador").slice(0, 40), now).run();
    const wallet = await q("SELECT name FROM wallets WHERE uid=?", uid).first();
    try {
      await q("INSERT INTO news_posts(id,uid,author,season,cost,created_at,updated_at) VALUES(?,?,?,?,?,?,?)", body.id, uid, wallet.name, s.id, free ? 0 : 250, now, now).run();
    } catch (e) {
      const concurrent = await q("SELECT * FROM news_posts WHERE uid=? AND status='draft'", uid).first();
      if (concurrent) return { post: publicPost(concurrent) };
      const w = await q("SELECT balance FROM wallets WHERE uid=?", uid).first();
      if (w?.balance < 250) throw new GameError("Necesit\xE1s 250 fichas para crear una noticia.", 409);
      throw e;
    }
    return { post: publicPost(await q("SELECT * FROM news_posts WHERE id=?", body.id).first()) };
  }
  const row = validID(body.id) ? await q("SELECT * FROM news_posts WHERE id=?", body.id).first() : null;
  if (!row) throw new GameError("Noticia no encontrada.", 404);
  if (path === "/posts/review") {
    if (!await moderator(request, env, uid)) throw new GameError("Solo los administradores pueden revisar noticias.", 403);
    if (!["approved", "rejected"].includes(body.decision)) throw new GameError("Decisi\xF3n inv\xE1lida.");
    if (row.status === body.decision) return { post: publicPost(row) };
    if (row.status !== "pending") throw new GameError("Esta noticia ya fue revisada.", 409);
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 300) : "";
    if (body.decision === "rejected" && !reason) throw new GameError("Indic\xE1 el motivo del rechazo.");
    if (body.decision === "approved") {
      const target = state.seasons?.find((s2) => s2.id === row.season);
      if (!target) throw new GameError("Temporada inexistente.", 409);
      validate(target, JSON.parse(row.payload), true);
    }
    const changed = await q("UPDATE news_posts SET status=?,reason=?,reviewer=?,version=version+1,updated_at=? WHERE id=? AND status='pending' AND version=? RETURNING id", body.decision, reason, uid, now, row.id, row.version).first();
    if (!changed) throw new GameError("Otro administrador ya revis\xF3 esta noticia. Actualiz\xE1.", 409);
  } else if (["/posts/save", "/posts/submit"].includes(path)) {
    if (row.uid !== uid) throw new GameError("Esta noticia pertenece a otra persona.", 403);
    if (row.status !== "draft") {
      if (path === "/posts/submit" && ["pending", "approved"].includes(row.status) && body.version === row.version - 1) return { post: publicPost(row) };
      throw new GameError("La noticia enviada ya no se puede editar.", 409);
    }
    const target = state.seasons?.find((s2) => s2.id === row.season);
    if (!target || target.closed) throw new GameError("La temporada est\xE1 cerrada. Tu borrador se conserva.", 409);
    const payload = validate(target, body.content, path === "/posts/submit"), status = path === "/posts/save" ? "draft" : row.cost === 0 && await moderator(request, env, uid) ? "approved" : "pending";
    if (!Number.isInteger(body.version)) throw new GameError("Versi\xF3n inv\xE1lida.");
    const changed = await q("UPDATE news_posts SET payload=?,status=?,version=version+1,updated_at=? WHERE id=? AND uid=? AND status='draft' AND version=? RETURNING id", JSON.stringify(payload), status, now, row.id, uid, body.version).first();
    if (!changed) throw new GameError("El borrador cambi\xF3 en otro dispositivo. Actualiz\xE1 antes de seguir.", 409);
  } else throw new GameError("Ruta inexistente.", 404);
  return { post: publicPost(await q("SELECT * FROM news_posts WHERE id=?", row.id).first()) };
}
__name(posts, "posts");
var START = Date.parse("2026-10-19T00:00:00-03:00");
function periodTime(now) {
  const day2 = dateAR(now), d = /* @__PURE__ */ new Date(day2.day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - (day2.weekday + 6) % 7);
  const monday = d.toISOString().slice(0, 10);
  return { week: monday, closes: d.getTime() + 4 * 864e5 + 4.5 * 36e5 };
}
__name(periodTime, "periodTime");
function selectSix(s, used = []) {
  const candidates = fixtures(s).filter((m) => m.a === null && m.b === null && !used.includes(m.id)), groups = [0, 1, 2, "cup"].map((d) => candidates.filter((m) => m.competition === d).sort((a, b) => a.round - b.round || a.id.localeCompare(b.id)));
  const out = [];
  while (out.length < 6 && groups.some((g) => g.length)) for (const g of groups) {
    if (g.length && out.length < 6) out.push(g.shift());
  }
  return out;
}
__name(selectSix, "selectSix");
var sameFixture = /* @__PURE__ */ __name((m, slot) => {
  const i = JSON.parse(slot.info);
  return m.h === i.h && m.w === i.w;
}, "sameFixture");
var info = /* @__PURE__ */ __name((m) => JSON.stringify({ id: m.id, h: m.h, w: m.w, home: m.home, away: m.away, competition: m.competition, round: m.round }), "info");
async function bets(path, body, user, ctx) {
  const { request, env, db, now } = ctx;
  const uid = user.sub, trial = path.startsWith("/practice/bets/");
  path = path.replace("/practice", "");
  if (trial && uid !== env.OWNER_UID) throw new GameError("Prueba privada del creador.", 403);
  const rename = /* @__PURE__ */ __name((sql) => trial ? sql.replace(/\b(bet_periods|bet_matches|bet_audit|bets|wallets|ledger)\b/g, (x) => ({ wallets: "trial_wallets", ledger: "trial_ledger" })[x] || "trial_" + x) : sql, "rename");
  const q = /* @__PURE__ */ __name((sql, ...args) => db.prepare(rename(sql)).bind(...args), "q");
  const admin = /* @__PURE__ */ __name(() => moderator(request, env, uid), "admin");
  const trackedRows = /* @__PURE__ */ __name(async () => (await q("SELECT * FROM bet_matches WHERE active=1 ORDER BY rowid DESC LIMIT 120").all()).results.map((m) => ({ ...m, info: JSON.parse(m.info) })), "trackedRows");
  if (!trial && now < START) return { disabled: true, message: "APUESTAS DISPONIBLES DESDE LA PR\xD3XIMA TEMPORADA.", start: START, period: null, matches: [], myBets: [] };
  if (trial) await q("INSERT OR IGNORE INTO wallets(uid,name,created_at) VALUES(?,?,?)", uid, "PRUEBA DE APUESTAS", now).run();
  else await q("INSERT OR IGNORE INTO wallets(uid,name,created_at) VALUES(?,?,?)", uid, (user.name || "Jugador").slice(0, 40), now).run();
  const getSlot = /* @__PURE__ */ __name(async () => {
    const s = await q("SELECT * FROM bet_matches WHERE id=?", body.slot).first();
    if (!s) throw new GameError("Partido de apuestas inexistente.", 404);
    return s;
  }, "getSlot");
  if (path === "/bets/reset" && trial) {
    await db.batch(["DELETE FROM bets", "DELETE FROM bet_audit", "DELETE FROM bet_matches", "DELETE FROM bet_periods", "DELETE FROM ledger", "DELETE FROM wallets"].map((sql) => q(sql)));
    return { ok: true };
  }
  if (path === "/bets/board") {
    await db.batch([
      q("UPDATE bet_matches SET status='void',active=0,reason='Per\xEDodo no habilitado',version=version+1,updated_at=? WHERE status='pending' AND period IN (SELECT p.id FROM bet_periods p WHERE p.status='draft' AND p.closes<=? AND NOT EXISTS(SELECT 1 FROM bets b WHERE b.period=p.id))", now, now),
      q("UPDATE bet_periods SET status='closed' WHERE status='draft' AND closes<=? AND NOT EXISTS(SELECT 1 FROM bets b WHERE b.period=bet_periods.id)", now)
    ]);
    const data = await league(request, env), s = data.seasons?.filter((s2) => !s2.closed).at(-1) || (trial ? data.seasons?.at(-1) : null);
    if (!s) return { disabled: true, message: "ESPERANDO LA NUEVA TEMPORADA.", matches: [], myBets: [], tracked: await trackedRows() };
    const t = periodTime(now), id = s.id + ":" + t.week;
    let p = await q("SELECT * FROM bet_periods WHERE id=?", id).first();
    if (!p) {
      const used = (await q("SELECT match_id FROM bet_matches WHERE status<>'void'").all()).results.map((m) => m.match_id), six = selectSix(s, used);
      if (six.length < 6) return { disabled: true, message: "SE NECESITAN SEIS PARTIDOS PENDIENTES PARA PREPARAR EL PER\xCDODO.", matches: [], myBets: [], tracked: await trackedRows() };
      await db.batch([q("INSERT OR IGNORE INTO bet_periods(id,season,week,closes,status,created_at) VALUES(?,?,?,?,?,?)", id, s.id, t.week, trial ? now + 7 * 864e5 : t.closes, "draft", now), ...six.map((m, i) => q("INSERT OR IGNORE INTO bet_matches(id,period,match_id,info,updated_at) VALUES(?,?,?,?,?)", id + ":" + i, id, m.id, info(m), now))]);
      p = await q("SELECT * FROM bet_periods WHERE id=?", id).first();
    }
    if (p.status === "open" && now >= p.closes) {
      await q("UPDATE bet_periods SET status='closed' WHERE id=? AND status='open'", id).run();
      p.status = "closed";
    }
    const matches2 = (await q("SELECT * FROM bet_matches WHERE period=? AND active=1 ORDER BY rowid", id).all()).results.map((m) => ({ ...m, info: JSON.parse(m.info) }));
    const myBets = (await q("SELECT * FROM bets WHERE uid=? AND period=? ORDER BY created_at", uid, id).all()).results;
    const tracked = await trackedRows();
    return { period: p, matches: matches2, tracked, myBets, wallet: await q("SELECT balance FROM wallets WHERE uid=?", uid).first(), spent: myBets.filter((b) => b.status !== "void").reduce((n, b) => n + b.stake, 0), trial, canConfirm: trial ? true : await admin(), canManage: uid === env.OWNER_UID, serverNow: now };
  }
  if (path === "/bets/open") {
    if (uid !== env.OWNER_UID) throw new GameError("Solo el creador puede habilitar apuestas.", 403);
    const p = await q("SELECT * FROM bet_periods WHERE id=?", body.period).first();
    if (!p || now >= p.closes) throw new GameError("El plazo de apuestas termin\xF3.", 409);
    const slots = (await q("SELECT * FROM bet_matches WHERE period=? AND active=1", p.id).all()).results;
    if (slots.length !== 6 || slots.some((s) => s.status !== "pending")) throw new GameError("Revis\xE1 los seis partidos antes de habilitar.", 409);
    const data = await league(request, env), season = data.seasons.find((s) => s.id === p.season);
    if (!season || !trial && season.closed) throw new GameError("La temporada est\xE1 cerrada.", 409);
    const fs = fixtures(season);
    if (slots.some((s) => !fs.some((m) => m.id === s.match_id && sameFixture(m, s) && m.a === null && m.b === null))) throw new GameError("Hay partidos ya jugados. Correg\xED la selecci\xF3n.", 409);
    await q("UPDATE bet_periods SET status='open' WHERE id=? AND status='draft'", p.id).run();
    return { ok: true };
  }
  if (path === "/bets/place") {
    if (!["home", "draw", "away"].includes(body.choice) || !Number.isInteger(body.stake) || body.stake < 1 || body.stake > 150 || typeof body.id !== "string" || !/^[-a-zA-Z0-9]{16,64}$/.test(body.id)) throw new GameError("Eleg\xED resultado y una cantidad entera de 1 a 150 fichas.");
    const slot = await getSlot();
    const old = await q("SELECT * FROM bets WHERE uid=? AND slot=?", uid, slot.id).first();
    if (old) {
      if (old.choice === body.choice && old.stake === body.stake) return { bet: old };
      throw new GameError("Ya hay una apuesta registrada para este partido.", 409);
    }
    const p = await q("SELECT * FROM bet_periods WHERE id=?", slot.period).first();
    if (p.status !== "open" || now >= p.closes || slot.status !== "pending" || slot.active !== 1) throw new GameError("Las apuestas est\xE1n cerradas.", 409);
    const data = await league(request, env), s = data.seasons.find((s2) => s2.id === p.season), m = s && fixtures(s).find((m2) => m2.id === slot.match_id);
    if (!s || !trial && s.closed || !m || !sameFixture(m, slot) || m.a !== null || m.b !== null) throw new GameError("Este partido ya tiene resultado. Esper\xE1 una correcci\xF3n del administrador.", 409);
    try {
      await q("INSERT INTO bets(id,uid,period,slot,choice,stake,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)", body.id, uid, slot.period, slot.id, body.choice, body.stake, now, now).run();
    } catch (e) {
      const retry = await q("SELECT * FROM bets WHERE id=? AND uid=?", body.id, uid).first();
      if (retry && retry.slot === body.slot && retry.choice === body.choice && retry.stake === body.stake) return { bet: retry };
      throw new GameError("No se registr\xF3 la apuesta. Verific\xE1 tu saldo, el m\xE1ximo de 150 fichas y si el partido sigue disponible.", 409);
    }
    return { ok: true };
  }
  if (path === "/bets/replace") {
    if (uid !== env.OWNER_UID) throw new GameError("Solo el creador puede corregir la selecci\xF3n.", 403);
    const slot = await getSlot();
    if (slot.status !== "pending" || slot.active !== 1) throw new GameError("Este partido ya fue liquidado o anulado.", 409);
    const reason = String(body.reason || "").trim().slice(0, 200);
    if (!reason) throw new GameError("Indic\xE1 el motivo de la correcci\xF3n.");
    const p = await q("SELECT * FROM bet_periods WHERE id=?", slot.period).first();
    const data = await league(request, env), s = data.seasons.find((s2) => s2.id === p.season), m = s && fixtures(s).find((m2) => m2.id === body.match);
    if (!m || m.a !== null || m.b !== null) throw new GameError("Eleg\xED un partido pendiente de esa temporada.");
    if (await q("SELECT id FROM bet_matches WHERE match_id=? AND status<>'void' AND id<>?", m.id, slot.id).first()) throw new GameError("Ese partido ya est\xE1 seleccionado.", 409);
    const id = crypto.randomUUID();
    await db.batch([q("UPDATE bet_matches SET status='void',active=0,reason=?,version=version+1,updated_at=? WHERE id=? AND status='pending' AND version=?", reason, now, slot.id, slot.version), q("INSERT INTO bet_matches(id,period,match_id,info,updated_at,replaced_from) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM bet_matches WHERE id=? AND status='void' AND version=?)", id, p.id, m.id, info(m), now, slot.id, slot.id, slot.version + 1), q("INSERT OR IGNORE INTO bet_audit(id,actor,slot,action,reason,at) SELECT ?,?,?,'replace',?,? WHERE EXISTS(SELECT 1 FROM bet_matches WHERE id=?)", id, uid, slot.id, reason, now, id)]);
    return { ok: true };
  }
  if (path === "/bets/settle") {
    if (!await admin()) throw new GameError("Solo administradores pueden confirmar para apuestas.", 403);
    if (body.confirm !== true) throw new GameError("Falta la confirmaci\xF3n de apuestas.");
    const slot = await getSlot();
    if (slot.status === "settled") {
      if (slot.a !== body.a || slot.b !== body.b) throw new GameError("Las apuestas ya fueron liquidadas con otro marcador.", 409);
      return { ok: true, alreadySettled: true };
    }
    if (slot.status !== "pending" || slot.active !== 1) throw new GameError("El partido fue anulado.", 409);
    let m;
    if (trial) {
      if (!Number.isInteger(body.a) || !Number.isInteger(body.b) || body.a < 0 || body.b < 0 || body.a > 99 || body.b > 99) throw new GameError("Marcador de prueba inv\xE1lido.");
      m = { a: body.a, b: body.b };
    } else {
      const p = await q("SELECT * FROM bet_periods WHERE id=?", slot.period).first(), data = await league(request, env), s = data.seasons.find((s2) => s2.id === p.season);
      m = s && fixtures(s).find((m2) => m2.id === slot.match_id);
      if (!m || !sameFixture(m, slot) || !Number.isInteger(m.a) || !Number.isInteger(m.b) || m.a < 0 || m.b < 0 || m.a > 99 || m.b > 99) throw new GameError("Primero guard\xE1 el resultado y esper\xE1 a que se sincronice.", 409);
      if (m.a !== body.a || m.b !== body.b) throw new GameError("El resultado cambi\xF3. Revisalo antes de confirmar.", 409);
    }
    const result = await q("UPDATE bet_matches SET a=?,b=?,status='settled',version=version+1,updated_at=? WHERE id=? AND status='pending' AND version=? RETURNING id", m.a, m.b, now, slot.id, slot.version).first();
    if (!result) throw new GameError("La confirmaci\xF3n ya cambi\xF3. Actualiz\xE1.", 409);
    await q("INSERT OR IGNORE INTO bet_audit VALUES(?,?,?,'settle',?,?)", slot.id + ":settle", uid, slot.id, "Resultado confirmado: " + m.a + "\u2013" + m.b, now).run();
    return { ok: true };
  }
  throw new GameError("Ruta inexistente.", 404);
}
__name(bets, "bets");
var PRACTICE_OWNER = "iCLoGhjbXNgY3Q7dbxX0456vagI2";
async function practice(path, body, user, q, now) {
  if (user.sub !== PRACTICE_OWNER) throw new GameError("Este modo est\xE1 reservado para el creador.", 403);
  const uid = user.sub, initial = { wallet: { name: "PRUEBA", balance: 500 }, games: [], movements: [] };
  await q("INSERT OR IGNORE INTO practice_sessions(uid,state,updated_at) VALUES(?,?,?)", uid, JSON.stringify(initial), now).run();
  const row = await q("SELECT * FROM practice_sessions WHERE uid=?", uid).first();
  let data = JSON.parse(row.state), changed = false;
  if (path === "/practice/reset") {
    data = initial;
    changed = true;
  } else if (path === "/practice/me") {
  } else if (path === "/practice/games/start") {
    if (!["mines", "penalties"].includes(body.kind)) throw new GameError("Juego inv\xE1lido.");
    let g = data.games.find((x) => x.kind === body.kind);
    if (!g || g.status !== "active") {
      if (data.wallet.balance < 25) throw new GameError("Reinici\xE1 la prueba para recuperar fichas de prueba.", 409);
      g = { ...createGame(body.kind), id: crypto.randomUUID(), kind: body.kind, day: dateAR(now).day, version: 0 };
      data.games = data.games.filter((x) => x.kind !== body.kind);
      data.games.push(g);
      data.wallet.balance -= 25;
      data.movements.unshift({ amount: -25, reason: "TICKET DE PRUEBA", at: now });
      changed = true;
    }
  } else if (path === "/practice/games/action") {
    const g = data.games.find((x) => x.id === body.id);
    if (!g) throw new GameError("Partida de prueba inexistente.", 404);
    if (g.version !== body.version) throw new GameError("La prueba cambi\xF3. Actualiz\xE1 para continuar.", 409);
    const next = playGame(g, body.action || {});
    next.version = g.version + 1;
    data.games = data.games.map((x) => x.id === g.id ? next : x);
    if (next.status === "won" && next.payout) {
      data.wallet.balance += next.payout;
      data.movements.unshift({ amount: next.payout, reason: "PREMIO DE PRUEBA", at: now });
    }
    changed = true;
  } else throw new GameError("Ruta de prueba inexistente.", 404);
  data.movements = data.movements.slice(0, 30);
  if (changed) {
    const updated = await q("UPDATE practice_sessions SET state=?,version=version+1,updated_at=? WHERE uid=? AND version=? RETURNING uid", JSON.stringify(data), now, uid, row.version).first();
    if (!updated) throw new GameError("Otra acci\xF3n actualiz\xF3 la prueba. Volv\xE9 a cargarla.", 409);
  }
  return { ...data, games: data.games.map(publicGame), day: dateAR(now).day, available: { mines: true, penalties: true }, practice: true };
}
__name(practice, "practice");
var encoder2 = new TextEncoder();
var decoder2 = new TextDecoder();
var MAX_INT322 = 2 ** 32;
function concat2(...buffers) {
  const size = buffers.reduce((acc, { length }) => acc + length, 0);
  const buf = new Uint8Array(size);
  let i = 0;
  for (const buffer of buffers) {
    buf.set(buffer, i);
    i += buffer.length;
  }
  return buf;
}
__name(concat2, "concat");
function encode4(string) {
  const bytes = new Uint8Array(string.length);
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code > 127) {
      throw new TypeError("non-ASCII string encountered in encode()");
    }
    bytes[i] = code;
  }
  return bytes;
}
__name(encode4, "encode");
function decodeBase642(encoded) {
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(encoded);
  }
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
__name(decodeBase642, "decodeBase64");
function decode3(input) {
  if (Uint8Array.fromBase64) {
    return Uint8Array.fromBase64(typeof input === "string" ? input : decoder2.decode(input), {
      alphabet: "base64url"
    });
  }
  let encoded = input;
  if (encoded instanceof Uint8Array) {
    encoded = decoder2.decode(encoded);
  }
  encoded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeBase642(encoded);
  } catch {
    throw new TypeError("The input to be decoded is not correctly encoded.");
  }
}
__name(decode3, "decode");
var JOSEError2 = class extends Error {
  static {
    __name(this, "JOSEError");
  }
  static code = "ERR_JOSE_GENERIC";
  code = "ERR_JOSE_GENERIC";
  constructor(message22, options) {
    super(message22, options);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
};
var JWTClaimValidationFailed = class extends JOSEError2 {
  static {
    __name(this, "JWTClaimValidationFailed");
  }
  static code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  code = "ERR_JWT_CLAIM_VALIDATION_FAILED";
  claim;
  reason;
  payload;
  constructor(message22, payload, claim = "unspecified", reason = "unspecified") {
    super(message22, { cause: { claim, reason, payload } });
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
var JWTExpired = class extends JOSEError2 {
  static {
    __name(this, "JWTExpired");
  }
  static code = "ERR_JWT_EXPIRED";
  code = "ERR_JWT_EXPIRED";
  claim;
  reason;
  payload;
  constructor(message22, payload, claim = "unspecified", reason = "unspecified") {
    super(message22, { cause: { claim, reason, payload } });
    this.claim = claim;
    this.reason = reason;
    this.payload = payload;
  }
};
var JOSEAlgNotAllowed = class extends JOSEError2 {
  static {
    __name(this, "JOSEAlgNotAllowed");
  }
  static code = "ERR_JOSE_ALG_NOT_ALLOWED";
  code = "ERR_JOSE_ALG_NOT_ALLOWED";
};
var JOSENotSupported2 = class extends JOSEError2 {
  static {
    __name(this, "JOSENotSupported");
  }
  static code = "ERR_JOSE_NOT_SUPPORTED";
  code = "ERR_JOSE_NOT_SUPPORTED";
};
var JWSInvalid2 = class extends JOSEError2 {
  static {
    __name(this, "JWSInvalid");
  }
  static code = "ERR_JWS_INVALID";
  code = "ERR_JWS_INVALID";
};
var JWTInvalid2 = class extends JOSEError2 {
  static {
    __name(this, "JWTInvalid");
  }
  static code = "ERR_JWT_INVALID";
  code = "ERR_JWT_INVALID";
};
var JWKSInvalid = class extends JOSEError2 {
  static {
    __name(this, "JWKSInvalid");
  }
  static code = "ERR_JWKS_INVALID";
  code = "ERR_JWKS_INVALID";
};
var JWKSNoMatchingKey = class extends JOSEError2 {
  static {
    __name(this, "JWKSNoMatchingKey");
  }
  static code = "ERR_JWKS_NO_MATCHING_KEY";
  code = "ERR_JWKS_NO_MATCHING_KEY";
  constructor(message22 = "no applicable key found in the JSON Web Key Set", options) {
    super(message22, options);
  }
};
var JWKSMultipleMatchingKeys = class extends JOSEError2 {
  static {
    __name(this, "JWKSMultipleMatchingKeys");
  }
  [Symbol.asyncIterator];
  static code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
  code = "ERR_JWKS_MULTIPLE_MATCHING_KEYS";
  constructor(message22 = "multiple matching keys found in the JSON Web Key Set", options) {
    super(message22, options);
  }
};
var JWKSTimeout = class extends JOSEError2 {
  static {
    __name(this, "JWKSTimeout");
  }
  static code = "ERR_JWKS_TIMEOUT";
  code = "ERR_JWKS_TIMEOUT";
  constructor(message22 = "request timed out", options) {
    super(message22, options);
  }
};
var JWSSignatureVerificationFailed = class extends JOSEError2 {
  static {
    __name(this, "JWSSignatureVerificationFailed");
  }
  static code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  code = "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
  constructor(message22 = "signature verification failed", options) {
    super(message22, options);
  }
};
var unusable2 = /* @__PURE__ */ __name((name, prop = "algorithm.name") => new TypeError(`CryptoKey does not support this operation, its ${prop} must be ${name}`), "unusable");
var isAlgorithm = /* @__PURE__ */ __name((algorithm, name) => algorithm.name === name, "isAlgorithm");
function getHashLength(hash) {
  return parseInt(hash.name.slice(4), 10);
}
__name(getHashLength, "getHashLength");
function getNamedCurve(alg) {
  switch (alg) {
    case "ES256":
      return "P-256";
    case "ES384":
      return "P-384";
    case "ES512":
      return "P-521";
    default:
      throw new Error("unreachable");
  }
}
__name(getNamedCurve, "getNamedCurve");
function checkUsage2(key, usage) {
  if (usage && !key.usages.includes(usage)) {
    throw new TypeError(`CryptoKey does not support this operation, its usages must include ${usage}.`);
  }
}
__name(checkUsage2, "checkUsage");
function checkSigCryptoKey(key, alg, usage) {
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512": {
      if (!isAlgorithm(key.algorithm, "HMAC"))
        throw unusable2("HMAC");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable2(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "RS256":
    case "RS384":
    case "RS512": {
      if (!isAlgorithm(key.algorithm, "RSASSA-PKCS1-v1_5"))
        throw unusable2("RSASSA-PKCS1-v1_5");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable2(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "PS256":
    case "PS384":
    case "PS512": {
      if (!isAlgorithm(key.algorithm, "RSA-PSS"))
        throw unusable2("RSA-PSS");
      const expected = parseInt(alg.slice(2), 10);
      const actual = getHashLength(key.algorithm.hash);
      if (actual !== expected)
        throw unusable2(`SHA-${expected}`, "algorithm.hash");
      break;
    }
    case "Ed25519":
    case "EdDSA": {
      if (!isAlgorithm(key.algorithm, "Ed25519"))
        throw unusable2("Ed25519");
      break;
    }
    case "ML-DSA-44":
    case "ML-DSA-65":
    case "ML-DSA-87": {
      if (!isAlgorithm(key.algorithm, alg))
        throw unusable2(alg);
      break;
    }
    case "ES256":
    case "ES384":
    case "ES512": {
      if (!isAlgorithm(key.algorithm, "ECDSA"))
        throw unusable2("ECDSA");
      const expected = getNamedCurve(alg);
      const actual = key.algorithm.namedCurve;
      if (actual !== expected)
        throw unusable2(expected, "algorithm.namedCurve");
      break;
    }
    default:
      throw new TypeError("CryptoKey does not support this operation");
  }
  checkUsage2(key, usage);
}
__name(checkSigCryptoKey, "checkSigCryptoKey");
function message2(msg, actual, ...types) {
  types = types.filter(Boolean);
  if (types.length > 2) {
    const last = types.pop();
    msg += `one of type ${types.join(", ")}, or ${last}.`;
  } else if (types.length === 2) {
    msg += `one of type ${types[0]} or ${types[1]}.`;
  } else {
    msg += `of type ${types[0]}.`;
  }
  if (actual == null) {
    msg += ` Received ${actual}`;
  } else if (typeof actual === "function" && actual.name) {
    msg += ` Received function ${actual.name}`;
  } else if (typeof actual === "object" && actual != null) {
    if (actual.constructor?.name) {
      msg += ` Received an instance of ${actual.constructor.name}`;
    }
  }
  return msg;
}
__name(message2, "message");
var invalidKeyInput2 = /* @__PURE__ */ __name((actual, ...types) => message2("Key must be ", actual, ...types), "invalidKeyInput");
var withAlg = /* @__PURE__ */ __name((alg, actual, ...types) => message2(`Key for the ${alg} algorithm must be `, actual, ...types), "withAlg");
var isCryptoKey2 = /* @__PURE__ */ __name((key) => {
  if (key?.[Symbol.toStringTag] === "CryptoKey")
    return true;
  try {
    return key instanceof CryptoKey;
  } catch {
    return false;
  }
}, "isCryptoKey");
var isKeyObject2 = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag] === "KeyObject", "isKeyObject");
var isKeyLike2 = /* @__PURE__ */ __name((key) => isCryptoKey2(key) || isKeyObject2(key), "isKeyLike");
function isDisjoint2(...headers) {
  const sources = headers.filter(Boolean);
  if (sources.length === 0 || sources.length === 1) {
    return true;
  }
  let acc;
  for (const header of sources) {
    const parameters = Object.keys(header);
    if (!acc || acc.size === 0) {
      acc = new Set(parameters);
      continue;
    }
    for (const parameter of parameters) {
      if (acc.has(parameter)) {
        return false;
      }
      acc.add(parameter);
    }
  }
  return true;
}
__name(isDisjoint2, "isDisjoint");
var isObjectLike = /* @__PURE__ */ __name((value2) => typeof value2 === "object" && value2 !== null, "isObjectLike");
function isObject2(input) {
  if (!isObjectLike(input) || Object.prototype.toString.call(input) !== "[object Object]") {
    return false;
  }
  if (Object.getPrototypeOf(input) === null) {
    return true;
  }
  let proto = input;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(input) === proto;
}
__name(isObject2, "isObject");
function checkKeyLength(alg, key) {
  if (alg.startsWith("RS") || alg.startsWith("PS")) {
    const { modulusLength } = key.algorithm;
    if (typeof modulusLength !== "number" || modulusLength < 2048) {
      throw new TypeError(`${alg} requires key modulusLength to be 2048 bits or larger`);
    }
  }
}
__name(checkKeyLength, "checkKeyLength");
function subtleMapping(jwk) {
  let algorithm;
  let keyUsages;
  switch (jwk.kty) {
    case "AKP": {
      switch (jwk.alg) {
        case "ML-DSA-44":
        case "ML-DSA-65":
        case "ML-DSA-87":
          algorithm = { name: jwk.alg };
          keyUsages = jwk.priv ? ["sign"] : ["verify"];
          break;
        default:
          throw new JOSENotSupported2('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "RSA": {
      switch (jwk.alg) {
        case "PS256":
        case "PS384":
        case "PS512":
          algorithm = { name: "RSA-PSS", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RS256":
        case "RS384":
        case "RS512":
          algorithm = { name: "RSASSA-PKCS1-v1_5", hash: `SHA-${jwk.alg.slice(-3)}` };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "RSA-OAEP":
        case "RSA-OAEP-256":
        case "RSA-OAEP-384":
        case "RSA-OAEP-512":
          algorithm = {
            name: "RSA-OAEP",
            hash: `SHA-${parseInt(jwk.alg.slice(-3), 10) || 1}`
          };
          keyUsages = jwk.d ? ["decrypt", "unwrapKey"] : ["encrypt", "wrapKey"];
          break;
        default:
          throw new JOSENotSupported2('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "EC": {
      switch (jwk.alg) {
        case "ES256":
          algorithm = { name: "ECDSA", namedCurve: "P-256" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ES384":
          algorithm = { name: "ECDSA", namedCurve: "P-384" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ES512":
          algorithm = { name: "ECDSA", namedCurve: "P-521" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: "ECDH", namedCurve: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported2('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    case "OKP": {
      switch (jwk.alg) {
        case "Ed25519":
        case "EdDSA":
          algorithm = { name: "Ed25519" };
          keyUsages = jwk.d ? ["sign"] : ["verify"];
          break;
        case "ECDH-ES":
        case "ECDH-ES+A128KW":
        case "ECDH-ES+A192KW":
        case "ECDH-ES+A256KW":
          algorithm = { name: jwk.crv };
          keyUsages = jwk.d ? ["deriveBits"] : [];
          break;
        default:
          throw new JOSENotSupported2('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
      }
      break;
    }
    default:
      throw new JOSENotSupported2('Invalid or unsupported JWK "kty" (Key Type) Parameter value');
  }
  return { algorithm, keyUsages };
}
__name(subtleMapping, "subtleMapping");
async function jwkToKey2(jwk) {
  if (!jwk.alg) {
    throw new TypeError('"alg" argument is required when "jwk.alg" is not present');
  }
  const { algorithm, keyUsages } = subtleMapping(jwk);
  const keyData = { ...jwk };
  if (keyData.kty !== "AKP") {
    delete keyData.alg;
  }
  delete keyData.use;
  return crypto.subtle.importKey("jwk", keyData, algorithm, jwk.ext ?? (jwk.d || jwk.priv ? false : true), jwk.key_ops ?? keyUsages);
}
__name(jwkToKey2, "jwkToKey");
async function importJWK2(jwk, alg, options) {
  if (!isObject2(jwk)) {
    throw new TypeError("JWK must be an object");
  }
  let ext;
  alg ??= jwk.alg;
  ext ??= options?.extractable ?? jwk.ext;
  switch (jwk.kty) {
    case "oct":
      if (typeof jwk.k !== "string" || !jwk.k) {
        throw new TypeError('missing "k" (Key Value) Parameter value');
      }
      return decode3(jwk.k);
    case "RSA":
      if ("oth" in jwk && jwk.oth !== void 0) {
        throw new JOSENotSupported2('RSA JWK "oth" (Other Primes Info) Parameter value is not supported');
      }
      return jwkToKey2({ ...jwk, alg, ext });
    case "AKP": {
      if (typeof jwk.alg !== "string" || !jwk.alg) {
        throw new TypeError('missing "alg" (Algorithm) Parameter value');
      }
      if (alg !== void 0 && alg !== jwk.alg) {
        throw new TypeError("JWK alg and alg option value mismatch");
      }
      return jwkToKey2({ ...jwk, ext });
    }
    case "EC":
    case "OKP":
      return jwkToKey2({ ...jwk, alg, ext });
    default:
      throw new JOSENotSupported2('Unsupported "kty" (Key Type) Parameter value');
  }
}
__name(importJWK2, "importJWK");
function validateCrit2(Err, recognizedDefault, recognizedOption, protectedHeader, joseHeader) {
  if (joseHeader.crit !== void 0 && protectedHeader?.crit === void 0) {
    throw new Err('"crit" (Critical) Header Parameter MUST be integrity protected');
  }
  if (!protectedHeader || protectedHeader.crit === void 0) {
    return /* @__PURE__ */ new Set();
  }
  if (!Array.isArray(protectedHeader.crit) || protectedHeader.crit.length === 0 || protectedHeader.crit.some((input) => typeof input !== "string" || input.length === 0)) {
    throw new Err('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  }
  let recognized;
  if (recognizedOption !== void 0) {
    recognized = new Map([...Object.entries(recognizedOption), ...recognizedDefault.entries()]);
  } else {
    recognized = recognizedDefault;
  }
  for (const parameter of protectedHeader.crit) {
    if (!recognized.has(parameter)) {
      throw new JOSENotSupported2(`Extension Header Parameter "${parameter}" is not recognized`);
    }
    if (joseHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" is missing`);
    }
    if (recognized.get(parameter) && protectedHeader[parameter] === void 0) {
      throw new Err(`Extension Header Parameter "${parameter}" MUST be integrity protected`);
    }
  }
  return new Set(protectedHeader.crit);
}
__name(validateCrit2, "validateCrit");
function validateAlgorithms(option, algorithms) {
  if (algorithms !== void 0 && (!Array.isArray(algorithms) || algorithms.some((s) => typeof s !== "string"))) {
    throw new TypeError(`"${option}" option must be an array of strings`);
  }
  if (!algorithms) {
    return void 0;
  }
  return new Set(algorithms);
}
__name(validateAlgorithms, "validateAlgorithms");
var isJWK = /* @__PURE__ */ __name((key) => isObject2(key) && typeof key.kty === "string", "isJWK");
var isPrivateJWK = /* @__PURE__ */ __name((key) => key.kty !== "oct" && (key.kty === "AKP" && typeof key.priv === "string" || typeof key.d === "string"), "isPrivateJWK");
var isPublicJWK = /* @__PURE__ */ __name((key) => key.kty !== "oct" && key.d === void 0 && key.priv === void 0, "isPublicJWK");
var isSecretJWK = /* @__PURE__ */ __name((key) => key.kty === "oct" && typeof key.k === "string", "isSecretJWK");
var cache2;
var handleJWK = /* @__PURE__ */ __name(async (key, jwk, alg, freeze = false) => {
  cache2 ||= /* @__PURE__ */ new WeakMap();
  let cached = cache2.get(key);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const cryptoKey = await jwkToKey2({ ...jwk, alg });
  if (freeze)
    Object.freeze(key);
  if (!cached) {
    cache2.set(key, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
}, "handleJWK");
var handleKeyObject = /* @__PURE__ */ __name((keyObject, alg) => {
  cache2 ||= /* @__PURE__ */ new WeakMap();
  let cached = cache2.get(keyObject);
  if (cached?.[alg]) {
    return cached[alg];
  }
  const isPublic = keyObject.type === "public";
  const extractable = isPublic ? true : false;
  let cryptoKey;
  if (keyObject.asymmetricKeyType === "x25519") {
    switch (alg) {
      case "ECDH-ES":
      case "ECDH-ES+A128KW":
      case "ECDH-ES+A192KW":
      case "ECDH-ES+A256KW":
        break;
      default:
        throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, isPublic ? [] : ["deriveBits"]);
  }
  if (keyObject.asymmetricKeyType === "ed25519") {
    if (alg !== "EdDSA" && alg !== "Ed25519") {
      throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, [
      isPublic ? "verify" : "sign"
    ]);
  }
  switch (keyObject.asymmetricKeyType) {
    case "ml-dsa-44":
    case "ml-dsa-65":
    case "ml-dsa-87": {
      if (alg !== keyObject.asymmetricKeyType.toUpperCase()) {
        throw new TypeError("given KeyObject instance cannot be used for this algorithm");
      }
      cryptoKey = keyObject.toCryptoKey(keyObject.asymmetricKeyType, extractable, [
        isPublic ? "verify" : "sign"
      ]);
    }
  }
  if (keyObject.asymmetricKeyType === "rsa") {
    let hash;
    switch (alg) {
      case "RSA-OAEP":
        hash = "SHA-1";
        break;
      case "RS256":
      case "PS256":
      case "RSA-OAEP-256":
        hash = "SHA-256";
        break;
      case "RS384":
      case "PS384":
      case "RSA-OAEP-384":
        hash = "SHA-384";
        break;
      case "RS512":
      case "PS512":
      case "RSA-OAEP-512":
        hash = "SHA-512";
        break;
      default:
        throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    if (alg.startsWith("RSA-OAEP")) {
      return keyObject.toCryptoKey({
        name: "RSA-OAEP",
        hash
      }, extractable, isPublic ? ["encrypt"] : ["decrypt"]);
    }
    cryptoKey = keyObject.toCryptoKey({
      name: alg.startsWith("PS") ? "RSA-PSS" : "RSASSA-PKCS1-v1_5",
      hash
    }, extractable, [isPublic ? "verify" : "sign"]);
  }
  if (keyObject.asymmetricKeyType === "ec") {
    const nist2 = /* @__PURE__ */ new Map([
      ["prime256v1", "P-256"],
      ["secp384r1", "P-384"],
      ["secp521r1", "P-521"]
    ]);
    const namedCurve = nist2.get(keyObject.asymmetricKeyDetails?.namedCurve);
    if (!namedCurve) {
      throw new TypeError("given KeyObject instance cannot be used for this algorithm");
    }
    if (alg === "ES256" && namedCurve === "P-256") {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDSA",
        namedCurve
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (alg === "ES384" && namedCurve === "P-384") {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDSA",
        namedCurve
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (alg === "ES512" && namedCurve === "P-521") {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDSA",
        namedCurve
      }, extractable, [isPublic ? "verify" : "sign"]);
    }
    if (alg.startsWith("ECDH-ES")) {
      cryptoKey = keyObject.toCryptoKey({
        name: "ECDH",
        namedCurve
      }, extractable, isPublic ? [] : ["deriveBits"]);
    }
  }
  if (!cryptoKey) {
    throw new TypeError("given KeyObject instance cannot be used for this algorithm");
  }
  if (!cached) {
    cache2.set(keyObject, { [alg]: cryptoKey });
  } else {
    cached[alg] = cryptoKey;
  }
  return cryptoKey;
}, "handleKeyObject");
async function normalizeKey(key, alg) {
  if (key instanceof Uint8Array) {
    return key;
  }
  if (isCryptoKey2(key)) {
    return key;
  }
  if (isKeyObject2(key)) {
    if (key.type === "secret") {
      return key.export();
    }
    if ("toCryptoKey" in key && typeof key.toCryptoKey === "function") {
      try {
        return handleKeyObject(key, alg);
      } catch (err) {
        if (err instanceof TypeError) {
          throw err;
        }
      }
    }
    let jwk = key.export({ format: "jwk" });
    return handleJWK(key, jwk, alg);
  }
  if (isJWK(key)) {
    if (key.k) {
      return decode3(key.k);
    }
    return handleJWK(key, key, alg, true);
  }
  throw new Error("unreachable");
}
__name(normalizeKey, "normalizeKey");
var tag2 = /* @__PURE__ */ __name((key) => key?.[Symbol.toStringTag], "tag");
var jwkMatchesOp2 = /* @__PURE__ */ __name((alg, key, usage) => {
  if (key.use !== void 0) {
    let expected;
    switch (usage) {
      case "sign":
      case "verify":
        expected = "sig";
        break;
      case "encrypt":
      case "decrypt":
        expected = "enc";
        break;
    }
    if (key.use !== expected) {
      throw new TypeError(`Invalid key for this operation, its "use" must be "${expected}" when present`);
    }
  }
  if (key.alg !== void 0 && key.alg !== alg) {
    throw new TypeError(`Invalid key for this operation, its "alg" must be "${alg}" when present`);
  }
  if (Array.isArray(key.key_ops)) {
    let expectedKeyOp;
    switch (true) {
      case (usage === "sign" || usage === "verify"):
      case alg === "dir":
      case alg.includes("CBC-HS"):
        expectedKeyOp = usage;
        break;
      case alg.startsWith("PBES2"):
        expectedKeyOp = "deriveBits";
        break;
      case /^A\d{3}(?:GCM)?(?:KW)?$/.test(alg):
        if (!alg.includes("GCM") && alg.endsWith("KW")) {
          expectedKeyOp = usage === "encrypt" ? "wrapKey" : "unwrapKey";
        } else {
          expectedKeyOp = usage;
        }
        break;
      case (usage === "encrypt" && alg.startsWith("RSA")):
        expectedKeyOp = "wrapKey";
        break;
      case usage === "decrypt":
        expectedKeyOp = alg.startsWith("RSA") ? "unwrapKey" : "deriveBits";
        break;
    }
    if (expectedKeyOp && key.key_ops?.includes?.(expectedKeyOp) === false) {
      throw new TypeError(`Invalid key for this operation, its "key_ops" must include "${expectedKeyOp}" when present`);
    }
  }
  return true;
}, "jwkMatchesOp");
var symmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage) => {
  if (key instanceof Uint8Array)
    return;
  if (isJWK(key)) {
    if (isSecretJWK(key) && jwkMatchesOp2(alg, key, usage))
      return;
    throw new TypeError(`JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present`);
  }
  if (!isKeyLike2(key)) {
    throw new TypeError(withAlg(alg, key, "CryptoKey", "KeyObject", "JSON Web Key", "Uint8Array"));
  }
  if (key.type !== "secret") {
    throw new TypeError(`${tag2(key)} instances for symmetric algorithms must be of type "secret"`);
  }
}, "symmetricTypeCheck");
var asymmetricTypeCheck = /* @__PURE__ */ __name((alg, key, usage) => {
  if (isJWK(key)) {
    switch (usage) {
      case "decrypt":
      case "sign":
        if (isPrivateJWK(key) && jwkMatchesOp2(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation must be a private JWK`);
      case "encrypt":
      case "verify":
        if (isPublicJWK(key) && jwkMatchesOp2(alg, key, usage))
          return;
        throw new TypeError(`JSON Web Key for this operation must be a public JWK`);
    }
  }
  if (!isKeyLike2(key)) {
    throw new TypeError(withAlg(alg, key, "CryptoKey", "KeyObject", "JSON Web Key"));
  }
  if (key.type === "secret") {
    throw new TypeError(`${tag2(key)} instances for asymmetric algorithms must not be of type "secret"`);
  }
  if (key.type === "public") {
    switch (usage) {
      case "sign":
        throw new TypeError(`${tag2(key)} instances for asymmetric algorithm signing must be of type "private"`);
      case "decrypt":
        throw new TypeError(`${tag2(key)} instances for asymmetric algorithm decryption must be of type "private"`);
    }
  }
  if (key.type === "private") {
    switch (usage) {
      case "verify":
        throw new TypeError(`${tag2(key)} instances for asymmetric algorithm verifying must be of type "public"`);
      case "encrypt":
        throw new TypeError(`${tag2(key)} instances for asymmetric algorithm encryption must be of type "public"`);
    }
  }
}, "asymmetricTypeCheck");
function checkKeyType(alg, key, usage) {
  switch (alg.substring(0, 2)) {
    case "A1":
    case "A2":
    case "di":
    case "HS":
    case "PB":
      symmetricTypeCheck(alg, key, usage);
      break;
    default:
      asymmetricTypeCheck(alg, key, usage);
  }
}
__name(checkKeyType, "checkKeyType");
function subtleAlgorithm(alg, algorithm) {
  const hash = `SHA-${alg.slice(-3)}`;
  switch (alg) {
    case "HS256":
    case "HS384":
    case "HS512":
      return { hash, name: "HMAC" };
    case "PS256":
    case "PS384":
    case "PS512":
      return { hash, name: "RSA-PSS", saltLength: parseInt(alg.slice(-3), 10) >> 3 };
    case "RS256":
    case "RS384":
    case "RS512":
      return { hash, name: "RSASSA-PKCS1-v1_5" };
    case "ES256":
    case "ES384":
    case "ES512":
      return { hash, name: "ECDSA", namedCurve: algorithm.namedCurve };
    case "Ed25519":
    case "EdDSA":
      return { name: "Ed25519" };
    case "ML-DSA-44":
    case "ML-DSA-65":
    case "ML-DSA-87":
      return { name: alg };
    default:
      throw new JOSENotSupported2(`alg ${alg} is not supported either by JOSE or your javascript runtime`);
  }
}
__name(subtleAlgorithm, "subtleAlgorithm");
async function getSigKey(alg, key, usage) {
  if (key instanceof Uint8Array) {
    if (!alg.startsWith("HS")) {
      throw new TypeError(invalidKeyInput2(key, "CryptoKey", "KeyObject", "JSON Web Key"));
    }
    return crypto.subtle.importKey("raw", key, { hash: `SHA-${alg.slice(-3)}`, name: "HMAC" }, false, [usage]);
  }
  checkSigCryptoKey(key, alg, usage);
  return key;
}
__name(getSigKey, "getSigKey");
async function verify(alg, key, signature, data) {
  const cryptoKey = await getSigKey(alg, key, "verify");
  checkKeyLength(alg, cryptoKey);
  const algorithm = subtleAlgorithm(alg, cryptoKey.algorithm);
  try {
    return await crypto.subtle.verify(algorithm, cryptoKey, signature, data);
  } catch {
    return false;
  }
}
__name(verify, "verify");
async function flattenedVerify(jws, key, options) {
  if (!isObject2(jws)) {
    throw new JWSInvalid2("Flattened JWS must be an object");
  }
  if (jws.protected === void 0 && jws.header === void 0) {
    throw new JWSInvalid2('Flattened JWS must have either of the "protected" or "header" members');
  }
  if (jws.protected !== void 0 && typeof jws.protected !== "string") {
    throw new JWSInvalid2("JWS Protected Header incorrect type");
  }
  if (jws.payload === void 0) {
    throw new JWSInvalid2("JWS Payload missing");
  }
  if (typeof jws.signature !== "string") {
    throw new JWSInvalid2("JWS Signature missing or incorrect type");
  }
  if (jws.header !== void 0 && !isObject2(jws.header)) {
    throw new JWSInvalid2("JWS Unprotected Header incorrect type");
  }
  let parsedProt = {};
  if (jws.protected) {
    try {
      const protectedHeader = decode3(jws.protected);
      parsedProt = JSON.parse(decoder2.decode(protectedHeader));
    } catch {
      throw new JWSInvalid2("JWS Protected Header is invalid");
    }
  }
  if (!isDisjoint2(parsedProt, jws.header)) {
    throw new JWSInvalid2("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  }
  const joseHeader = {
    ...parsedProt,
    ...jws.header
  };
  const extensions = validateCrit2(JWSInvalid2, /* @__PURE__ */ new Map([["b64", true]]), options?.crit, parsedProt, joseHeader);
  let b64 = true;
  if (extensions.has("b64")) {
    b64 = parsedProt.b64;
    if (typeof b64 !== "boolean") {
      throw new JWSInvalid2('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    }
  }
  const { alg } = joseHeader;
  if (typeof alg !== "string" || !alg) {
    throw new JWSInvalid2('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  }
  const algorithms = options && validateAlgorithms("algorithms", options.algorithms);
  if (algorithms && !algorithms.has(alg)) {
    throw new JOSEAlgNotAllowed('"alg" (Algorithm) Header Parameter value not allowed');
  }
  if (b64) {
    if (typeof jws.payload !== "string") {
      throw new JWSInvalid2("JWS Payload must be a string");
    }
  } else if (typeof jws.payload !== "string" && !(jws.payload instanceof Uint8Array)) {
    throw new JWSInvalid2("JWS Payload must be a string or an Uint8Array instance");
  }
  let resolvedKey = false;
  if (typeof key === "function") {
    key = await key(parsedProt, jws);
    resolvedKey = true;
  }
  checkKeyType(alg, key, "verify");
  const data = concat2(jws.protected !== void 0 ? encode4(jws.protected) : new Uint8Array(), encode4("."), typeof jws.payload === "string" ? b64 ? encode4(jws.payload) : encoder2.encode(jws.payload) : jws.payload);
  let signature;
  try {
    signature = decode3(jws.signature);
  } catch {
    throw new JWSInvalid2("Failed to base64url decode the signature");
  }
  const k = await normalizeKey(key, alg);
  const verified = await verify(alg, k, signature, data);
  if (!verified) {
    throw new JWSSignatureVerificationFailed();
  }
  let payload;
  if (b64) {
    try {
      payload = decode3(jws.payload);
    } catch {
      throw new JWSInvalid2("Failed to base64url decode the payload");
    }
  } else if (typeof jws.payload === "string") {
    payload = encoder2.encode(jws.payload);
  } else {
    payload = jws.payload;
  }
  const result = { payload };
  if (jws.protected !== void 0) {
    result.protectedHeader = parsedProt;
  }
  if (jws.header !== void 0) {
    result.unprotectedHeader = jws.header;
  }
  if (resolvedKey) {
    return { ...result, key: k };
  }
  return result;
}
__name(flattenedVerify, "flattenedVerify");
async function compactVerify(jws, key, options) {
  if (jws instanceof Uint8Array) {
    jws = decoder2.decode(jws);
  }
  if (typeof jws !== "string") {
    throw new JWSInvalid2("Compact JWS must be a string or Uint8Array");
  }
  const { 0: protectedHeader, 1: payload, 2: signature, length } = jws.split(".");
  if (length !== 3) {
    throw new JWSInvalid2("Invalid Compact JWS");
  }
  const verified = await flattenedVerify({ payload, protected: protectedHeader, signature }, key, options);
  const result = { payload: verified.payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}
__name(compactVerify, "compactVerify");
var epoch2 = /* @__PURE__ */ __name((date) => Math.floor(date.getTime() / 1e3), "epoch");
var minute = 60;
var hour = minute * 60;
var day = hour * 24;
var week = day * 7;
var year = day * 365.25;
var REGEX2 = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
function secs2(str) {
  const matched = REGEX2.exec(str);
  if (!matched || matched[4] && matched[1]) {
    throw new TypeError("Invalid time period format");
  }
  const value2 = parseFloat(matched[2]);
  const unit = matched[3].toLowerCase();
  let numericDate2;
  switch (unit) {
    case "sec":
    case "secs":
    case "second":
    case "seconds":
    case "s":
      numericDate2 = Math.round(value2);
      break;
    case "minute":
    case "minutes":
    case "min":
    case "mins":
    case "m":
      numericDate2 = Math.round(value2 * minute);
      break;
    case "hour":
    case "hours":
    case "hr":
    case "hrs":
    case "h":
      numericDate2 = Math.round(value2 * hour);
      break;
    case "day":
    case "days":
    case "d":
      numericDate2 = Math.round(value2 * day);
      break;
    case "week":
    case "weeks":
    case "w":
      numericDate2 = Math.round(value2 * week);
      break;
    default:
      numericDate2 = Math.round(value2 * year);
      break;
  }
  if (matched[1] === "-" || matched[4] === "ago") {
    return -numericDate2;
  }
  return numericDate2;
}
__name(secs2, "secs");
var normalizeTyp = /* @__PURE__ */ __name((value2) => {
  if (value2.includes("/")) {
    return value2.toLowerCase();
  }
  return `application/${value2.toLowerCase()}`;
}, "normalizeTyp");
var checkAudiencePresence = /* @__PURE__ */ __name((audPayload, audOption) => {
  if (typeof audPayload === "string") {
    return audOption.includes(audPayload);
  }
  if (Array.isArray(audPayload)) {
    return audOption.some(Set.prototype.has.bind(new Set(audPayload)));
  }
  return false;
}, "checkAudiencePresence");
function validateClaimsSet(protectedHeader, encodedPayload, options = {}) {
  let payload;
  try {
    payload = JSON.parse(decoder2.decode(encodedPayload));
  } catch {
  }
  if (!isObject2(payload)) {
    throw new JWTInvalid2("JWT Claims Set must be a top-level JSON object");
  }
  const { typ } = options;
  if (typ && (typeof protectedHeader.typ !== "string" || normalizeTyp(protectedHeader.typ) !== normalizeTyp(typ))) {
    throw new JWTClaimValidationFailed('unexpected "typ" JWT header value', payload, "typ", "check_failed");
  }
  const { requiredClaims = [], issuer, subject, audience, maxTokenAge } = options;
  const presenceCheck = [...requiredClaims];
  if (maxTokenAge !== void 0)
    presenceCheck.push("iat");
  if (audience !== void 0)
    presenceCheck.push("aud");
  if (subject !== void 0)
    presenceCheck.push("sub");
  if (issuer !== void 0)
    presenceCheck.push("iss");
  for (const claim of new Set(presenceCheck.reverse())) {
    if (!(claim in payload)) {
      throw new JWTClaimValidationFailed(`missing required "${claim}" claim`, payload, claim, "missing");
    }
  }
  if (issuer && !(Array.isArray(issuer) ? issuer : [issuer]).includes(payload.iss)) {
    throw new JWTClaimValidationFailed('unexpected "iss" claim value', payload, "iss", "check_failed");
  }
  if (subject && payload.sub !== subject) {
    throw new JWTClaimValidationFailed('unexpected "sub" claim value', payload, "sub", "check_failed");
  }
  if (audience && !checkAudiencePresence(payload.aud, typeof audience === "string" ? [audience] : audience)) {
    throw new JWTClaimValidationFailed('unexpected "aud" claim value', payload, "aud", "check_failed");
  }
  let tolerance;
  switch (typeof options.clockTolerance) {
    case "string":
      tolerance = secs2(options.clockTolerance);
      break;
    case "number":
      tolerance = options.clockTolerance;
      break;
    case "undefined":
      tolerance = 0;
      break;
    default:
      throw new TypeError("Invalid clockTolerance option type");
  }
  const { currentDate } = options;
  const now = epoch2(currentDate || /* @__PURE__ */ new Date());
  if ((payload.iat !== void 0 || maxTokenAge) && typeof payload.iat !== "number") {
    throw new JWTClaimValidationFailed('"iat" claim must be a number', payload, "iat", "invalid");
  }
  if (payload.nbf !== void 0) {
    if (typeof payload.nbf !== "number") {
      throw new JWTClaimValidationFailed('"nbf" claim must be a number', payload, "nbf", "invalid");
    }
    if (payload.nbf > now + tolerance) {
      throw new JWTClaimValidationFailed('"nbf" claim timestamp check failed', payload, "nbf", "check_failed");
    }
  }
  if (payload.exp !== void 0) {
    if (typeof payload.exp !== "number") {
      throw new JWTClaimValidationFailed('"exp" claim must be a number', payload, "exp", "invalid");
    }
    if (payload.exp <= now - tolerance) {
      throw new JWTExpired('"exp" claim timestamp check failed', payload, "exp", "check_failed");
    }
  }
  if (maxTokenAge) {
    const age = now - payload.iat;
    const max = typeof maxTokenAge === "number" ? maxTokenAge : secs2(maxTokenAge);
    if (age - tolerance > max) {
      throw new JWTExpired('"iat" claim timestamp check failed (too far in the past)', payload, "iat", "check_failed");
    }
    if (age < 0 - tolerance) {
      throw new JWTClaimValidationFailed('"iat" claim timestamp check failed (it should be in the past)', payload, "iat", "check_failed");
    }
  }
  return payload;
}
__name(validateClaimsSet, "validateClaimsSet");
async function jwtVerify(jwt, key, options) {
  const verified = await compactVerify(jwt, key, options);
  if (verified.protectedHeader.crit?.includes("b64") && verified.protectedHeader.b64 === false) {
    throw new JWTInvalid2("JWTs MUST NOT use unencoded payload");
  }
  const payload = validateClaimsSet(verified.protectedHeader, verified.payload, options);
  const result = { payload, protectedHeader: verified.protectedHeader };
  if (typeof key === "function") {
    return { ...result, key: verified.key };
  }
  return result;
}
__name(jwtVerify, "jwtVerify");
function getKtyFromAlg(alg) {
  switch (typeof alg === "string" && alg.slice(0, 2)) {
    case "RS":
    case "PS":
      return "RSA";
    case "ES":
      return "EC";
    case "Ed":
      return "OKP";
    case "ML":
      return "AKP";
    default:
      throw new JOSENotSupported2('Unsupported "alg" value for a JSON Web Key Set');
  }
}
__name(getKtyFromAlg, "getKtyFromAlg");
function isJWKSLike(jwks) {
  return jwks && typeof jwks === "object" && Array.isArray(jwks.keys) && jwks.keys.every(isJWKLike);
}
__name(isJWKSLike, "isJWKSLike");
function isJWKLike(key) {
  return isObject2(key);
}
__name(isJWKLike, "isJWKLike");
var LocalJWKSet = class {
  static {
    __name(this, "LocalJWKSet");
  }
  #jwks;
  #cached = /* @__PURE__ */ new WeakMap();
  constructor(jwks) {
    if (!isJWKSLike(jwks)) {
      throw new JWKSInvalid("JSON Web Key Set malformed");
    }
    this.#jwks = structuredClone(jwks);
  }
  jwks() {
    return this.#jwks;
  }
  async getKey(protectedHeader, token) {
    const { alg, kid } = { ...protectedHeader, ...token?.header };
    const kty = getKtyFromAlg(alg);
    const candidates = this.#jwks.keys.filter((jwk2) => {
      let candidate = kty === jwk2.kty;
      if (candidate && typeof kid === "string") {
        candidate = kid === jwk2.kid;
      }
      if (candidate && (typeof jwk2.alg === "string" || kty === "AKP")) {
        candidate = alg === jwk2.alg;
      }
      if (candidate && typeof jwk2.use === "string") {
        candidate = jwk2.use === "sig";
      }
      if (candidate && Array.isArray(jwk2.key_ops)) {
        candidate = jwk2.key_ops.includes("verify");
      }
      if (candidate) {
        switch (alg) {
          case "ES256":
            candidate = jwk2.crv === "P-256";
            break;
          case "ES384":
            candidate = jwk2.crv === "P-384";
            break;
          case "ES512":
            candidate = jwk2.crv === "P-521";
            break;
          case "Ed25519":
          case "EdDSA":
            candidate = jwk2.crv === "Ed25519";
            break;
        }
      }
      return candidate;
    });
    const { 0: jwk, length } = candidates;
    if (length === 0) {
      throw new JWKSNoMatchingKey();
    }
    if (length !== 1) {
      const error = new JWKSMultipleMatchingKeys();
      const _cached = this.#cached;
      error[Symbol.asyncIterator] = async function* () {
        for (const jwk2 of candidates) {
          try {
            yield await importWithAlgCache(_cached, jwk2, alg);
          } catch {
          }
        }
      };
      throw error;
    }
    return importWithAlgCache(this.#cached, jwk, alg);
  }
};
async function importWithAlgCache(cache22, jwk, alg) {
  const cached = cache22.get(jwk) || cache22.set(jwk, {}).get(jwk);
  if (cached[alg] === void 0) {
    const key = await importJWK2({ ...jwk, ext: true }, alg);
    if (key instanceof Uint8Array || key.type !== "public") {
      throw new JWKSInvalid("JSON Web Key Set members must be public keys");
    }
    cached[alg] = key;
  }
  return cached[alg];
}
__name(importWithAlgCache, "importWithAlgCache");
function createLocalJWKSet(jwks) {
  const set = new LocalJWKSet(jwks);
  const localJWKSet = /* @__PURE__ */ __name(async (protectedHeader, token) => set.getKey(protectedHeader, token), "localJWKSet");
  Object.defineProperties(localJWKSet, {
    jwks: {
      value: /* @__PURE__ */ __name(() => structuredClone(set.jwks()), "value"),
      enumerable: false,
      configurable: false,
      writable: false
    }
  });
  return localJWKSet;
}
__name(createLocalJWKSet, "createLocalJWKSet");
function isCloudflareWorkers() {
  return typeof WebSocketPair !== "undefined" || typeof navigator !== "undefined" && true || typeof EdgeRuntime !== "undefined" && EdgeRuntime === "vercel";
}
__name(isCloudflareWorkers, "isCloudflareWorkers");
var USER_AGENT;
if (typeof navigator === "undefined" || !"Cloudflare-Workers"?.startsWith?.("Mozilla/5.0 ")) {
  const NAME = "jose";
  const VERSION = "v6.1.3";
  USER_AGENT = `${NAME}/${VERSION}`;
}
var customFetch = /* @__PURE__ */ Symbol();
async function fetchJwks(url, headers, signal, fetchImpl = fetch) {
  const response2 = await fetchImpl(url, {
    method: "GET",
    signal,
    redirect: "manual",
    headers
  }).catch((err) => {
    if (err.name === "TimeoutError") {
      throw new JWKSTimeout();
    }
    throw err;
  });
  if (response2.status !== 200) {
    throw new JOSEError2("Expected 200 OK from the JSON Web Key Set HTTP response");
  }
  try {
    return await response2.json();
  } catch {
    throw new JOSEError2("Failed to parse the JSON Web Key Set HTTP response as JSON");
  }
}
__name(fetchJwks, "fetchJwks");
var jwksCache = /* @__PURE__ */ Symbol();
function isFreshJwksCache(input, cacheMaxAge) {
  if (typeof input !== "object" || input === null) {
    return false;
  }
  if (!("uat" in input) || typeof input.uat !== "number" || Date.now() - input.uat >= cacheMaxAge) {
    return false;
  }
  if (!("jwks" in input) || !isObject2(input.jwks) || !Array.isArray(input.jwks.keys) || !Array.prototype.every.call(input.jwks.keys, isObject2)) {
    return false;
  }
  return true;
}
__name(isFreshJwksCache, "isFreshJwksCache");
var RemoteJWKSet = class {
  static {
    __name(this, "RemoteJWKSet");
  }
  #url;
  #timeoutDuration;
  #cooldownDuration;
  #cacheMaxAge;
  #jwksTimestamp;
  #pendingFetch;
  #headers;
  #customFetch;
  #local;
  #cache;
  constructor(url, options) {
    if (!(url instanceof URL)) {
      throw new TypeError("url must be an instance of URL");
    }
    this.#url = new URL(url.href);
    this.#timeoutDuration = typeof options?.timeoutDuration === "number" ? options?.timeoutDuration : 5e3;
    this.#cooldownDuration = typeof options?.cooldownDuration === "number" ? options?.cooldownDuration : 3e4;
    this.#cacheMaxAge = typeof options?.cacheMaxAge === "number" ? options?.cacheMaxAge : 6e5;
    this.#headers = new Headers(options?.headers);
    if (USER_AGENT && !this.#headers.has("User-Agent")) {
      this.#headers.set("User-Agent", USER_AGENT);
    }
    if (!this.#headers.has("accept")) {
      this.#headers.set("accept", "application/json");
      this.#headers.append("accept", "application/jwk-set+json");
    }
    this.#customFetch = options?.[customFetch];
    if (options?.[jwksCache] !== void 0) {
      this.#cache = options?.[jwksCache];
      if (isFreshJwksCache(options?.[jwksCache], this.#cacheMaxAge)) {
        this.#jwksTimestamp = this.#cache.uat;
        this.#local = createLocalJWKSet(this.#cache.jwks);
      }
    }
  }
  pendingFetch() {
    return !!this.#pendingFetch;
  }
  coolingDown() {
    return typeof this.#jwksTimestamp === "number" ? Date.now() < this.#jwksTimestamp + this.#cooldownDuration : false;
  }
  fresh() {
    return typeof this.#jwksTimestamp === "number" ? Date.now() < this.#jwksTimestamp + this.#cacheMaxAge : false;
  }
  jwks() {
    return this.#local?.jwks();
  }
  async getKey(protectedHeader, token) {
    if (!this.#local || !this.fresh()) {
      await this.reload();
    }
    try {
      return await this.#local(protectedHeader, token);
    } catch (err) {
      if (err instanceof JWKSNoMatchingKey) {
        if (this.coolingDown() === false) {
          await this.reload();
          return this.#local(protectedHeader, token);
        }
      }
      throw err;
    }
  }
  async reload() {
    if (this.#pendingFetch && isCloudflareWorkers()) {
      this.#pendingFetch = void 0;
    }
    this.#pendingFetch ||= fetchJwks(this.#url.href, this.#headers, AbortSignal.timeout(this.#timeoutDuration), this.#customFetch).then((json) => {
      this.#local = createLocalJWKSet(json);
      if (this.#cache) {
        this.#cache.uat = Date.now();
        this.#cache.jwks = json;
      }
      this.#jwksTimestamp = Date.now();
      this.#pendingFetch = void 0;
    }).catch((err) => {
      this.#pendingFetch = void 0;
      throw err;
    });
    await this.#pendingFetch;
  }
};
function createRemoteJWKSet(url, options) {
  const set = new RemoteJWKSet(url, options);
  const remoteJWKSet = /* @__PURE__ */ __name(async (protectedHeader, token) => set.getKey(protectedHeader, token), "remoteJWKSet");
  Object.defineProperties(remoteJWKSet, {
    coolingDown: {
      get: /* @__PURE__ */ __name(() => set.coolingDown(), "get"),
      enumerable: true,
      configurable: false
    },
    fresh: {
      get: /* @__PURE__ */ __name(() => set.fresh(), "get"),
      enumerable: true,
      configurable: false
    },
    reload: {
      value: /* @__PURE__ */ __name(() => set.reload(), "value"),
      enumerable: true,
      configurable: false,
      writable: false
    },
    reloading: {
      get: /* @__PURE__ */ __name(() => set.pendingFetch(), "get"),
      enumerable: true,
      configurable: false
    },
    jwks: {
      value: /* @__PURE__ */ __name(() => set.jwks(), "value"),
      enumerable: true,
      configurable: false,
      writable: false
    }
  });
  return remoteJWKSet;
}
__name(createRemoteJWKSet, "createRemoteJWKSet");
var keys = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
async function verifyToken(token, project, keyset = keys) {
  try {
    const { payload } = await jwtVerify(token, keyset, { algorithms: ["RS256"], issuer: `https://securetoken.google.com/${project}`, audience: project, requiredClaims: ["exp", "iat", "sub", "auth_time"] });
    const now = Math.floor(Date.now() / 1e3);
    if (typeof payload.sub !== "string" || !payload.sub.length || payload.sub.length > 128 || payload.iat > now || !Number.isFinite(payload.auth_time) || payload.auth_time > now) throw new Error("claims");
    return payload;
  } catch {
    throw new GameError("Tu sesi\xF3n venci\xF3. Volv\xE9 a iniciar sesi\xF3n.", 401);
  }
}
__name(verifyToken, "verifyToken");
async function authenticate(request, env) {
  const value2 = request.headers.get("Authorization") || "";
  if (!value2.startsWith("Bearer ") || value2.length > 8192) throw new GameError("Inici\xE1 sesi\xF3n para jugar.", 401);
  return verifyToken(value2.slice(7), env.FIREBASE_PROJECT_ID);
}
__name(authenticate, "authenticate");
async function boundedText208(request, limit) {
  if (!request.body) return "";
  const reader = request.body.getReader(), parts = [];
  let size = 0;
  try {
    for (; ; ) {
      const { done, value: value2 } = await reader.read();
      if (done) break;
      size += value2.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new GameError("Solicitud demasiado grande.", 413);
      }
      parts.push(value2);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
var cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
var response = /* @__PURE__ */ __name((body, status = 200) => Response.json(body, { status, headers: cors }), "response");
var cleanName = /* @__PURE__ */ __name((n) => typeof n === "string" ? n.trim().slice(0, 40) : "", "cleanName");
async function handle(request, env, identity = null, now = Date.now()) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const path = new URL(request.url).pathname;
  if (path === "/health" && request.method === "GET") {
    await env.DB.prepare("SELECT uid FROM wallets LIMIT 1").bind().first();
    return response({ service: "pml-games", version: "2.0.8", rules: 1, practice: true, bets: true, posts: true });
  }
  if (!["GET", "POST"].includes(request.method)) throw new GameError("M\xE9todo no permitido.", 405);
  const user = identity || await authenticate(request, env), uid = user.sub;
  const db = env.DB.withSession ? env.DB.withSession("first-primary") : env.DB;
  const q = /* @__PURE__ */ __name((sql, ...v) => db.prepare(sql).bind(...v), "q");
  if (path === "/league/publish" && uid !== env.OWNER_UID && !await moderator(request, env, uid)) throw new GameError("No ten\xE9s permiso para publicar cambios del torneo.", 403);
  const bodyLimit = path === "/league/publish" ? 20 * 1024 * 1024 : path.startsWith("/posts/") ? 145e4 : 4096;
  if (request.method === "POST" && Number(request.headers.get("Content-Length") || 0) > bodyLimit) throw new GameError("Solicitud demasiado grande.", 413);
  let body = {};
  if (request.method === "POST") {
    const text = await boundedText208(request, bodyLimit);
    if (text.length > bodyLimit) throw new GameError("Solicitud demasiado grande.", 413);
    try {
      body = JSON.parse(text);
    } catch {
      throw new GameError("Solicitud inv\xE1lida.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new GameError("Solicitud inv\xE1lida.");
  }
  if (path.startsWith("/league/")) return response(await gateway208(path, body, user, { env, request, moderator }));
  if (path.startsWith("/posts/")) return response(await posts(path, body, user, { request, env, db, now }));
  if (path.startsWith("/bets/") || path.startsWith("/practice/bets/")) return response(await bets(path, body, user, { request, env, db, now }));
  if (path.startsWith("/practice/")) {
    if (request.method !== "POST") throw new GameError("M\xE9todo no permitido.", 405);
    return response(await practice(path, body, user, q, now));
  }
  await q("INSERT OR IGNORE INTO wallets(uid,name,created_at) VALUES(?,?,?)", uid, cleanName(user.name) || "Jugador " + uid.slice(-5), now).run();
  if (path === "/me" && request.method === "POST") {
    const name = cleanName(body.name);
    if (name) await q("UPDATE wallets SET name=? WHERE uid=?", name, uid).run();
  }
  const day2 = dateAR(now).day;
  if (path === "/me" || path === "/games/start") await q("UPDATE games SET status='expired',updated_at=? WHERE uid=? AND status='active' AND day<>?", now, uid, day2).run();
  if (path === "/me") {
    const wallet = await q("SELECT name,balance FROM wallets WHERE uid=?", uid).first();
    const games = await q("SELECT * FROM games WHERE uid=? AND day=?", uid, day2).all();
    const movements = await q("SELECT amount,reason,at FROM ledger WHERE uid=? ORDER BY at DESC,rowid DESC LIMIT 30", uid).all();
    return response({ wallet, games: games.results.map(publicGame), movements: movements.results, day: day2, available: { mines: available("mines", now), penalties: available("penalties", now) } });
  }
  if (path === "/ranking" && request.method === "GET") {
    const rows = await q("SELECT name,balance,uid=? AS me FROM wallets ORDER BY balance DESC,created_at ASC LIMIT 50", uid).all();
    return response({ ranking: rows.results });
  }
  if (path === "/games/start" && request.method === "POST") {
    const kind = body.kind;
    if (!available(kind, now)) throw new GameError(kind === "mines" ? "Buscaminas est\xE1 disponible lunes y martes." : "Penales est\xE1 disponible mi\xE9rcoles y jueves.", 403);
    const old = await q("SELECT * FROM games WHERE uid=? AND kind=? AND day=?", uid, kind, day2).first();
    if (old) return response({ game: publicGame(old) });
    const g = createGame(kind), id = crypto.randomUUID();
    try {
      await q("INSERT INTO games(id,uid,kind,day,status,secret,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)", id, uid, kind, day2, g.status, JSON.stringify(g.secret), JSON.stringify(g.state), now, now).run();
    } catch (e) {
      const existing = await q("SELECT * FROM games WHERE uid=? AND kind=? AND day=?", uid, kind, day2).first();
      if (existing) return response({ game: publicGame(existing) });
      const w = await q("SELECT balance FROM wallets WHERE uid=?", uid).first();
      if (w.balance < 25) throw new GameError("No ten\xE9s fichas suficientes para el ticket.", 409);
      throw e;
    }
    return response({ game: publicGame(await q("SELECT * FROM games WHERE id=?", id).first()) });
  }
  if (path === "/games/action" && request.method === "POST") {
    if (typeof body.id !== "string" || !Number.isInteger(body.version)) throw new GameError("Partida inv\xE1lida.");
    const row = await q("SELECT * FROM games WHERE id=? AND uid=?", body.id, uid).first();
    if (!row) throw new GameError("Partida no encontrada.", 404);
    if (row.day !== day2) throw new GameError("La partida venci\xF3 al finalizar el d\xEDa.", 409);
    if (row.version !== body.version) throw new GameError("La partida cambi\xF3. Actualiz\xE1 para continuar.", 409);
    const next = playGame({ ...row, secret: JSON.parse(row.secret), state: JSON.parse(row.state) }, body.action || {});
    const result = await q("UPDATE games SET state=?,status=?,payout=?,version=version+1,updated_at=? WHERE id=? AND uid=? AND version=? AND status='active' RETURNING id", JSON.stringify(next.state), next.status, next.payout, now, row.id, uid, row.version).first();
    if (!result) throw new GameError("La jugada ya fue procesada. Actualiz\xE1 para continuar.", 409);
    return response({ game: publicGame(await q("SELECT * FROM games WHERE id=?", row.id).first()) });
  }
  if (path === "/admin/grant" && request.method === "POST") {
    if (uid !== env.OWNER_UID) throw new GameError("Solo el administrador puede entregar fichas.", 403);
    if (typeof body.id !== "string" || !/^[-a-zA-Z0-9]{16,64}$/.test(body.id)) throw new GameError("Entrega inv\xE1lida.");
    if (await q("SELECT id FROM grants WHERE id=?", body.id).first()) return response({ ok: true });
    let token = "", profiles = [];
    do {
      const url = new URL("https://firestore.googleapis.com/v1/projects/" + env.FIREBASE_PROJECT_ID + "/databases/(default)/documents/profiles");
      url.searchParams.set("pageSize", "1000");
      if (token) url.searchParams.set("pageToken", token);
      const res = await fetch(url, { headers: { Authorization: request.headers.get("Authorization") || "" }, signal: AbortSignal.timeout(1e4) });
      if (!res.ok) throw new GameError("No se pudieron consultar los usuarios registrados. No se realiz\xF3 la entrega.", 503);
      const page = await res.json();
      for (const d of page.documents || []) {
        const id = d.name?.split("/").pop();
        if (typeof id === "string" && id.length > 0 && id.length <= 128) profiles.push({ uid: id, name: cleanName(d.fields?.name?.stringValue) || "Jugador " + id.slice(-5) });
      }
      token = page.nextPageToken || "";
      if (profiles.length > 1e4) throw new GameError("La lista de usuarios supera el l\xEDmite de esta entrega.", 503);
    } while (token);
    await q("INSERT OR IGNORE INTO wallets(uid,name,created_at) SELECT json_extract(value,'$.uid'),json_extract(value,'$.name'),? FROM json_each(?)", now, JSON.stringify(profiles)).run();
    await q("INSERT OR IGNORE INTO grants(id,at) VALUES(?,?)", body.id, now).run();
    return response({ ok: true });
  }
  throw new GameError("Ruta inexistente.", 404);
}
__name(handle, "handle");
var worker_default = { async fetch(request, env) {
  try {
    return await handle(request, { ...env, FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID || "pro-mobile-league", OWNER_UID: env.OWNER_UID || "iCLoGhjbXNgY3Q7dbxX0456vagI2" });
  } catch (e) {
    if (e instanceof GameError || e.expose208) return response({ error: e.message, ...e.code ? { code: e.code } : {} }, e.status);
    console.error("PML games failure", e?.name);
    return response({ error: "El servidor no pudo completar la operaci\xF3n. Tu partida se conserva." }, 503);
  }
} };
export {
  worker_default as default,
  handle
};
