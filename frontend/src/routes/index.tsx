import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/')({
  component: Index,
});

interface Account {
  id: number;
  mt5_login: string;
  mt5_server: string;
  account_name?: string;
  is_active: boolean;
}

function Index() {
  const { data: accounts = [], isLoading } = useQuery<{ accounts: Account[] }>({
    queryKey: ['accounts'],
    queryFn: async () => {
      const response = await fetch('http://localhost:3001/api/accounts');
      if (!response.ok) throw new Error('Failed to fetch accounts');
      return response.json();
    },
  });

  return (
    <div className="container mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold mb-2">Trading Journal</h1>
        <p className="text-muted-foreground">
          Track your trades, analyze your performance, and improve your trading strategy
        </p>
      </div>

      <div className="flex gap-4">
        <Link to="/accounts">
          <Button>Add MT5 Account</Button>
        </Link>
      </div>

      {isLoading ? (
        <p>Loading accounts...</p>
      ) : accounts.accounts?.length > 0 ? (
        <div>
          <h2 className="text-2xl font-semibold mb-4">Your Accounts</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.accounts.map((account) => (
              <Link
                key={account.id}
                to="/dashboard/$accountId"
                params={{ accountId: String(account.id) }}
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle>{account.account_name || `Account ${account.mt5_login}`}</CardTitle>
                    <CardDescription>{account.mt5_server}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Login: {account.mt5_login}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Accounts Yet</CardTitle>
            <CardDescription>
              Get started by adding your first MT5 account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/accounts">
              <Button>Add Account</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
