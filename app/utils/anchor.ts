import { PublicKey } from '@solana/web3.js';

// Replaced automatically during build/deployment
export const PROGRAM_ID = new PublicKey('ASA8xRVPFBQLo3dLJQH2NedBKJWsVXGu46radY6oRX6i');

export const IDL = {
    "address": "ASA8xRVPFBQLo3dLJQH2NedBKJWsVXGu46radY6oRX6i",
    "metadata": {
        "name": "unik_anchor",
        "version": "0.1.0",
        "spec": "0.1.0"
    },
    "instructions": [
        {
            "name": "close_payment_request",
            "discriminator": [38, 95, 44, 68, 199, 144, 86, 25],
            "accounts": [
                { "name": "payment_request", "writable": true },
                { "name": "receiver_alias" },
                { "name": "receiver", "writable": true, "signer": true },
                { "name": "system_program", "address": "11111111111111111111111111111111" }
            ],
            "args": []
        },
        {
            "name": "create_payment_request",
            "discriminator": [246, 150, 103, 37, 15, 36, 93, 100],
            "accounts": [
                { "name": "payment_request", "writable": true },
                { "name": "sender", "writable": true, "signer": true },
                { "name": "system_program", "address": "11111111111111111111111111111111" }
            ],
            "args": [
                { "name": "recipient_alias", "type": "string" },
                { "name": "amount", "type": "u64" },
                { "name": "concept", "type": "string" }
            ]
        },
        {
            "name": "execute_transfer",
            "discriminator": [233, 126, 160, 184, 235, 206, 31, 119],
            "accounts": [
                { "name": "route_account" },
                { "name": "user", "writable": true, "signer": true },
                { "name": "system_program", "address": "11111111111111111111111111111111" }
            ],
            "args": [
                { "name": "_alias", "type": "string" },
                { "name": "amount", "type": "u64" }
            ]
        },
        {
            "name": "register_alias",
            "discriminator": [238, 148, 116, 46, 158, 97, 139, 53],
            "accounts": [
                { "name": "alias_account", "writable": true },
                { "name": "user", "writable": true, "signer": true },
                { "name": "system_program", "address": "11111111111111111111111111111111" }
            ],
            "args": [
                { "name": "alias", "type": "string" },
                { "name": "metadata_uri", "type": "string" }
            ]
        },
        {
            "name": "set_route_config",
            "discriminator": [56, 240, 67, 199, 86, 53, 149, 27],
            "accounts": [
                { "name": "route_account", "writable": true },
                { "name": "alias_account" },
                { "name": "user", "writable": true, "signer": true },
                { "name": "system_program", "address": "11111111111111111111111111111111" }
            ],
            "args": [
                { "name": "alias", "type": "string" },
                { "name": "splits", "type": { "vec": { "defined": { "name": "Split" } } } }
            ]
        }
    ],
    "accounts": [
        { "name": "AliasAccount", "discriminator": [64, 156, 83, 11, 51, 54, 23, 155] },
        { "name": "PaymentRequest", "discriminator": [27, 20, 202, 96, 101, 242, 124, 69] },
        { "name": "RouteAccount", "discriminator": [135, 89, 73, 184, 33, 21, 243, 86] }
    ],
    "errors": [
        { "code": 6000, "name": "Unauthorized", "msg": "You are not the owner of this alias." },
        { "code": 6001, "name": "InvalidSplitTotal", "msg": "Split percentages exceed 100%." },
        { "code": 6002, "name": "Overflow", "msg": "Arithmetic overflow." },
        { "code": 6003, "name": "MissingRecipient", "msg": "Recipient account missing in remaining_accounts." },
        { "code": 6004, "name": "InvalidAliasLength", "msg": "Alias must be between 3 and 32 characters." },
        { "code": 6005, "name": "InvalidAliasCharacters", "msg": "Alias must contain only lowercase alphanumeric characters and underscores." },
        { "code": 6006, "name": "MetadataTooLong", "msg": "Metadata URI exceeds 200 characters." },
        { "code": 6007, "name": "TooManySplits", "msg": "Maximum 5 splits allowed." },
        { "code": 6008, "name": "DuplicateRecipient", "msg": "Duplicate recipient in splits." },
        { "code": 6009, "name": "SelfReference", "msg": "Cannot route funds to the alias or route account itself." }
    ],
    "types": [
        {
            "name": "AliasAccount",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "owner", "type": "pubkey" },
                    { "name": "alias", "type": "string" },
                    { "name": "metadata_uri", "type": "string" },
                    { "name": "bump", "type": "u8" }
                ]
            }
        },
        {
            "name": "PaymentRequest",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "sender", "type": "pubkey" },
                    { "name": "recipient_alias", "type": "string" },
                    { "name": "amount", "type": "u64" },
                    { "name": "concept", "type": "string" },
                    { "name": "timestamp", "type": "i64" },
                    { "name": "bump", "type": "u8" }
                ]
            }
        },
        {
            "name": "RouteAccount",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "alias_ref", "type": "pubkey" },
                    { "name": "splits", "type": { "vec": { "defined": { "name": "Split" } } } },
                    { "name": "bump", "type": "u8" }
                ]
            }
        },
        {
            "name": "Split",
            "type": {
                "kind": "struct",
                "fields": [
                    { "name": "recipient", "type": "pubkey" },
                    { "name": "percentage", "type": "u16" }
                ]
            }
        }
    ]
};
