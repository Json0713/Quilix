import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  // Block non-POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { username, password, role, email, phone } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Fake internal email to satisfy Supabase
  const internalEmail = `${username}@internal.local`;

  const { data, error } = await supabase.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: {
      username,
      role,
      email: email ?? null,
      phone: phone ?? null
    }
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  return res.status(200).json({ success: true, userId: data.user.id });
}
