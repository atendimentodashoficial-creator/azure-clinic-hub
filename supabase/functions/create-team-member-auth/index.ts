import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the caller's JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user: caller }, error: callerError } = await anonClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, email, password, fullName, userId, role: requestedRole } = body;

    const assignRole = requestedRole === 'cliente' ? 'cliente' : 'funcionario';

    const ensureRole = async (targetUserId: string, role: 'cliente' | 'funcionario') => {
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({ user_id: targetUserId, role }, { onConflict: 'user_id,role', ignoreDuplicates: true });

      if (roleError) throw roleError;
    };

    const ensureUserByEmail = async () => {
      if (!email || !password) {
        throw new Error('Email e senha são obrigatórios para criar login do membro');
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) throw listError;

      const existingUser = usersData.users.find((u) => (u.email || '').toLowerCase() === normalizedEmail);

      if (existingUser) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
          password,
          email_confirm: true,
          user_metadata: {
            ...(existingUser.user_metadata || {}),
            full_name: fullName || existingUser.user_metadata?.full_name || normalizedEmail,
          },
        });

        if (updateError) throw updateError;

        await ensureRole(existingUser.id, assignRole);
        return { authUserId: existingUser.id, created: false };
      }

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName || normalizedEmail },
      });

      if (createError) throw createError;

      await ensureRole(newUser.user.id, assignRole);
      return { authUserId: newUser.user.id, created: true };
    };

    if (action === 'create' || action === 'ensure_cliente_auth') {
      try {
        const result = await ensureUserByEmail();
        return new Response(
          JSON.stringify({ success: true, ...result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ error: (error as Error).message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'delete') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'userId é obrigatório' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete role first
      await supabase.from('user_roles').delete().eq('user_id', userId);
      // Delete auth user
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update_password') {
      if (!userId || !password) {
        return new Response(
          JSON.stringify({ error: 'userId e password são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, { password });
      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
