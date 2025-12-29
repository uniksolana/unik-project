import { PublicKey } from '@solana/web3.js';

// Replaced automatically during build/deployment
export const PROGRAM_ID = new PublicKey('ASA8xRVPFBQLo3dLJQH2NedBKJWsVXGu46radY6oRX6i');

export const IDL = {
    "version": "0.1.0",
    "name": "unik_anchor",
    "metadata": {
        "address": "ASA8xRVPFBQLo3dLJQH2NedBKJWsVXGu46radY6oRX6i"
    },
    "instructions": [
        {
            "name": "registerAlias",
            "accounts": [
                { "name": "aliasAccount", "isMut": true, "isSigner": false },
                { "name": "user", "isMut": true, "isSigner": true },
                { "name": "systemProgram", "isMut": false, "isSigner": false }
            ],
            "args": [
                { "name": "alias", "type": "string" },
                { "name": "metadataUri", "type": "string" }
            ]
        },
        {
            "name": "setRouteConfig",
            "accounts": [
                { "name": "routeAccount", "isMut": true, "isSigner": false },
                { "name": "aliasAccount", "isMut": false, "isSigner": false },
                { "name": "user", "isMut": true, "isSigner": true },
                { "name": "systemProgram", "isMut": false, "isSigner": false }
            ],
            "args": [
                { "name": "alias", "type": "string" },
                { "name": "splits", "type": { "vec": { "defined": "Split" } } }
            ]
        },
        {
            "name": "executeTransfer",
            "accounts": [
                { "name": "routeAccount", "isMut": false, "isSigner": false },
                { "name": "user", "isMut": true, "isSigner": true },
                { "name": "systemProgram", "isMut": false, "isSigner": false }
            ],
            "args": [
                { "name": "alias", "type": "string" },
                { "name": "amount", "type": "u64" }
            ]
        }
    ],
    "accounts": [
        {
            "name": "AliasAccount",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "owner", "type": "publicKey" },
                    { "name": "alias", "type": "string" },
                    { "name": "metadataUri", "type": "string" },
                    { "name": "bump", "type": "u8" }
                ]
            }
        },
        {
            "name": "RouteAccount",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "aliasRef", "type": "publicKey" },
                    { "name": "splits", "type": { "vec": { "defined": "Split" } } },
                    { "name": "bump", "type": "u8" }
                ]
            }
        }
    ],
    "types": [
        {
            "name": "Split",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "recipient", "type": "publicKey" },
                    { "name": "percentage", "type": "u16" }
                ]
            }
        },
        {
            "name": "UnikError",
            "type": {
                "kind": "enum",
                "variants": [
                    { "name": "Unauthorized" },
                    { "name": "InvalidSplitTotal" },
                    { "name": "Overflow" },
                    { "name": "MissingRecipient" }
                ]
            }
        }
    ],
    "errors": [
        { "code": 6000, "name": "Unauthorized", "msg": "You are not the owner of this alias." },
        { "code": 6001, "name": "InvalidSplitTotal", "msg": "Split percentages exceed 100%." },
        { "code": 6002, "name": "Overflow", "msg": "Arithmetic overflow." },
        { "code": 6003, "name": "MissingRecipient", "msg": "Recipient account missing in remaining_accounts." }
    ]
};
