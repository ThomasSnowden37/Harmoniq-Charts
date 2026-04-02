import React, { useState } from 'react';
import { Search, ArrowRight } from 'lucide-react';
import { Button } from '@radix-ui/themes';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import { useNavigate } from "react-router-dom";

export default function UserSearchPage() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstSearch, setFirstSearch] = useState(true);
  
  const navigate = useNavigate();
  
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);

    let data, error;
    console.log("Searching for:", query);

    ({ data, error } = await supabase
        .from('users')
        .select(`*`)
        .ilike('username', `%${query}%`)
        .order('username', {ascending: true}));
    

      if (error) {
        console.error(error);
        setUsers([]);
      } 
      else {
        setUsers(data || []);
      }

    setLoading(false);
    setFirstSearch(false);
    console.log("DATA:", data);
    console.log("ERROR:", error);

  };


  return (
    <div>
    <Navbar />
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <div className="w-full max-w-2xl mx-4 bg-card rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-semibold text-center mb-2 text-primary">User Lookup</h1>
          <p className="text-center text-muted-foreground mb-6">
            Enter the username of the user
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

            { !firstSearch && !loading && users.length === 0 && query && (
              <p className="text-muted-foreground">No users found for "{query}"</p>
            )}

            {!loading && users.length > 0 && (
              <ul className="mt-4 space-y-2">
                {users.map((user: any) => (
                <li
                    key={user.id}
                    className="rounded-xl border border-border p-4 hover:bg-secondary transition flex justify-between items-center"
                >
                    <div>
                    <div className="text-lg text-primary">
                        {user.username}
                    </div>

                    <div className="text-sm text-muted-foreground">
                        {user.email}
                    </div>
                    </div>

                    <Button
                    variant="ghost"
                    size="2"
                    onClick={() => navigate(`/user/${user.id}`)}
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