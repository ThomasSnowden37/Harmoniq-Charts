import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';

import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [column, setColumn] = useState<
  'title' | 'artist' | 'album' | 'genre' | 'bpm' | 'song_writer' | 'singles_by_artist'
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
      // BPM searches for exact numbers
      if (column === 'bpm') {
        const bpmQuery = parseInt(query, 10);
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
          .order('title', {ascending: true}));

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
        const { data: songArtistData, error: artistError } = await supabase
          .from('song_artists')
          .select(`
            song_id,
            songs (
              *,
              song_artists (
                artists (*)
              )
            ),
            artists!inner (*)
          `)
          .ilike('artists.name', `%${query}%`)
          .order('title', {ascending: true});

        if (artistError) {
          console.error(artistError);
          setSongs([]);
          setLoading(false);
          return;
        }

        // Extract unique songs
        const uniqueSongs = songArtistData
          ?.map((sa: any) => sa.songs)
          .filter((song: any, index: number, self: any[]) =>
            index === self.findIndex((s) => s.id === song.id)
          );

        setSongs(uniqueSongs || []);
        setLoading(false);
        return;
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
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-semibold text-center mb-2">Song Lookup</h1>
          <p className="text-center text-gray-500 mb-6">
            Use the dropdown menu to select what to search by
          </p>

          <form onSubmit={onSubmit} className="flex items-center gap-3">
            {/* Search input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                aria-label="Search"
                placeholder="Search..."
                className="w-full pl-9 pr-4 h-12 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black/20"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* Dropdown for selecting column */}
            <select
              value={column}
              onChange={(e) => setColumn(e.target.value as typeof column)}
              className="h-12 px-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black/20 bg-white"
            >
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="album">Album</option>
              <option value="genre">Genre</option>
              <option value="bpm">BPM</option>
              <option value="song_writer">Song Writers</option>
              <option value="singles_by_artist">Singles by Artist</option>
            </select>

            {/* Search button */}
            <button
              type="submit"
              className="h-12 px-6 rounded-xl bg-black text-white hover:opacity-90 transition"
            >
              Search
            </button>
          </form>

          {/* Results */}
          <div className="mt-8">
            {loading && <p className="text-gray-500">Loading...</p>}

            { !firstSearch && !loading && songs.length === 0 && query && (
              <p className="text-gray-500">No results found for "{query}" in {column}</p>
            )}

            {!loading && songs.length > 0 && (
              <ul className="mt-4 space-y-2">
                {songs.map((song: any) => (
                  <li
                    key={song.id}
                    className="rounded-xl border border-gray-200 p-4 hover:bg-gray-50 transition flex justify-between items-center"
                  >
                    <div>
                      <div>
                        <div className="text-lg text-blue-600">
                          {renderBold(song.title, "title")}
                        </div>
                        <div className="text-gray-700">
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
                              <div className="flex-1 min-w-[200px]">Song Writer(s): {renderBold(song.song_writer, "song_writer")} </div>
                              <div className="flex-1 min-w-[120px]">Album: {renderBold(song.albums?.name ?? "Single", "album")} </div>
                          </div>      

                          <div className="flex flex-wrap gap-4">
                              <div className="flex-1">Genre: {renderBold(song.genre, "genre")} </div>
                              <div className="flex-1">Bpm: {renderBold(song.bpm, "bpm")}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Redirect to the page */}
                    <button
                      onClick={() => navigate(`/songs/${song.id}`)}
                      className="p-2 rounded-full hover:bg-gray-200 transition"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
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