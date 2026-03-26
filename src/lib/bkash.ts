

export async function getBkashToken(): Promise<string> {
  const res = await fetch(
    `${process.env.BKASH_BASE_URL}/tokenized/checkout/token/grant`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        username: process.env.BKASH_USERNAME!,
        password: process.env.BKASH_PASSWORD!,
      },
      body: JSON.stringify({
        app_key: process.env.BKASH_APP_KEY,
        app_secret: process.env.BKASH_APP_SECRET,
      }),
    },
  );

  const data = await res.json();
  if (!data.id_token)
    throw new Error(data.statusMessage || "bKash auth failed");
  return data.id_token;
}

export async function createBkashPayment(
  token: string,
  amountBDT: string,
  paymentId: string,
): Promise<string> {
  const res = await fetch(
    `${process.env.BKASH_BASE_URL}/tokenized/checkout/create`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        authorization: token,
        "x-app-key": process.env.BKASH_APP_KEY!,
      },
      body: JSON.stringify({
        mode: "0011",
        payerReference: paymentId,
        callbackURL: `${process.env.NEXTAUTH_URL}/api/bkash/callback`,
        amount: amountBDT,
        currency: "BDT",
        intent: "sale",
        merchantInvoiceNumber: paymentId,
      }),
    },
  );

  const data = await res.json();
  if (!data.bkashURL)
    throw new Error(data.statusMessage || "bKash create failed");
  return data.bkashURL;
}

export async function executeBkashPayment(paymentID: string) {
  const token = await getBkashToken();

  const res = await fetch(
    `${process.env.BKASH_BASE_URL}/tokenized/checkout/execute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        authorization: token,
        "x-app-key": process.env.BKASH_APP_KEY!,
      },
      body: JSON.stringify({ paymentID }),
    },
  );

  return res.json();
}
