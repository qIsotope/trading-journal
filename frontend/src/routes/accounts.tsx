import { createFileRoute } from '@tanstack/react-router';
import { AccountForm } from '@/components/AccountForm';

export const Route = createFileRoute('/accounts')({
  component: AccountsPage,
});

function AccountsPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">MT5 Accounts</h1>
      <div className="max-w-2xl">
        <AccountForm />
      </div>
    </div>
  );
}
