"use client";

import { Data, Lucid, TxHash, TxSigned, UTxO, Credential, OutputData, C, Lovelace, Address } from "lucid-cardano";
import React, { ReactNode, useContext, useState } from "react";
import SmartContractContext from "~/contexts/components/SmartContractContext";
import { useMutation } from "@tanstack/react-query";
import { ClaimableUTxO, CalculateSellingStrategy, TransactionType } from "~/types/GenericsType";
import calculateSellingStrategy from "~/utils/calculate-selling-strategy";
import { DualtargetDatum } from "~/constants/datum";
import { refundRedeemer } from "~/constants/redeemer";
import readDatum from "~/utils/read-datum";
import { WalletContextType } from "~/types/contexts/WalletContextType";
import WalletContext from "../components/WalletContext";
import { post } from "~/utils/http-requests";
import { AccountContextType } from "~/types/contexts/AccountContextType";
import AccountContext from "../components/AccountContext";

type Props = {
    children: ReactNode;
};

const SmartContractProvider = function ({ children }: Props) {
    const { refresh } = useContext<WalletContextType>(WalletContext);
    const { account } = useContext<AccountContextType>(AccountContext);

    const transactionMutation = useMutation({
        mutationFn: function (body: TransactionType) {
            return post("/transaction", { body });
        },
    }); //

    const [txHashDeposit, setTxHashDeposit] = useState<TxHash>("");
    const [txHashWithdraw, setTxHashWithdraw] = useState<TxHash>("");
    const [waitingDeposit, setWaitingDeposit] = useState<boolean>(false);
    const [waitingWithdraw, setWaitingWithdraw] = useState<boolean>(false);

    const deposit = async function ({
        lucid,
        income,
        priceHight,
        priceLow,
        stake,
        step,
        totalADA,
    }: {
        lucid: Lucid;
        income: number;
        priceHight: number;
        priceLow: number;
        stake: number;
        step: number;
        totalADA: number;
    }) {
        try {
            setWaitingDeposit(true);

            const sellingStrategies: CalculateSellingStrategy[] = calculateSellingStrategy({
                income: income, // Bao nhiêu $ một tháng ==> Nhận bao nhiêu dola 1 tháng = 5
                priceHight: priceHight * 1000000, //  Giá thấp nhất =  2000000
                priceLow: priceLow * 1000000, // Giá cao nhất = 1000000
                stake: stake, //  ROI % stake theo năm = 5
                step: step, // Bước nhảy theo giá (%) = 10
                totalADA: totalADA * 1000000, // Tổng ada = 24000000
            });

            console.log("Selling: ", sellingStrategies);

            const contractAddress: string = process.env.DUALTARGET_CONTRACT_ADDRESS_PREPROD! as string;
            const datumParams = await readDatum({ contractAddress: contractAddress, lucid: lucid });

            const vkeyOwnerHash: string = lucid.utils.getAddressDetails(await lucid.wallet.address()).paymentCredential?.hash as string;
            const vkeyBeneficiaryHash: string = lucid.utils.getAddressDetails(contractAddress).paymentCredential?.hash as string;

            const datums: any[] = sellingStrategies.map(function (sellingStrategy: CalculateSellingStrategy, index: number) {
                return Data.to<DualtargetDatum>(
                    {
                        odOwner: vkeyOwnerHash,
                        odBeneficiary: vkeyBeneficiaryHash,
                        assetADA: { policyId: datumParams.assetAda.policyId, assetName: datumParams.assetAda.assetName },
                        amountADA: BigInt(sellingStrategy.amountSend),
                        assetOut: { policyId: datumParams.assetOut.policyId, assetName: datumParams.assetOut.assetName },
                        minimumAmountOut: BigInt(sellingStrategy.minimumAmountOut),
                        minimumAmountOutProfit: BigInt(sellingStrategy.minimumAmountOutProfit),
                        buyPrice: BigInt(sellingStrategy.buyPrice),
                        sellPrice: BigInt(sellingStrategy.sellPrice),
                        odStrategy: datumParams.odStrategy,
                        batcherFee: datumParams.batcherFee,
                        outputADA: datumParams.outputADA,
                        feeAddress: datumParams.feeAddress,
                        validatorAddress: datumParams.validatorAddress,
                        deadline: BigInt(new Date().getTime() + 10 * 1000),
                        isLimitOrder: BigInt(0),
                    },
                    DualtargetDatum,
                );
            });

            console.log("datum " + datums);

            let tx: any = lucid.newTx();

            sellingStrategies.forEach(async function (sellingStrategy: CalculateSellingStrategy, index: number) {
                tx = await tx.payToContract(contractAddress, { inline: datums[index] }, { lovelace: BigInt(sellingStrategy.amountSend) });
            });

            tx = await tx.complete();

            const signedTx: TxSigned = await tx.sign().complete();
            const txHash: TxHash = await signedTx.submit();
            const success: boolean = await lucid.awaitTx(txHash);
            if (success) {
                setTxHashDeposit(txHash);
                await refresh();
                transactionMutation.mutate({
                    tx_hash: txHash,
                    account_id: account?.id!,
                    action: "Withdraw",
                    amount: "",
                    date: "",
                    status: "",
                });
            }
        } catch (error) {
            console.log(error);
        } finally {
            setWaitingDeposit(false);
        }
    };

    const withdraw = async function ({ lucid }: { lucid: Lucid }) {
        try {
            setWaitingWithdraw(false);
            const paymentAddress: string = lucid.utils.getAddressDetails(await lucid.wallet.address()).paymentCredential?.hash as string;
            const contractAddress: string = process.env.DUALTARGET_CONTRACT_ADDRESS_PREPROD! as string;
            const scriptUtxos: UTxO[] = await lucid.utxosAt(contractAddress);

            let smartcontractUtxo: UTxO | undefined = scriptUtxos.find(function (scriptUtxo: UTxO) {
                return scriptUtxo.scriptRef?.script;
            });

            if (!smartcontractUtxo) throw new Error("Cound not find smart contract utxo");
            const datumParams = await readDatum({ contractAddress: contractAddress, lucid: lucid });
            const claimableUtxos: ClaimableUTxO[] = [];
            for (const scriptUtxo of scriptUtxos) {
                if (scriptUtxo.scriptRef?.script) {
                    smartcontractUtxo = scriptUtxo;
                    const outputDatum: any = Data.from(scriptUtxo.datum!);
                    console.log(outputDatum.fields[2]);
                } else if (scriptUtxo.datum) {
                    const outputDatum: any = Data.from(scriptUtxo.datum!);
                    console.log(outputDatum);
                    const params = {
                        odOwner: outputDatum.fields[0],
                        odBeneficiary: outputDatum.fields[1],
                        assetADA: { policyId: datumParams.assetAda.policyId, assetName: datumParams.assetAda.assetName },
                        amountA: outputDatum.fields[3],
                        assetOut: { policyId: datumParams.assetOut.policyId, assetName: datumParams.assetOut.assetName },
                        minimumAmountOut: outputDatum.fields[5],
                        minimumAmountOutProfit: outputDatum.fields[6],
                        buyPrice: outputDatum.fields[7],
                        sellPrice: outputDatum.fields[8],
                        odStrategy: datumParams.odStrategy,
                        batcherFee: datumParams.batcherFee,
                        outputADA: datumParams.outputADA,
                        feeAddress: datumParams.feeAddress,
                        validatorAddress: datumParams.validatorAddress,
                        deadline: outputDatum.fields[14],
                        isLimitOrder: outputDatum.fields[15],
                    };

                    /**
                     * 1. Lấy tất cả
                     * 2. Lấy UTXO DJED
                     * 3. Lấy UTXO Profit
                     */

                    if (
                        String(params.odOwner) === String(paymentAddress) // Lấy tất cả =  Djed + Profit
                        // Number(scriptUtxo.assets.lovelace) => 113590909 && Number(scriptUtxo.assets.lovelace) <= 113590909 // UTXO djed // Lấy Djed
                        // Number(params.isLimitOrder) === 0 // UTXO profit (chua co)
                    ) {
                        let winter_addr: Credential = { type: "Key", hash: params.feeAddress };
                        const freeAddress1 = lucid.utils.credentialToAddress(winter_addr);

                        claimableUtxos.push({
                            utxo: scriptUtxo,
                            BatcherFee_addr: String(freeAddress1),
                            fee: params.batcherFee,
                            minimumAmountOut: params.minimumAmountOut, // Số lượng profit
                            minimumAmountOutProfit: params.minimumAmountOutProfit,
                        });
                    }
                }
            }

            if (!smartcontractUtxo) {
                console.log("Reference UTxO not found!");
                return;
            }

            if (claimableUtxos.length === 0) {
                console.log("No utxo to claim!");
                return;
            }

            let tx: any = lucid.newTx().readFrom([smartcontractUtxo]);
            for (const utxoToSpend of claimableUtxos) {
                tx = await tx.collectFrom([utxoToSpend.utxo], refundRedeemer);
            }
            tx = await tx
                .payToAddress(claimableUtxos[0].BatcherFee_addr, { lovelace: BigInt(claimableUtxos[0].fee) as Lovelace })
                .addSigner((await lucid.wallet.address()) as Address)
                .complete();

            const signedTx: TxSigned = await tx.sign().complete();
            const txHash: TxHash = await signedTx.submit();
            const success: boolean = await lucid.awaitTx(txHash);
            if (success) {
                setTxHashWithdraw(txHash);
                await refresh();
                transactionMutation.mutate({
                    tx_hash: txHash,
                    account_id: account?.id!,
                    action: "Withdraw",
                    amount: "",
                    date: "",
                    status: "",
                });
            }
        } catch (error) {
            console.log(error);
        } finally {
            setWaitingWithdraw(true);
        }
    };

    return (
        <SmartContractContext.Provider value={{ deposit, withdraw, txHashDeposit, txHashWithdraw, waitingDeposit, waitingWithdraw }}>
            {children}
        </SmartContractContext.Provider>
    );
};

export default SmartContractProvider;
