import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { convertCurrency } from "@/lib/currency";

/** Live preview only — used while typing a price. The authoritative,
 * audit-logged conversion happens server-side again at order create/accept. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const amount = Number(params.get("amount"));
  const from = params.get("from");
  const to = params.get("to");

  if (!Number.isFinite(amount) || amount <= 0 || !from || !to) {
    return NextResponse.json({ error: "Invalid amount/from/to" }, { status: 400 });
  }

  try {
    const result = await convertCurrency(amount, from, to);
    return NextResponse.json({
      convertedAmount: result.convertedAmount,
      rate: result.rate,
      rateTimestamp: result.rateTimestamp.toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Conversion failed" },
      { status: 502 }
    );
  }
}
