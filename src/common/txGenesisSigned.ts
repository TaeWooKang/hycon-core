
import { getLogger } from "log4js"
import Long = require("long")
import secp256k1 = require("secp256k1")
import * as proto from "../serialization/proto"
import { Hash } from "../util/hash"
import { Address } from "./address"
import { PublicKey } from "./publicKey"
const logger = getLogger("TxGenesisSigned")

export class GenesisSignedTx implements proto.ITx {
    public static decode(data: Uint8Array): GenesisSignedTx {
        const genesisStx = proto.Tx.decode(data)
        return new GenesisSignedTx(genesisStx)
    }
    public to: Address
    public amount: Long
    public signature: Buffer
    public recovery: number

    constructor(tx?: proto.ITx, signature?: Uint8Array, recovery?: number) {
        if (tx) {
            if (signature !== undefined) {
                if (tx.signature === undefined) {
                    tx.signature = signature
                } else { throw new Error("Two signature information exists.") }
            }
            if (recovery !== undefined) {
                if (tx.recovery === undefined) {
                    tx.recovery = recovery
                } else { throw new Error("Two recovery information exists.") }
            }
            this.set(tx)
        }
    }

    public set(stx: proto.ITx): void {
        if (stx.to === undefined) { throw (new Error("to address not defined in input")) }
        if (stx.amount === undefined) { throw (new Error("amount not defined in input")) }
        if (stx.signature === undefined) { throw (new Error("signature not defined in input")) }
        if (stx.recovery === undefined) { throw (new Error("recovery not defined in input")) }

        this.to = new Address(stx.to)
        this.amount = stx.amount instanceof Long ? stx.amount : Long.fromNumber(stx.amount, true)
        if (!this.amount.unsigned) {
            logger.fatal(`Protobuf problem with GenesisSignedTx amount`)
            throw new Error("Protobuf problem with GenesisSignedTx amount")
        }
        this.signature = Buffer.from(stx.signature as Buffer)
        this.recovery = stx.recovery
    }

    public verify(): boolean {
        // Consensus Critical
        try {
            if (this.signature === undefined || this.recovery === undefined) { return false }
            const hash = new Hash(this).toBuffer()
            const pubKey = new PublicKey(secp256k1.recover(hash, this.signature, this.recovery))
            const address = pubKey.address()
            if (!this.to.equals(address)) { return false }
            return secp256k1.verify(hash, this.signature, pubKey.pubKey)
        } catch (e) {
            return false
        }
    }

    public encode(): Uint8Array {
        return proto.Tx.encode(this).finish()
    }
}
