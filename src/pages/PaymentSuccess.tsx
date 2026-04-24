import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, XCircle } from "lucide-react";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [details, setDetails] = useState<{ hours_added?: number; new_balance?: number } | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      setStatus("error");
      return;
    }

    const verify = async () => {
      const { data, error } = await supabase.functions.invoke("verify-payment", {
        body: { sessionId },
      });

      if (error || data?.error) {
        setStatus("error");
        return;
      }

      if (data?.status === "paid") {
        setStatus("success");
        setDetails(data);
      } else {
        setStatus("error");
      }
    };

    verify();
  }, [searchParams]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          {status === "loading" && <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />}
          {status === "success" && <CheckCircle className="mx-auto h-12 w-12 text-green-500" />}
          {status === "error" && <XCircle className="mx-auto h-12 w-12 text-destructive" />}
          <CardTitle className="mt-4">
            {status === "loading" && "Verifying payment..."}
            {status === "success" && "Payment successful!"}
            {status === "error" && "Payment issue"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "success" && details && (
            <>
              <p className="text-muted-foreground">
                <span className="text-2xl font-bold text-foreground">{details.hours_added}</span> hours have been added to your account.
              </p>
              <p className="text-sm text-muted-foreground">
                New balance: <span className="font-semibold">{details.new_balance?.toFixed(1)}h</span>
              </p>
            </>
          )}
          {status === "error" && (
            <p className="text-sm text-muted-foreground">
              Something went wrong verifying your payment. Please contact support.
            </p>
          )}
          <Button onClick={() => navigate("/dashboard")} className="w-full">
            Back to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
