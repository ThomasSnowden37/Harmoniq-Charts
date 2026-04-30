import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { isAdminUser } from '../lib/admin.js'
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

    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id, username, email, privacy, created_at')
      .eq('id', userUuid)
      .maybeSingle();

    if (existingUserError) throw existingUserError;

    if (existingUser) {
      return res.json({
        ...existingUser,
        is_admin: await isAdminUser(userUuid),
      });
    }

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({ 
        id: userUuid, 
        email: email, 
        username: username, 
        privacy: 'public',
      })
      .select('id, username, email, privacy, created_at')
      .single();

    if (error) throw error;


    // create the listen later playlist
    const { error: playlistError} = await supabase
      .from('playlists')
      .insert({
        user_id: newUser.id,
        name: 'Listen Later',
        permanent: true,
      })
    if (playlistError) throw playlistError;

    res.json({
      ...newUser,
      is_admin: false,
    });

  } catch (err: any) {
    console.error("Supabase Sync Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
