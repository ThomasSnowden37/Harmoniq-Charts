-- CORE TABLES 
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    privacy VARCHAR(10) NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'private'))
);

-- Artists table
CREATE TABLE artists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Albums table
CREATE TABLE albums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Songs table
CREATE TABLE songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    bpm INTEGER,
    genre VARCHAR(100),
    year_released INTEGER,
    album_id UUID REFERENCES albums(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE SET NULL,
    trending_score NUMERIC DEFAULT 0,
);

-- MANY TO MANY TABLES
CREATE TABLE song_artists (
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE,
    artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
    PRIMARY KEY (song_id, artist_id)
);

CREATE TABLE album_artists (
    album_id UUID REFERENCES albums(id) ON DELETE CASCADE,
    artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
    PRIMARY KEY (album_id, artist_id)
);


-- USER INTERACTION TABLES
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, song_id) -- One review per user per song
);

CREATE TABLE likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, song_id) -- One like per user per song
);

CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, song_id) -- One rating per user per song
);

CREATE TABLE listened (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
    has_listened BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, song_id) -- One listened status per user per song
);

CREATE TABLE listento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
    add_listento BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, song_id) -- One listened status per user per song
);

-- PLAYLIST TABLES
CREATE TABLE playlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE playlist_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(playlist_id, song_id) -- No duplicate songs in a playlist
);

-- PLAYLIST INTERACTIONS
CREATE TABLE playlist_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, playlist_id) -- One like per user per playlist
);

CREATE TABLE playlist_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FRIEND REQUESTS
CREATE TABLE friend_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    addressee_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(requester_id, addressee_id), -- One request per direction
    CHECK (requester_id != addressee_id) -- Prevent self-follow
);

-- RECOMMENDATIONS
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
    recommended_song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE, 
    is_helpful BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- FAVORITE SONGS
CREATE TABLE favorite_songs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    song_id UUID REFERENCES songs(id) ON DELETE CASCADE NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0 AND position <= 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, song_id),
    UNIQUE(user_id, position)
);

-- Speed up queries for user's content
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_song_id ON reviews(song_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_likes_song_id ON likes(song_id);
CREATE INDEX idx_ratings_user_id ON ratings(user_id);
CREATE INDEX idx_ratings_song_id ON ratings(song_id);
CREATE INDEX idx_listened_user_id ON listened(user_id);
CREATE INDEX idx_listened_song_id ON listened(song_id);
CREATE INDEX idx_playlists_user_id ON playlists(user_id);
CREATE INDEX idx_playlist_songs_playlist_id ON playlist_songs(playlist_id);
CREATE INDEX idx_playlist_likes_playlist_id ON playlist_likes(playlist_id);
CREATE INDEX idx_playlist_likes_user_id ON playlist_likes(user_id);
CREATE INDEX idx_playlist_comments_playlist_id ON playlist_comments(playlist_id);
CREATE INDEX idx_songs_album_id ON songs(album_id);
CREATE INDEX idx_recommendations_source ON recommendations(source_song_id);
CREATE INDEX idx_friend_requests_requester ON friend_requests(requester_id);
CREATE INDEX idx_friend_requests_addressee ON friend_requests(addressee_id);
CREATE INDEX idx_favorite_songs_user ON favorite_songs(user_id);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE listened ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_comments ENABLE ROW LEVEL SECURITY;

-- Public read access for songs, artists, albums (everyone can browse music)
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE album_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_songs ENABLE ROW LEVEL SECURITY;

-- Policies for public content (songs, artists, albums)
CREATE POLICY "Public read access" ON songs FOR SELECT USING (true);
CREATE POLICY "Public read access" ON artists FOR SELECT USING (true);
CREATE POLICY "Public read access" ON albums FOR SELECT USING (true);
CREATE POLICY "Public read access" ON song_artists FOR SELECT USING (true);
CREATE POLICY "Public read access" ON album_artists FOR SELECT USING (true);

-- Policies for user-specific content
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Reviews: anyone can read, only owner can write
CREATE POLICY "Anyone can read reviews" ON reviews FOR SELECT USING (true);
CREATE POLICY "Users can create own reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON reviews FOR DELETE USING (auth.uid() = user_id);

-- Likes
CREATE POLICY "Anyone can read likes" ON likes FOR SELECT USING (true);
CREATE POLICY "Users can create own likes" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON likes FOR DELETE USING (auth.uid() = user_id);

-- Ratings
CREATE POLICY "Anyone can read ratings" ON ratings FOR SELECT USING (true);
CREATE POLICY "Users can create own ratings" ON ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ratings" ON ratings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ratings" ON ratings FOR DELETE USING (auth.uid() = user_id);

-- Listened
CREATE POLICY "Users can view own listened" ON listened FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own listened" ON listened FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own listened" ON listened FOR UPDATE USING (auth.uid() = user_id);

-- Playlists
CREATE POLICY "Anyone can read playlists" ON playlists FOR SELECT USING (true);
CREATE POLICY "Users can create own playlists" ON playlists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own playlists" ON playlists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own playlists" ON playlists FOR DELETE USING (auth.uid() = user_id);

-- Playlist songs
CREATE POLICY "Anyone can read playlist songs" ON playlist_songs FOR SELECT USING (true);
CREATE POLICY "Users can manage own playlist songs" ON playlist_songs FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM playlists WHERE id = playlist_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own playlist songs" ON playlist_songs FOR DELETE
    USING (EXISTS (SELECT 1 FROM playlists WHERE id = playlist_id AND user_id = auth.uid()));

-- Playlist likes
CREATE POLICY "Anyone can read playlist likes" ON playlist_likes FOR SELECT USING (true);
CREATE POLICY "Users can create own playlist likes" ON playlist_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own playlist likes" ON playlist_likes FOR DELETE USING (auth.uid() = user_id);

-- Playlist comments
CREATE POLICY "Anyone can read playlist comments" ON playlist_comments FOR SELECT USING (true);
CREATE POLICY "Users can create own playlist comments" ON playlist_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own playlist comments" ON playlist_comments FOR DELETE USING (auth.uid() = user_id);

-- Recommendations
CREATE POLICY "Anyone can read recommendations" ON recommendations FOR SELECT USING (true);
CREATE POLICY "Users can rate recommendations" ON recommendations FOR UPDATE
    USING (auth.uid() = user_id OR user_id IS NULL);

-- Friend requests
CREATE POLICY "Users can view own friend requests" ON friend_requests FOR SELECT
    USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Users can send friend requests" ON friend_requests FOR INSERT
    WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can update received requests" ON friend_requests FOR UPDATE
    USING (auth.uid() = addressee_id);
CREATE POLICY "Users can cancel sent requests" ON friend_requests FOR DELETE
    USING (auth.uid() = requester_id);

-- Favorite songs
CREATE POLICY "Anyone can read favorite songs" ON favorite_songs FOR SELECT USING (true);
CREATE POLICY "Users can manage own favorite songs" ON favorite_songs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own favorite songs" ON favorite_songs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own favorite songs" ON favorite_songs FOR DELETE USING (auth.uid() = user_id);
