import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map Stripe price IDs to hour block details
const PRICE_MAP: Record<string, { hours: number; rate: number; total: number }> = {
  "price_1T7iocA59zIOlwLqDVJx1Ckz": { hours: 10, rate: 100, total: 1000 },
  "price_1T7ipLA59zIOlwLqMCayYsJZ": { hours: 30, rate: 90, total: 2700 },
  "price_1T7ipXA59zIOlwLq7sj6RgVQ": { hours: 50, rate: 85, total: 4250 },
  "price_1T7ipzA59zIOlwLqdAJbCSTa": { hours: 60, rate: 80, total: 4800 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: userData } = await supabaseAnon.auth.getUser(token);
    const user = userData.user;
    if (!user) throw new Error("Not authenticated");

    const { sessionId } = await req.json();
    if (!sessionId) throw new Error("sessionId is required");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    });

    if (session.payment_status !== "paid") {
      return new Response(JSON.stringify({ status: session.payment_status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get the price ID from the session
    const priceId = session.line_items?.data[0]?.price?.id;
    if (!priceId || !PRICE_MAP[priceId]) {
      throw new Error("Unknown price ID: " + priceId);
    }

    const block = PRICE_MAP[priceId];
    const userId = session.metadata?.user_id || user.id;

    // Get or create client account
    let { data: account } = await supabase
      .from("client_accounts")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!account) {
      const { data: newAccount, error: createErr } = await supabase
        .from("client_accounts")
        .insert({ user_id: userId, hours_purchased: 0, hours_used: 0, current_rate: block.rate })
        .select()
        .single();
      if (createErr) throw createErr;
      account = newAccount;
    }

    // Check if this payment was already processed (idempotency)
    const { data: existingBlock } = await supabase
      .from("hour_blocks")
      .select("id")
      .eq("stripe_payment_id", session.payment_intent as string)
      .single();

    if (existingBlock) {
      return new Response(JSON.stringify({ status: "paid", already_processed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create hour block record
    const { error: blockErr } = await supabase.from("hour_blocks").insert({
      client_account_id: account.id,
      hours: block.hours,
      rate: block.rate,
      total_amount: block.total,
      stripe_payment_id: session.payment_intent as string,
    });
    if (blockErr) throw blockErr;

    // Credit hours to client account
    const { error: updateErr } = await supabase
      .from("client_accounts")
      .update({
        hours_purchased: account.hours_purchased + block.hours,
        current_rate: block.rate,
      })
      .eq("id", account.id);
    if (updateErr) throw updateErr;

    // Create invoice record
    await supabase.from("invoices").insert({
      client_account_id: account.id,
      total_amount: block.total,
      status: "paid",
      stripe_invoice_id: session.payment_intent as string,
    });

    return new Response(
      JSON.stringify({
        status: "paid",
        hours_added: block.hours,
        new_balance: account.hours_purchased + block.hours - account.hours_used,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("verify-payment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
