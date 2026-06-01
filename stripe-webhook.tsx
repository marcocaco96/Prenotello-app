import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const saloneId = url.searchParams.get("salone_id");
        if (!saloneId) return new Response("Missing salone_id", { status: 400 });

        const { data: salone } = await supabaseAdmin
          .from("saloni")
          .select("user_id, stripe_secret_key, stripe_webhook_secret")
          .eq("id", saloneId)
          .maybeSingle();
        if (!salone?.stripe_secret_key || !salone.stripe_webhook_secret) {
          return new Response("Not configured", { status: 400 });
        }

        const signature = request.headers.get("stripe-signature");
        const body = await request.text();
        if (!signature) return new Response("Missing signature", { status: 400 });

        const stripe = new Stripe(salone.stripe_secret_key, {
          apiVersion: "2024-12-18.acacia" as any,
        });

        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(
            body,
            signature,
            salone.stripe_webhook_secret,
          );
        } catch (e) {
          return new Response(
            `Invalid signature: ${e instanceof Error ? e.message : "error"}`,
            { status: 401 },
          );
        }

        if (event.type === "checkout.session.completed") {
          const session = event.data.object as Stripe.Checkout.Session;
          const apptId = session.metadata?.appuntamento_id;
          if (apptId) {
            await supabaseAdmin
              .from("appuntamenti")
              .update({
                stato_pagamento: "pagato_online",
                metodo_pagamento: "stripe",
              })
              .eq("id", apptId)
              .eq("user_id", salone.user_id);
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
