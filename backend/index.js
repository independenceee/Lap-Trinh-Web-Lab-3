const mintAssetPolicyId = async function ({
    lucid,
    title,
    description,
    imageUrl,
    mediaType,
    customMetadata,
    policyIdCollection,
}: Props): Promise<any> {
    try {
        const { mintingPolicy, policyId } = await mintingPolicyId({
            lucid: lucid,
        });

        const assetName = fromText(title);
        const cleanedData = Object.fromEntries(
            Object.entries(customMetadata).filter(([key, value]) => key !== "")
        );
        const tx = await lucid
            .newTx()
            .mintAssets({ [policyId + assetName]: BigInt(1) })
            .attachMetadata(721, {
                [policyId]: {
                    [title]: {
                        collection: policyIdCollection,
                        name: title,
                        description: description,
                        image: imageUrl,
                        mediaType: mediaType,
                        ...cleanedData,
                    },
                },
            })
            .validTo(Date.now() + 200000)
            .attachMintingPolicy(mintingPolicy)
            .complete();
        const signedTx = await tx.sign().complete();
        const txHash = await signedTx.submit();

        const success = await lucid.awaitTx(txHash);
        if (success) return txHash;
    } catch (error) {
        console.log(error);
    }
};
