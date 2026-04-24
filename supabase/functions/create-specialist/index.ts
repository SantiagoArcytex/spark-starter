import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user: caller } } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!caller) throw new Error("Unauthorized");

    const { data: roleCheck } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id).in("role", ["admin", "super_admin", "tech_lead"]);
    if (!roleCheck || roleCheck.length === 0) throw new Error("Admin access required");

    const { email, full_name, start_date, salary, bio, certification } = await req.json();
    if (!email || !full_name) throw new Error("Email and full_name are required");

    const tempPassword = crypto.randomUUID();
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createError) throw createError;

    const userId = newUser.user.id;

    await Promise.all([
      supabaseAdmin.from("profiles").upsert({
        user_id: userId,
        email,
        full_name,
        start_date: start_date || null,
        salary: salary || null,
        specialist_bio: bio || null,
        specialist_certification: certification || null,
      }),
      supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "specialist" }),
    ]);

    await supabaseAdmin.auth.admin.generateLink({ type: "recovery", email });

    return new Response(JSON.stringify({ user_id: userId, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
