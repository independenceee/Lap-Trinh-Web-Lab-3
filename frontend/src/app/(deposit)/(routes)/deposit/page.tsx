"use client";

import classNames from "classnames/bind";
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Card from "~/components/Card";
import icons from "~/assets/icons";
import Orders from "~/components/Orders";
import styles from "./Deposit.module.scss";
import Image from "next/image";
import { SmartContractContextType } from "~/types/contexts/SmartContractContextType";
import SmartContractContext from "~/contexts/components/SmartContractContext";
import { LucidContextType } from "~/types/contexts/LucidContextType";
import LucidContext from "~/contexts/components/LucidContext";
import { CalculateSellingStrategy, ChartDataType, TransactionHistoryType, TransactionResponseType } from "~/types/GenericsType";
import Tippy from "~/components/Tippy";
import { Controller, useForm } from "react-hook-form";
import Button from "~/components/Button";
import Loading from "~/components/Loading";
import InputNumber from "~/components/InputNumber";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ChartHistoryRecord } from "~/types/GenericsType";
import { CHART_TIME_PERIOD } from "~/components/PriceChart/PriceChart";
import CustomChart from "~/components/CustomChart";
import { AccountContextType } from "~/types/contexts/AccountContextType";
import AccountContext from "~/contexts/components/AccountContext";
import calculateSellingStrategy from "~/utils/calculate-selling-strategy";
import { WalletContextType } from "~/types/contexts/WalletContextType";
import WalletContext from "~/contexts/components/WalletContext";
import CountUp from "react-countup";

const cx = classNames.bind(styles);

type DepositeType = {
    income: string;
    priceHight: string;
    priceLow: string;
    stake: string;
    step: string;
    totalADA: string;
};

const Deposit = function () {
    const { account } = useContext<AccountContextType>(AccountContext);
    const { wallet } = useContext<WalletContextType>(WalletContext);
    const [page, setPage] = useState<number>(1);
    const [sellingStrategies, setSellingStrategies] = useState<CalculateSellingStrategy[]>([]);
    // TODO: DATA => Transfer
    const { data, isLoading, isError } = useQuery({
        queryKey: ["Transactions", page],
        queryFn: () =>
            axios.get<TransactionResponseType>(
                `http://localhost:3000/history/transaction?wallet_address=addr_test1qzwu6jcqk8f96fxq02pvq2h4a927ggn35f2gzdklfte4kwx0sd5zdvsat2chsyyjxkjxcg6uz2y46avd46mzqdgdy3dsckqxs4&page=${page}&page_size=5`,
                {
                    timeout: 5000,
                },
            ),
        enabled: !Boolean(account?.id),
    });

    const {
        handleSubmit,
        watch,
        control,
        reset,
        trigger,
        getValues,
        formState: { errors },
    } = useForm<DepositeType>({
        defaultValues: {
            income: "",
            priceHight: "",
            priceLow: "",
            stake: "",
            step: "",
            totalADA: "",
        },
        mode: "onChange",
    });

    const {
        data: chartDataRecords,
        isLoading: isGetChartRecordsLoading,
        isSuccess: isGetChartRecordsSuccess,
    } = useQuery({
        queryKey: ["ChartData"],
        queryFn: () => axios.get<ChartHistoryRecord[] | null>("http://localhost:3000/chart"),
        refetchInterval: 5 * 60 * 1000,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
    });

    const [currentChartPeriod, setCurrentChartPeriod] = useState<CHART_TIME_PERIOD>("ONE_DAY");
    const { lucid } = useContext<LucidContextType>(LucidContext);
    const { deposit, waitingDeposit } = useContext<SmartContractContextType>(SmartContractContext);

    const historyPrices: ChartDataType = useMemo(() => {
        if (isGetChartRecordsSuccess && chartDataRecords.data) {
            const prices = chartDataRecords.data.map((history) => [+history.closeTime, +history.high]);
            return prices as ChartDataType;
        }
        return [];
    }, [chartDataRecords, isGetChartRecordsSuccess]);

    const onDeposite = handleSubmit((data) => {
        lucid &&
            deposit({
                lucid,
                income: Number(data.income),
                priceHight: Number(data.priceHight),
                priceLow: Number(data.priceLow),
                stake: Number(data.stake),
                step: Number(data.step),
                totalADA: Number(data.totalADA),
            }).catch((error) => {});
    });

    const { income, priceHight, priceLow, stake, step, totalADA } = watch();

    useEffect(() => {
        if (income && priceHight && priceLow && stake && step && totalADA && Object.keys(errors).length === 0) {
            const result: CalculateSellingStrategy[] = calculateSellingStrategy({
                income: Number(income), // Bao nhiêu $ một tháng ==> Nhận bao nhiêu dola 1 tháng = 5
                priceHight: Number(priceHight) * 1000000, //  Giá thấp nhất =  2000000
                priceLow: Number(priceLow) * 1000000, // Giá cao nhất = 1000000
                stake: Number(stake), //  ROI % stake theo năm = 5
                step: Number(step), // Bước nhảy theo giá (%) = 10
                totalADA: Number(totalADA) * 1000000, // Tổng ada = 24000000
            });

            setSellingStrategies(result);
        } else {
            console.log("Please enter data");
        }
    }, [errors, income, priceHight, priceLow, stake, step, totalADA]);

    const handleRefreshChart = function () {
        reset();
        setSellingStrategies([]);
    };

    return (
        <div className={cx("wrapper")}>
            <section className={cx("header-wrapper")}>
                <div className={cx("header")}>
                    <h2 className={cx("title")}>Mint or Burn DJED</h2>
                </div>
                <div className={cx("stats")}>
                    <div className={cx("stats-inner")}>
                        <div className={cx("stats")}>
                            <div className={cx("card-wrapper")}>
                                <Card title="Deposite DJED" icon={icons.djed} className={cx("stat-djed-stablecoin")}>
                                    {/* <button className={cx("preview-button")} onClick={previewSellingStrategies}>
                                        Preview
                                    </button> */}
                                    <form onSubmit={onDeposite} className={"card-service"}>
                                        <div className={cx("balance")}>
                                            <span>
                                                Balance: <CountUp end={wallet?.balance || 0} start={0} /> ₳
                                            </span>
                                        </div>
                                        <div className={cx("form-wrapper")}>
                                            <div className={cx("row-wrapper")}>
                                                <Controller
                                                    control={control}
                                                    name="priceLow"
                                                    rules={{
                                                        required: {
                                                            value: true,
                                                            message: "This field is required",
                                                        },
                                                        validate: (value) =>
                                                            parseFloat(value) <= parseFloat(getValues("priceHight")) ||
                                                            "Min price must be greater than Max price.",
                                                    }}
                                                    render={({ field }) => (
                                                        <InputNumber
                                                            description="Hello"
                                                            {...field}
                                                            value={watch("priceLow")}
                                                            title="Min price"
                                                            className={cx("input")}
                                                            placeholder="Enter the lowest price"
                                                            errorMessage={errors.priceLow?.message}
                                                        />
                                                    )}
                                                />
                                                <div className={cx("slash")}> - </div>
                                                <Controller
                                                    control={control}
                                                    name="priceHight"
                                                    rules={{
                                                        required: {
                                                            value: true,
                                                            message: "This field is required",
                                                        },
                                                        validate: (value) =>
                                                            parseFloat(value) >= parseFloat(getValues("priceLow")) ||
                                                            "Max price must be greater than Min price.",
                                                    }}
                                                    render={({ field }) => (
                                                        <InputNumber
                                                            description="Hello"
                                                            {...field}
                                                            onChange={(e) => {
                                                                field.onChange(e);
                                                                trigger("priceLow");
                                                            }}
                                                            title="Max price"
                                                            className={cx("input")}
                                                            placeholder="Enter the highest price"
                                                            errorMessage={errors.priceHight?.message}
                                                        />
                                                    )}
                                                />
                                            </div>
                                            <div className={cx("row-wrapper")}>
                                                <Controller
                                                    control={control}
                                                    name="income"
                                                    rules={{
                                                        required: {
                                                            value: true,
                                                            message: "This field is required",
                                                        },
                                                    }}
                                                    render={({ field }) => (
                                                        <InputNumber
                                                            description="Hello"
                                                            {...field}
                                                            title="Desired income"
                                                            className={cx("input")}
                                                            placeholder="Enter the lowest price"
                                                            errorMessage={errors.income?.message}
                                                        />
                                                    )}
                                                />
                                                <div className={cx("slash")}> - </div>
                                                <Controller
                                                    control={control}
                                                    name="stake"
                                                    rules={{
                                                        required: {
                                                            value: true,
                                                            message: "This field is required",
                                                        },
                                                    }}
                                                    render={({ field }) => (
                                                        <InputNumber
                                                            description="Hello"
                                                            {...field}
                                                            title="Stake (%)"
                                                            className={cx("input")}
                                                            placeholder="Enter the stake percentage"
                                                            errorMessage={errors.stake?.message}
                                                        />
                                                    )}
                                                />
                                            </div>

                                            <div className={cx("row-wrapper")}>
                                                <Controller
                                                    control={control}
                                                    name="step"
                                                    rules={{
                                                        required: {
                                                            value: true,
                                                            message: "This field is required",
                                                        },
                                                    }}
                                                    render={({ field }) => (
                                                        <InputNumber
                                                            description="Hello"
                                                            {...field}
                                                            title="Step"
                                                            className={cx("input")}
                                                            placeholder="Enter the price jump"
                                                            errorMessage={errors.step?.message}
                                                        />
                                                    )}
                                                />

                                                <div className={cx("slash")}> - </div>
                                                <Controller
                                                    control={control}
                                                    name="totalADA"
                                                    rules={{
                                                        required: {
                                                            value: true,
                                                            message: "This field is required",
                                                        },
                                                    }}
                                                    render={({ field }) => (
                                                        <InputNumber
                                                            description="Hello"
                                                            {...field}
                                                            title="Total ADA"
                                                            className={cx("input")}
                                                            placeholder="Enter the total number of ada"
                                                            errorMessage={errors.totalADA?.message}
                                                        />
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        <div className={cx("info")}>
                                            <div className={cx("service-stats")}>
                                                <div className={cx("title-wrapper")}>
                                                    <span>Fees</span>
                                                    <Tippy
                                                        render={
                                                            <div>
                                                                <div className={cx("stats-fee")}>
                                                                    <span>Request Fee</span>
                                                                    <span>-</span>
                                                                </div>
                                                                <div className={cx("stats-fee")}>
                                                                    <span>Operator Fee</span>
                                                                    <span>{sellingStrategies.length > 0 ? "1.5 ₳" : "-"}</span>
                                                                </div>
                                                            </div>
                                                        }
                                                    >
                                                        <Image
                                                            className={cx("icon-help-circle")}
                                                            src={icons.helpCircle}
                                                            width={12}
                                                            height={12}
                                                            alt=""
                                                        />
                                                    </Tippy>
                                                </div>
                                                {waitingDeposit ? <Loading /> : sellingStrategies.length > 0 ? "1.5 ₳" : "-"}
                                            </div>
                                            <div className={cx("service-stats")}>
                                                <div className={cx("title-wrapper")}>
                                                    <span>You will pay</span>
                                                </div>
                                                {waitingDeposit ? (
                                                    <Loading />
                                                ) : sellingStrategies.length > 0 ? (
                                                    `${sellingStrategies[sellingStrategies.length - 1].sumADA / 1000000} ₳`
                                                ) : (
                                                    "-"
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            disabled={!lucid || waitingDeposit || Object.keys(errors).length > 0 || sellingStrategies.length === 0}
                                            className={cx("deposite-button")}
                                        >
                                            Deposite
                                        </Button>
                                    </form>
                                </Card>
                            </div>
                            <CustomChart
                                onRefresh={handleRefreshChart}
                                isLoading={isGetChartRecordsLoading}
                                data={historyPrices}
                                preview={sellingStrategies}
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section>
                <div className={cx("header-order")}>
                    <h2 className={cx("title")}>Orders</h2>
                </div>
                <Orders page={page} setPage={setPage} data={data?.data} isError={isError} isLoading={isLoading} className={cx("orders")} />
            </section>
        </div>
    );
};

export default Deposit;
