import { CardanoNetwork } from "@blockfrost/blockfrost-js/lib/types";
import { NextRequest } from "next/server";
import Blockfrost from "~/services/blockfrost";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const network: CardanoNetwork = searchParams.get("network") as CardanoNetwork;

    const blockfrost = new Blockfrost(
        network === "preprod"
            ? process.env.BLOCKFROST_PROJECT_API_KEY_PREPROD!
            : process.env.BLOCKFROST_PROJECT_API_KEY_MAINNET!,
        network as CardanoNetwork,
    );

    const addressesTotal = await blockfrost.addressesTotal(
        network === "preprod"
            ? process.env.DUALTARGET_CONTRACT_ADDRESS_PREPROD!
            : process.env.DUALTARGET_CONTRACT_ADDRESS_MAINNET!,
    );

    const totalVolumeDepositsADA = addressesTotal.received_sum.reduce(
        (accumulator, currentValue) => {
            if (currentValue.unit === "lovelace") {
                return accumulator + parseInt(currentValue.quantity) / 1000000;
            }
            return accumulator;
        },
        0,
    );

    const totalVolumeWithdrawsADA = addressesTotal.sent_sum.reduce((accumulator, currentValue) => {
        if (currentValue.unit === "lovelace") {
            return accumulator + parseInt(currentValue.quantity) / 1000000;
        }
        return accumulator;
    }, 0);

    const totalVolumeWithdrawsDJED = addressesTotal.received_sum.reduce(
        (accumulator, currentValue) => {
            if (currentValue.unit === process.env.MIN_TOKEN_ASSET_PREPROD) {
                return accumulator + parseInt(currentValue.quantity) / 1000000;
            }
            return accumulator;
        },
        0,
    );

    const totalTransaction: number = addressesTotal.tx_count;

    // const totalTxHash = await Promise.all(
    //     [...new Array(1)].map(async (element, index: number) => {
    //         console.log(index);
    //         const txHashes = await blockfrost.addressesTransactions(
    //             network === "preprod"
    //                 ? process.env.DUALTARGET_CONTRACT_ADDRESS_PREPROD!
    //                 : process.env.DUALTARGET_CONTRACT_ADDRESS_MAINNET!,
    //             {
    //                 page: index,
    //             },
    //         );
    //         const utxos = await Promise.all(
    //             txHashes.map(async function ({ tx_hash }) {
    //                 const utxo = await blockfrost.txsUtxos(tx_hash);
    //                 console.log(utxo);
    //             }),
    //         );
    //         return utxos;
    //     }),
    // );
    return Response.json({
        totalTransaction: totalTransaction,
        totalVolumeWithdrawsDJED: totalVolumeWithdrawsDJED,
        totalVolumeWithdrawsADA: totalVolumeWithdrawsADA,
        totalVolumeDepositsADA: totalVolumeDepositsADA,
        totalVolumnProfits: 0,
    });
}
