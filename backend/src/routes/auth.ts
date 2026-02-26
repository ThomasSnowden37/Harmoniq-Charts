import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { v5 as uuidv5 } from 'uuid';

/**
 * auth.ts
 *
 * Description:
 * Backend routes for anything relates to authentication.
 *
 * Author: Thomas Snowden
 *
 */

const router = Router();

const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; 

router.post('/google-sync', async (req, res) => {
  // Destructure the keys coming from the frontend AuthContext
  const { id, email, username } = req.body;

  // Check if 'id' (the Google sub) exists before hashing
  if (!id) {
    return res.status(400).json({ error: 'Missing Google ID (id) in request body' });
  }

  try {
    // Generate the UUID
    const userUuid = uuidv5(id, NAMESPACE);

    const { data, error } = await supabase
      .from('users')
      .upsert({ 
        id: userUuid, 
        email: email, 
        username: username, 
        privacy: 'public' 
      }, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    console.error("Supabase Sync Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
