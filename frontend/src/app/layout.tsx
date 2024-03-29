import "./globals.scss";
import React, { ReactNode } from "react";
import type { Metadata } from "next";
import ContextProvider from "~/contexts";
import { PublicLayout } from "~/layouts";
import NetworkConnectionStatus from "~/components/NetworkConnectionStatus";

import historyPrice from "~/utils/history-price";
export const metadata: Metadata = {
    title: { default: "Dualtarget", template: "%s - Dualtarget" },
    description: "Dualtarget for ADA-Holders (Staking and increasing assets) with a decentralized automated trading bot",
    twitter: {
        card: "summary_large_image",
    },
};

type Props = {
    children: ReactNode;
};

const RootLayout = function ({ children }: Readonly<Props>) {
    historyPrice();
    return (
        <html lang="en">
            <body>
                <ContextProvider>
                    <PublicLayout>{children}</PublicLayout>
                    <NetworkConnectionStatus />
                </ContextProvider>
            </body>
        </html>
    );
};

export default RootLayout;