import React, { useState, useEffect } from 'react';
import { MOCK_CURRENT_USER_ID } from '../lib/auth'
import { Search, ArrowRight } from 'lucide-react';
import { Button } from '@radix-ui/themes';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { useNavigate } from "react-router-dom";

export default function RecommendPage() {
  const [query, setQuery] = useState('');
  const [column, setColumn] = useState<
  'title' | 'artist' | 'album' | 'genre' | 'bpm' | 'songwriter' | 'singles_by_artist'
  >('title');
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstSearch, setFirstSearch] = useState(true);
  const [singlesOnly, setSinglesOnly] = useState(false);
  const [listened, setListened] = useState(false);
  const [listenedTo, setListenedTo] = useState(false);
  const [liked, setLiked] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  
  const navigate = useNavigate();
  
  const onSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!query.trim() && !singlesOnly && !listened && !liked && !listenedTo) return;

  setLoading(true);

  try {
    let queryBuilder = supabase
      .from('songs')
      .select(`
        *,
        albums (*),
        song_artists!inner (
          artists!inner (*)
        ),
        likes (*),
        listened (*),
        listento (*)
      `)
      .order('title', { ascending: true });

    if (column === 'bpm') {
      const bpmQuery = parseInt(query.replace(/\D/g, ''), 10);
      if (!isNaN(bpmQuery)) queryBuilder = queryBuilder.eq('bpm', bpmQuery);
    } 
    else if (column === 'album') {
      queryBuilder = queryBuilder.ilike('albums.name', `%${query}%`);
    } 
    else if (column === 'artist') {
      queryBuilder = queryBuilder.ilike('song_artists.artists.name', `%${query}%`);
    } 
    else if (query.trim()) {
      queryBuilder = queryBuilder.ilike(column, `%${query}%`);
    }

    if (singlesOnly) {
      queryBuilder = queryBuilder.is('album_id', null);
    }


    if (singlesOnly) queryBuilder = queryBuilder.is('album_id', null);

    const { data, error } = await queryBuilder;

    if (error) {
      console.error(error);
      setSongs([]);
    } else {
      let filtered = data || [];

      // filters that are user-specific
      if (user) {
        if (liked) {
          filtered = filtered.filter(song =>
            song.likes?.some((l: any) => l.user_id === user.id) ?? false
          );
        }
    
        if (listened) {
          filtered = filtered.filter(song =>
            song.listened?.some((l: any) => l.user_id === user.id) ?? false
          );
        }
    
        if (listenedTo) {
          filtered = filtered.filter(song =>
            song.listento?.some((l: any) => l.user_id === user.id) ?? false
          );
        }
    
      }

      setSongs(filtered);

    }

  } catch (err) {
    console.error(err);
    setSongs([]);
  }
  

    setLoading(false);
    setFirstSearch(false);
    };


    const handleRandom = async () => {
    setLoading(true);

    const { data, error } = await supabase.rpc('get_random_song');

    if (error) {
        console.error(error);
        setSongs([]);
    } else {
        setSongs(data || []);
    }

    setLoading(false);
    setFirstSearch(false);
    };  

  // Makes the selected column appear bolded
  const renderBold = (value: string | number | { name: string } | undefined, field: string) => {
      if (!value) return null;

      const isActive =
        column === field ||
        (column === "singles_by_artist" && field === "artist");

      const displayValue =
        typeof value === "object" && value !== null && "name" in value
          ? (value.name as string)
          : value;

      return isActive ? <strong>{displayValue}</strong> : displayValue;
    };

    // update for checking
    useEffect(() => {
      if (!firstSearch) {
        const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
        onSubmit(fakeEvent);
      }
    }, [singlesOnly, listened, liked, listenedTo]);

    // get user
    useEffect(() => {
      setUser({ id: MOCK_CURRENT_USER_ID });
    }, []);

  return (
    <div>
    <Navbar />
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="w-full max-w-2xl mx-4 bg-card rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-semibold text-center mb-2 text-primary">Recommend Song Select</h1>
          <p className="text-center text-muted-foreground mb-6">
            Use the dropdown menu to select what to search by or press the randomize button for a random song selection
          </p>

          <form onSubmit={onSubmit} className="flex items-center gap-3">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                aria-label="Search"
                placeholder="Search..."
                className="w-full pl-9 pr-4 h-12 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Dropdown for selecting column */}
            <select
              value={column}
              onChange={(e) => setColumn(e.target.value as typeof column)}
              className="h-12 px-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="album">Album</option>
              <option value="genre">Genre</option>
              <option value="bpm">BPM</option>
              <option value="songwriter">Songwriters</option>
            </select>

            {/* Search button */}
            <Button
              type="submit"
              size="3"
            >
              Search
            </Button>

            
          </form>

          <div className="mt-4">
            <div className="mt-3 flex items-center gap-3 flex-wrap text-sm">
              <span className="text-muted-foreground">Filters:</span>

              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={singlesOnly} onChange={(e) => setSinglesOnly(e.target.checked)} />
                Singles
              </label>

              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={listened} onChange={(e) => setListened(e.target.checked)} />
                Listened
              </label>

              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={listenedTo} onChange={(e) => setListenedTo(e.target.checked)} />
                To Listen
              </label>

              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={liked} onChange={(e) => setLiked(e.target.checked)} />
                Liked Songs
              </label>
            </div>
          </div>

            <div className="mt-2 text-center">
            --- OR ---
            </div>

          {/* Randomize  button */}
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              onClick={handleRandom}
              size="4"
              color="green"
            >
              Randomize me a Song!
            </Button>
        </div>

          {/* Results */}
          <div className="mt-8">
            {loading && <p className="text-muted-foreground">Loading...</p>}

            { !firstSearch && !loading && songs.length === 0 && query && (
              <p className="text-muted-foreground">No results found for "{query}" in {column}</p>
            )}

            {!loading && songs.length > 0 && (
              <ul className="mt-4 space-y-2">
                {songs.map((song: any) => (
                  <li
                    key={song.id}
                    className="rounded-xl border border-border p-4 hover:bg-secondary transition flex justify-between items-center"
                  >
                    <div>
                      <div>
                        <div className="text-lg text-primary">
                          {renderBold(song.title, "title")}
                        </div>
                        <div className="text-foreground">
                          <div className="flex flex-wrap gap-4">
                              <div className="flex-1 min-w-[150px]">
                                Artists:{" "}
                                {song.song_artists?.map((sa: any, index: number) => (
                                  <span key={index}>
                                    {renderBold(sa.artists, "artist")}
                                    {index < song.song_artists.length - 1 && ", "}
                                  </span>
                                ))}
                                </div>
                              <div className="flex-1 min-w-[200px]">Songwriter(s): {renderBold(song.songwriter, "songwriter")} </div>
                              <div className="flex-1 min-w-[120px]">Album: {renderBold(song.albums?.name ?? "Single", "album")} </div>
                          </div>      

                          <div className="flex flex-wrap gap-4">
                              <div className="flex-1">Genre: {renderBold(song.genre, "genre")} </div>
                              <div className="flex-1">Bpm: {renderBold(song.bpm, "bpm")}</div>
                              <div className="flex-1"></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Redirect to the page */}
                    <Button
                      variant="ghost"
                      size="2"
                      onClick={() => navigate(`/recommend/${song.id}`)}
                    >
                      <ArrowRight className="w-5 h-5" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}