"use client";

import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  withdrawalSchema,
  WithdrawalFormData,
} from "@/lib/validators/withdrawal";
import axios from "axios";
import toast from "react-hot-toast";
import { IWithdrawal } from "@/types";
import Badge from "@/components/ui/Badge";
import { coinsToUsdWithdraw } from "@/lib/coins";
import { MIN_WITHDRAWAL_COINS, PAYMENT_GATEWAYS } from "@/lib/constants";
import { format } from "date-fns";
import CountUp from "@/components/ui/CountUp";
import Swal from "sweetalert2";

export default function WorkerWithdrawalsPage() {
  const { data: session, update } = useSession();
  const qc = useQueryClient();

  const coins = session?.user?.coins ?? 0;
  const canWithdraw = coins >= MIN_WITHDRAWAL_COINS;

  const { data } = useQuery({
    queryKey: ["withdrawals"],
    queryFn: () => axios.get("/api/v1/withdrawals").then((r) => r.data),
  });

  const withdrawals: IWithdrawal[] = data?.withdrawals ?? [];

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<WithdrawalFormData>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: {
      coinRequested: MIN_WITHDRAWAL_COINS,
      paymentSystem: "stripe",
    },
  });

  const coinRequested = watch("coinRequested") || 0;

  function onSubmit(d: WithdrawalFormData) {
    if (d.coinRequested > coins) {
      toast.error(`Insufficient balance. Your balance is ${coins} coins.`);
      return;
    }

    Swal.fire({
      title: "Confirm Withdrawal",
      html: `Withdraw <strong>${d.coinRequested} coins</strong> (≈ $${coinsToUsdWithdraw(d.coinRequested)} USD) via <strong>${d.paymentSystem}</strong>?`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Yes, withdraw",
      cancelButtonText: "Cancel",
      confirmButtonColor: "#1a4731",
    }).then((result) => {
      if (result.isConfirmed) mutation.mutate(d);
    });
  }

  const mutation = useMutation({
    mutationFn: (d: WithdrawalFormData) => axios.post("/api/v1/withdrawals", d),
    onSuccess: () => {
      toast.success("Withdrawal request submitted!");
      reset();
      qc.invalidateQueries({ queryKey: ["withdrawals"] });
      update();
    },
    onError: (err: unknown) => {
      const msg = axios.isAxiosError(err)
        ? err.response?.data?.error
        : "Request failed";
      toast.error(typeof msg === "string" ? msg : "Request failed");
    },
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl font-bold text-primary">
          Withdrawals
        </h1>
        <p className="text-primary/60 text-sm mt-1">
          Request withdrawals and view your payout history.
        </p>
      </div>

      {/* Balance */}
      <div className="bg-linear-to-r from-primary to-secondary text-white rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-sm text-white/70">Available Balance</p>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-bold">{coins}</span>
            <span className="text-white/60 text-sm">coins</span>
          </div>
          <p className="text-secondary text-sm mt-1">
            ≈ ${coinsToUsdWithdraw(coins)} USD
          </p>
        </div>
        {!canWithdraw && (
          <div className="text-right">
            <p className="text-white/70 text-sm">
              Need {MIN_WITHDRAWAL_COINS - coins} more coins
            </p>
            <p className="text-white/50 text-xs">to request a withdrawal</p>
          </div>
        )}
      </div>

      {/* Request form */}
      {canWithdraw ? (
        <div className="bg-white rounded-xl border border-primary/5 shadow-sm p-6">
          <h2 className="font-bold text-primary mb-5">Request Withdrawal</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">
                  Coins to Withdraw
                </label>
                <input
                  {...register("coinRequested", { valueAsNumber: true })}
                  type="number"
                  min={MIN_WITHDRAWAL_COINS}
                  className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary"
                />
                {errors.coinRequested && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.coinRequested.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">
                  USD Amount
                </label>
                <div className="px-4 py-3 rounded-lg border border-primary/10 bg-background text-secondary font-bold">
                  ${coinsToUsdWithdraw(Number(coinRequested) || 0)}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">
                  Payment Method
                </label>
                <select
                  {...register("paymentSystem")}
                  className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary capitalize"
                >
                  {PAYMENT_GATEWAYS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-primary mb-1.5">
                  Account / Number
                </label>
                <input
                  {...register("accountNumber")}
                  className="w-full px-4 py-3 rounded-lg border border-primary/20 bg-background focus:outline-none focus:ring-2 focus:ring-secondary text-primary tracking-widest"
                  placeholder="XXXX XXXX XXXX XXXX"
                  maxLength={19}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 16);
                    const formatted = raw.match(/.{1,4}/g)?.join(" ") ?? raw;
                    e.target.value = formatted;
                  }}
                />
                {errors.accountNumber && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.accountNumber.message}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {mutation.isPending ? "Submitting…" : "Request Withdrawal"}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <p className="text-yellow-800 font-semibold">
            You need at least {MIN_WITHDRAWAL_COINS} coins to withdraw.
          </p>
          <p className="text-yellow-700 text-sm mt-1">
            Complete more tasks to earn coins!
          </p>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-xl border border-primary/5 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-primary/5">
          <h2 className="font-bold text-primary">Withdrawal History</h2>
        </div>
        {withdrawals.length === 0 ? (
          <p className="text-center text-primary/40 text-sm py-10">
            No withdrawal requests yet
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background border-b border-primary/5">
                <tr>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Coins
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Amount
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Method
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Status
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-primary/50">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary/5">
                {withdrawals.map((w) => (
                  <tr key={w._id} className="hover:bg-background/50">
                    <td className="px-6 py-4 font-semibold text-primary">
                      <CountUp value={w.coinRequested} />
                    </td>
                    <td className="px-6 py-4 text-secondary font-semibold">
                      $<CountUp value={w.amount} decimals={2} />
                    </td>
                    <td className="px-6 py-4 text-primary/60 capitalize">
                      {w.paymentSystem}
                    </td>
                    <td className="px-6 py-4">
                      <Badge status={w.status} />
                    </td>
                    <td className="px-6 py-4 text-primary/50">
                      {format(new Date(w.createdAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
