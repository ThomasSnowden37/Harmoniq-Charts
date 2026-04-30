import React, { useState, useEffect, useCallback } from 'react';
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
    rating: number | null
}


export default function RecommendResult() {
  const [query, setQuery] = useState('');
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [targetSong, setTargetSong] = useState<Song | null>(null)
  const { id } = useParams()
  const { user } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [artistLikeness, setArtistLikeness] = useState(false);
  const [albumLikeness, setAlbumLikeness] = useState(false);
  const [songwriterLikeness, setSongwriterLikeness] = useState(false);
  const [bpmLikeness, setBpmLikeness] = useState(false);
  const [genreLikeness, setGenreLikeness] = useState(false);
  const [ratingLikeness, setRatingLikeness] = useState(false);
  const [exactLikeness, setExactLikeness] = useState(false);
  const [userVotes, setUserVotes] = useState<Record<string, 'up' | 'down' | null>>({});
  const [loadingSong, setLoadingSong] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);
  
  const [overrides, setOverrides] = useState({
  artist: '',
  album: '',
  songwriter: '',
  bpm: '',
  genre: '',
  rating: ''
  });
  const getValue = (field: keyof typeof overrides, fallback: any) => {
    const value = overrides[field];
    if (value !== '') return value;

    return fallback ?? ''; // <- important
  };
  
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
          ),
          ratings!left (rating),
          song_feedback_summary (
            helpful_count,
            unhelpful_count
          )
        `)
        .order('title', { ascending: true });

      if (targetSong?.id) {
        queryBuilder = queryBuilder.neq('id', targetSong.id);
      }

      const artistValue = getValue('artist', targetSong?.artist);
      if (artistLikeness && artistValue) {
        queryBuilder = queryBuilder.ilike(
          'song_artists.artists.name',
          `%${artistValue}%`
        );
      }

      const albumValue = getValue('album', targetSong?.album);
      if (albumLikeness) {
        if (albumValue && albumValue !== 'Single') {
          queryBuilder = queryBuilder.ilike('albums.name', `%${albumValue}%`);
        } else {
          queryBuilder = queryBuilder.is('albums.id', null);
        }
      }

      const songwriterValue = getValue('songwriter', targetSong?.song_writer);
      if (songwriterLikeness && songwriterValue) {
        if (exactLikeness) {
          queryBuilder = queryBuilder.eq('songwriter', songwriterValue);
        } else {
          const writers = songwriterValue.split(',').map((w: string) => w.trim());
          queryBuilder = queryBuilder.or(
            writers.map((w: string) => `songwriter.ilike.%${w}%`).join(',')
          );
        }
      }

      const bpmValue = Number(getValue('bpm', targetSong?.bpm));
      if (bpmLikeness && !isNaN(bpmValue)) {
        if (exactLikeness) {
          queryBuilder = queryBuilder.eq('bpm', bpmValue);
        } else {
          queryBuilder = queryBuilder
            .gte('bpm', bpmValue - 5)
            .lte('bpm', bpmValue + 5);
        }
      }

      const genreValue = getValue('genre', targetSong?.genre);
        if (genreLikeness && genreValue) {
          if (exactLikeness) {
            queryBuilder = queryBuilder.eq('genre', genreValue);
          } else {
            const genres = genreValue.split(/[,/-]/).map((g: string) => g.trim());
            queryBuilder = queryBuilder.or(
              genres.map((g: string) => `genre.ilike.%${g}%`).join(',')
            );
          }
        }


      const { data, error } = await queryBuilder;

      if (error || !data) {
        setSongs([]);
        setLoading(false);
        return;
      }

      let results = data.map((song: any) => ({
        ...song,
        helpful_count: song.song_feedback_summary?.[0]?.helpful_count ?? 0,
        unhelpful_count: song.song_feedback_summary?.[0]?.unhelpful_count ?? 0,
      }));

      if (!error && data) {

        const rawRating = getValue('rating', targetSong?.rating);
        const ratingValue = rawRating === '' ? null : Number(rawRating);  
        if (ratingLikeness && ratingValue != null) {
          results = results.filter(song => {
            const avg = getAvgRating(song.ratings);
            if (avg == null) return false;

            if (exactLikeness) {
              return Math.abs(avg - ratingValue) < 0.01;
            } else {
              return Math.abs(avg - ratingValue) <= 0.25;
            }
          });
        }

        const bpmValue = Number(getValue('bpm', targetSong?.bpm));
        results.sort((a, b) => {
          const userA = userVotes[a.id];
          const userB = userVotes[b.id];

          if (userA === 'up' && userB !== 'up') return -1;
          if (userA !== 'up' && userB === 'up') return 1;

          if (userA === 'down' && userB !== 'down') return 1;
          if (userA !== 'down' && userB === 'down') return -1;

          const scoreA = (a.helpful_count ?? 0) - (a.unhelpful_count ?? 0);
          const scoreB = (b.helpful_count ?? 0) - (b.unhelpful_count ?? 0);

          const feedbackDiff = scoreB - scoreA;

          if (bpmLikeness && !isNaN(bpmValue)) {
            const bpmDiff =
              Math.abs(a.bpm - bpmValue) - Math.abs(b.bpm - bpmValue);

            return bpmDiff !== 0 ? bpmDiff : feedbackDiff;
          }

          return feedbackDiff;
        });

        const withAvg = results.map((song: any) => ({
          ...song,
          avg_rating: getAvgRating(song.ratings)
          
        }));

        setSongs(withAvg);

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



  const getAvgRating = (ratings: { rating: number}[] | undefined) => {
    const ratingsList = ratings ?? [];
    if (ratingsList.length === 0) {
      return null;
    }
    const sum = ratingsList.reduce((acc, r)=> acc + r.rating, 0);
    return sum / ratingsList.length;
  }
  
  // Makes the selected characteristic appear bolded
  const renderBold = (value: string | number | { name: string } | undefined, field: string) => {
    if (!value) return null;

    const filterMap: Record<string, boolean> = {
      artist: artistLikeness,
      album: albumLikeness,
      songwriter: songwriterLikeness,
      bpm: bpmLikeness,
      genre: genreLikeness,
      rating: ratingLikeness
    };

    // Bold if the filter checkbox is checked
    const isActive = filterMap[field] === true;

    const displayValue = typeof value === "object" && value !== null && "name" in value
      ? (value.name as string)
      : value;

    return isActive ? <strong>{displayValue}</strong> : displayValue;
  };  

    useEffect(() => {
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      onSubmit(fakeEvent);
      
    }, [artistLikeness, albumLikeness, bpmLikeness, songwriterLikeness, genreLikeness, ratingLikeness, targetSong, overrides, exactLikeness]);

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
              ),
              ratings!left (rating),
              song_feedback_summary (
                helpful_count,
                unhelpful_count
              )
            `)
            .eq('id', id)
            .maybeSingle();

          
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
              artist: data.song_artists?.map((sa: any) => sa.artists.name).join(', ') ?? '',
              rating: getAvgRating(data.ratings)
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

    const handleVote = async (songId: string, type: 'up' | 'down') => {
    const session = await supabase.auth.getUser();
    
      if (!user) return;
      const userid = (user != null) ? user.id : null;


      const current = userVotes[songId];
      const newVote = current === type ? null : type;

      setUserVotes(prev => ({ ...prev, [songId]: newVote }));

      setSongs(prev =>
        prev.map(song => {
          if (song.id !== songId) return song;

          let helpful = song.helpful_count ?? 0;
          let unhelpful = song.unhelpful_count ?? 0;

          if (current === 'up') helpful--;
          if (current === 'down') unhelpful--;

          if (newVote === 'up') helpful++;
          if (newVote === 'down') unhelpful++;

          return { ...song, helpful_count: helpful, unhelpful_count: unhelpful };
        })
      );

      let result;

      if (newVote === null) {
        result = await supabase
          .from('recommendation_feedback')
          .delete()
          .eq('song_id', songId)
          .eq('user_id', userid);
      } else {
        result = await supabase
          .from('recommendation_feedback')
          .upsert(
            {
              song_id: songId,
              user_id: userid,
              helpful: newVote === 'up'
            },
            { onConflict: 'song_id,user_id' }
          );
      }

      if (result.error) {
        console.error("DB vote error:", result.error);
        console.log("vote result:", result);
        console.log("auth user:", user);
      }
    };


    
  if (loading) return <div className="min-h-screen flex flex-col"><Navbar /><main className="p-6 text-center">Loading...</main><Footer /></div>
  if (error) return <div className="min-h-screen flex flex-col bg-background"><Navbar /><main className="text-destructive p-6 text-center">{error}</main><Footer /></div>
  //if (!targetSong) return <div className="min-h-screen flex flex-col bg-background"><Navbar /><main className="text-destructive p-6 text-center">Song not found</main><Footer /></div>



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
                 Genre: {targetSong?.genre} | BPM: {targetSong?.bpm} | Rating: {targetSong?.rating === null ? "N/A" : targetSong?.rating}
              </div>
            </div>
          </div>
          
          <h1 className="text-1xl font-semibold text-center mb-2 text-primary">Override Values</h1>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input
              placeholder="Artist override"
              value={overrides.artist}
              onChange={(e) => setOverrides({ ...overrides, artist: e.target.value })}
            />

            <input
              placeholder="Album override"
              value={overrides.album}
              onChange={(e) => setOverrides({ ...overrides, album: e.target.value })}
            />

            <input
              placeholder="Songwriter override"
              value={overrides.songwriter}
              onChange={(e) =>
                setOverrides({ ...overrides, songwriter: e.target.value })
              }
            />

            <input
              placeholder="Genre override"
              value={overrides.genre}
              onChange={(e) => setOverrides({ ...overrides, genre: e.target.value })}
            />

            <input
              placeholder="BPM override"
              value={overrides.bpm}
              onChange={(e) => setOverrides({ ...overrides, bpm: e.target.value })}
            />


            <input
              placeholder="Rating override"
              value={overrides.rating}
              onChange={(e) => setOverrides({ ...overrides, rating: e.target.value })}
            />

            
          </div>

          <div className="mt-4 flex justify-center">
              <Button
                size="2"
                variant="soft"
                onClick={() => setOverrides({
                  artist: '',
                  album: '',
                  songwriter: '',
                  bpm: '',
                  genre: '',
                  rating: ''
                })}
              >
                Reset Overrides
              </Button>

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

              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={genreLikeness} onChange={(e) => setGenreLikeness(e.target.checked)} />
                Genre
              </label>

              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={ratingLikeness} onChange={(e) => setRatingLikeness(e.target.checked)} />
                Rating
              </label>

              <label className="flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={exactLikeness} onChange={(e) => setExactLikeness(e.target.checked)} />
                Exact
              </label>

            </div>
          </div>

          {/* Back to Search  button */}
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
              <div className={`mt-4 ${songs.length > 10 ? 'max-h-[500px] overflow-y-auto' : ''}`}>
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
                                <div className="flex-1">Rating: {renderBold(song.avg_rating === null ? "N/A" : song.avg_rating.toFixed(1), "rating")}</div>
                                <div className="flex-1"></div>
                            </div>


                            <div className="flex flex-wrap gap-4">
                              <Button
                                onClick={() => handleVote(song.id, 'up')}
                                variant={userVotes[song.id] === 'up' ? 'solid' : 'ghost'}
                              >
                                👍
                              </Button>

                              <Button
                                onClick={() => handleVote(song.id, 'down')}
                                variant={userVotes[song.id] === 'down' ? 'solid' : 'ghost'}
                              >
                                👎
                              </Button>
                              <div className="text-sm text-muted-foreground">
                                👍 {song.helpful_count ?? 0} | 👎 {song.unhelpful_count ?? 0}
                              </div>
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
              </div>
            )}
          </div>
          </div>
        </div>
      </div>
  );
}