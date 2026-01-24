import { useState, useEffect, useCallback } from 'react';
import { Activity, TrendingUp, Users } from 'lucide-react';
import apiClient from '@/services/api/client';

export interface SportradarPluginUIProps {
  agentId: string;
}

export function SportradarPluginUI({ agentId }: SportradarPluginUIProps) {
  const [nbaData, setNbaData] = useState<{
    liveGames?: Array<unknown>;
    standings?: Array<unknown>;
    stats?: Array<unknown>;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNBAData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const response = await apiClient.get(`/agents/${agentId}/plugins/sportradar/nba`);
    setNbaData(response.data);
    setLoading(false);
  }, [agentId]);

  useEffect(() => {
    fetchNBAData();
    const interval = setInterval(fetchNBAData, 60000);
    return () => clearInterval(interval);
  }, [fetchNBAData]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">NBA Data</h3>
        <button
          onClick={fetchNBAData}
          disabled={loading}
          className="text-sm text-primary hover:underline disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      {loading && !nbaData && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Activity className="h-5 w-5 mr-2 animate-spin" />
          Loading NBA data...
        </div>
      )}

      {nbaData && (
        <div className="space-y-4">
          {nbaData.liveGames && nbaData.liveGames.length > 0 && (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-4 w-4" />
                <h4 className="font-medium">Live Games</h4>
              </div>
              <div className="text-sm text-muted-foreground">
                {nbaData.liveGames.length} game(s) in progress
              </div>
            </div>
          )}

          {nbaData.standings && nbaData.standings.length > 0 && (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4" />
                <h4 className="font-medium">Standings</h4>
              </div>
              <div className="text-sm text-muted-foreground">
                {nbaData.standings.length} team(s) in standings
              </div>
            </div>
          )}

          {nbaData.stats && nbaData.stats.length > 0 && (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4" />
                <h4 className="font-medium">Player Stats</h4>
              </div>
              <div className="text-sm text-muted-foreground">
                {nbaData.stats.length} stat(s) available
              </div>
            </div>
          )}

          {(!nbaData.liveGames || nbaData.liveGames.length === 0) &&
           (!nbaData.standings || nbaData.standings.length === 0) &&
           (!nbaData.stats || nbaData.stats.length === 0) && (
            <div className="text-center py-8 text-muted-foreground">
              No NBA data available. Try querying the agent for specific information.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
