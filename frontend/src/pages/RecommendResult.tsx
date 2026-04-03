import React, { useState, useEffect } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { Button } from '@radix-ui/themes';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { useNavigate } from "react-router-dom";
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext';
import Footer from '../components/Footer'

interface Song {
    id: string
    title: string
    bpm: number
    genre: string
    album: string
    song_writer: string
    artist: string
}


export default function RecommendResult() {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetSong, setTargetSong] = useState<Song | null>(null)
  const { id } = useParams()
  const [error, setError] = useState<string | null>(null)
  const [artistLikeness, setArtistLikeness] = useState(false);
  const [albumLikeness, setAlbumLikeness] = useState(false);
  const [songwriterLikeness, setSongwriterLikeness] = useState(false);
  const [bpmLikeness, setBpmLikeness] = useState(false);
  
  const navigate = useNavigate();
  
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let queryBuilder = supabase
        .from('songs')
        .select(`
          *,
          albums!inner (*),
          song_artists!inner (
            artists!inner (*)
          )
        `)
        .neq('id', targetSong?.id) 
        .order('title', { ascending: true });

      if (artistLikeness && targetSong?.artist) {
        queryBuilder = queryBuilder.ilike('song_artists.artists.name', `%${targetSong.artist}%`)
      }
      if (albumLikeness) {
        if (targetSong?.album && targetSong.album !== 'Single') {
          queryBuilder = queryBuilder.ilike('albums.name', `%${targetSong.album}%`);
        } else {
          queryBuilder = queryBuilder.is('albums.id', null);
        }
      }

      if (songwriterLikeness && targetSong?.song_writer) {
        const writers = targetSong.song_writer.split(',').map(w => w.trim());
        queryBuilder = queryBuilder.or(
          writers.map(w => `songwriter.ilike.%${w}%`).join(',')
        );
      }

      if (bpmLikeness && targetSong?.bpm) {
          const bpmMin = targetSong.bpm - 5;
          const bpmMax = targetSong.bpm + 5;

          queryBuilder = queryBuilder.gte('bpm', bpmMin).lte('bpm', bpmMax);
        }

        const { data, error } = await queryBuilder;

        if (!error && data) {
          if (bpmLikeness && targetSong?.bpm) {
            // sort using targetSong.bpm directly
            const sorted = data.sort((a: any, b: any) => 
              Math.abs(a.bpm - targetSong.bpm) - Math.abs(b.bpm - targetSong.bpm)
            );
            setSongs(sorted);
          } else {
            setSongs(data);
          }
        } else if (error) {
          console.error(error);
          setSongs([]);
        } else {
          setSongs(data || []);
        }
    } catch (err) {
      console.error(err);
      setSongs([]);
    } finally {
      setLoading(false);
    }
  };

  // Makes the selected characteristic appear bolded
  const renderBold = (value: string | number | { name: string } | undefined, field: string) => {
    if (!value) return null;

    const filterMap: Record<string, boolean> = {
      artist: artistLikeness,
      album: albumLikeness,
      songwriter: songwriterLikeness,
      bpm: bpmLikeness
    };

    // Bold if the filter checkbox is checked
    const isActive = filterMap[field] === true;

    const displayValue = typeof value === "object" && value !== null && "name" in value
      ? (value.name as string)
      : value;

    return isActive ? <strong>{displayValue}</strong> : displayValue;
  };  

    // update for checking
    useEffect(() => {
      if (targetSong) {
        const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
        onSubmit(fakeEvent);
      }
    }, [artistLikeness, albumLikeness, bpmLikeness, songwriterLikeness, targetSong]);

    useEffect(() => {
      if (!id) return;

      async function fetchSong() {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('songs')
            .select(`
              *,
              albums!inner (*),
              song_artists (
                artists (*)
              )
            `)
            .eq('id', id)
            .single();

          if (error) {
            console.error('Error fetching song:', error);
            setError('Failed to fetch song');
            setTargetSong(null);
          } else {
            setTargetSong({
              id: data.id,
              title: data.title,
              bpm: data.bpm,
              genre: data.genre,
              album: data.albums?.name ?? 'Single',
              song_writer: data.songwriter ?? '',
               artist: data.song_artists?.map((sa: any) => sa.artists.name).join(', ') ?? ''
            });
          }
        } catch (err) {
          console.error(err);
          setError('Failed to fetch song');
        } finally {
          setLoading(false);
        }
      }

      fetchSong();
    }, [id]);


  if (loading) return <div className="min-h-screen flex flex-col"><Navbar /><main className="p-6 text-center">Loading...</main><Footer /></div>
  if (error) return <div className="min-h-screen flex flex-col bg-background"><Navbar /><main className="text-destructive p-6 text-center">{error}</main><Footer /></div>
  if (!targetSong) return <div className="min-h-screen flex flex-col bg-background"><Navbar /><main className="text-destructive p-6 text-center">Song not found</main><Footer /></div>

  return (
    <div>
    <Navbar />

 <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="w-full max-w-2xl mx-4 bg-card rounded-2xl shadow-xl p-8">
          {/* Target Song */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-center text-muted-foreground mb-3">
              Selected Song
            </h2>

            <div className="rounded-2xl border border-primary/30 p-5 bg-primary/5 shadow-sm text-center">
              <div className="text-xl font-semibold text-primary">
                {targetSong?.title}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Artist: {targetSong?.artist} | Album: {targetSong?.album}
              </div>

              <div className="text-sm text-muted-foreground mt-1">
                 Songwriter(s): {targetSong?.song_writer}
              </div>

              <div className="text-sm text-muted-foreground mt-1">
                 Genre: {targetSong?.genre} | BPM: {targetSong?.bpm}
              </div>
            </div>
          </div>
          
          <h1 className="text-2xl font-semibold text-center mb-2 text-primary">Recommended Songs</h1>
          <p className="text-center text-muted-foreground mb-6">
            Use the filters below to get song recommondations with similar traits
          </p>           

          <div className="mt-4">
            <div className="mt-3 flex items-center gap-3 flex-wrap text-sm">
              <span className="text-muted-foreground">Filters:</span>

              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={artistLikeness} onChange={(e) => setArtistLikeness(e.target.checked)} />
                Artist
              </label>

              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={albumLikeness} onChange={(e) => setAlbumLikeness(e.target.checked)} />
                Album
              </label>

              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={songwriterLikeness} onChange={(e) => setSongwriterLikeness(e.target.checked)} />
                Song Writers
              </label>
              
              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={bpmLikeness} onChange={(e) => setBpmLikeness(e.target.checked)} />
                BPM
              </label>

            </div>
          </div>

          {/* Randomize  button */}
            <div className="mt-4 flex justify-center">
              <Button
                type="submit"
                size="2"
                color="red"
                onClick={() => navigate(`/recommend`)}
              >
                Go Back to Search
              </Button>
          </div>

          {/* Results */}
          <div className="mt-8">
            {loading && <p className="text-muted-foreground">Loading...</p>}

            {!loading && songs.length === 0 && query && (
              <p className="text-muted-foreground">No results found for "{query}" </p>
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