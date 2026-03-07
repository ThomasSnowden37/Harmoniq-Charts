import React, { useState } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { Button } from '@radix-ui/themes';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { useNavigate } from "react-router-dom";

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [column, setColumn] = useState<
  'title' | 'artist' | 'album' | 'genre' | 'bpm' | 'songwriter' | 'singles_by_artist'
  >('title');
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstSearch, setFirstSearch] = useState(true);
  
  const navigate = useNavigate();
  
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);

    let data, error;
      // BPM searches close by
      if (column === 'bpm') {
        const bpmQuery = parseInt(query.replace(/\D/g, ''), 10);
        if (isNaN(bpmQuery)) {
          setSongs([]);
          setLoading(false);
          return;
        }

        ({ data, error } = await supabase
          .from('songs')
          .select(`
            *,
            albums (*),
            song_artists (
              artists (*)
            )
          `)
          .eq('bpm', bpmQuery)
          .order('title', { ascending: true }));

        if (error) console.error("BPM search error:", error);
      }
      // Album needs to connect to the other tables rather than song
      else if (column === 'album') {
        ({ data, error } = await supabase
          .from('songs')
          .select(`
            *,
            albums!inner (*),
            song_artists (
              artists (*)
            )
          `)
          .ilike('albums.name', `%${query}%`)
          .order('title', {ascending: true})
        );

      }  
      // Checks if the song isn't in an album
      else if (column === 'singles_by_artist') {
      ({ data, error } = await supabase
        .from('songs')
        .select(`
          *,
          albums (*),
          song_artists!inner (
            artists!inner (*)
          )
        `)
        .ilike('song_artists.artists.name', `%${query}%`)
        .order('title', {ascending: true})
        .is('album_id', null));

      } 
      // Checks the connected artist through the song data
      else if (column === 'artist') {
        ({ data, error } = await supabase
          .from('songs')
          .select(`
            *,
            song_artists!inner (
              artists!inner (*)
            ),
            albums (*)
          `)
          .ilike('song_artists.artists.name', `%${query}%`)
          .order('title', { ascending: true })
        );
      }
      else {

        ({ data, error } = await supabase
          .from('songs')
          .select(`
            *,
            song_artists (
              artists (*)
            )
          `)
          .ilike(column, `%${query}%`)
          .order('title', {ascending: true}));
      }

      if (error) {
        console.error(error);
        setSongs([]);
      } 
      else {
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

  return (
    <div>
    <Navbar />
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="w-full max-w-2xl mx-4 bg-card rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-semibold text-center mb-2 text-primary">Song Lookup</h1>
          <p className="text-center text-muted-foreground mb-6">
            Use the dropdown menu to select what to search by
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
              <option value="singles_by_artist">Singles by Artist</option>
            </select>

            {/* Search button */}
            <Button
              type="submit"
              size="3"
            >
              Search
            </Button>
          </form>

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
                      onClick={() => navigate(`/songs/${song.id}`)}
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