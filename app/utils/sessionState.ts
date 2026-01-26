
// Global state for session security
// Holds the derived encryption key in memory (never stored to disk)

let sessionEncryptionKey: CryptoKey | null = null;

export const getSessionKey = () => sessionEncryptionKey;
export const setSessionKey = (key: CryptoKey) => { sessionEncryptionKey = key; };
