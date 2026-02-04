import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

export const Route = createFileRoute('/dashboard/$accountId')({
  component: DashboardPage,
});

interface Account {
  id: number;
  mt5_login: string;
  mt5_server: string;
  account_name?: string;
  balance?: number;
  equity?: number;
  margin?: number;
  margin_free?: number;
  profit?: number;
  currency?: string;
  leverage?: number;
  last_synced_at?: string;
}

function DashboardPage() {
  const { accountId } = Route.useParams();
  const queryClient = useQueryClient();

  // Fetch account info from backend DB
  const { data: account, isLoading } = useQuery<Account>({
    queryKey: ['account', accountId],
    queryFn: async () => {
      const response = await fetch(`http://localhost:3001/api/accounts/${accountId}`);
      if (!response.ok) throw new Error('Failed to fetch account');
      return response.json();
    },
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`http://localhost:3001/api/accounts/${accountId}/sync`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sync');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account', accountId] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!account) {
    return <div className="container mx-auto py-8">Account not found</div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {account.account_name || `Account ${account.mt5_login}`}
          </h1>
          <p className="text-muted-foreground">
            {account.mt5_server} • Login: {account.mt5_login}
          </p>
          {account.last_synced_at && (
            <p className="text-sm text-muted-foreground mt-1">
              Last synced: {new Date(account.last_synced_at).toLocaleString()}
            </p>
          )}
        </div>
        <Button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Account
            </>
          )}
        </Button>
      </div>

      {syncMutation.isError && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Error: {syncMutation.error.message}
        </div>
      )}

      {syncMutation.isSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded">
          ✅ Synced {syncMutation.data.new_trades} trades successfully
        </div>
      )}

      {/* Account Statistics */}
      {account.balance !== undefined ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balance</CardTitle>
              <span className="text-xs text-muted-foreground">{account.currency || 'USD'}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${account.balance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Equity</CardTitle>
              <span className="text-xs text-muted-foreground">{account.currency || 'USD'}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${account.equity?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(account.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${account.profit?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Free Margin</CardTitle>
              <span className="text-xs text-muted-foreground">1:{account.leverage || 'N/A'}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${account.margin_free?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Data Yet</CardTitle>
            <CardDescription>
              Click "Sync Account" to fetch data from MT5
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
