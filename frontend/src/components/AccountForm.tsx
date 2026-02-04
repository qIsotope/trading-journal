import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

const accountSchema = z.object({
  mt5_login: z.string().min(1, 'MT5 Login is required'),
  mt5_server: z.string().min(1, 'MT5 Server is required'),
  mt5_password: z.string().min(1, 'Password is required'),
  account_name: z.string().optional(),
});

type AccountFormValues = z.infer<typeof accountSchema>;

interface AccountFormProps {
  onSuccess?: () => void;
}

export function AccountForm({ onSuccess }: AccountFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      mt5_login: '',
      mt5_server: '',
      mt5_password: '',
      account_name: '',
    },
  });

  async function onSubmit(values: AccountFormValues) {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        throw new Error('Failed to create account');
      }
      const data = await response.json();
      const accountId = data.account?.id;

      form.reset();
      onSuccess?.();

      if (accountId) {
        navigate({ to: '/dashboard/$accountId', params: { accountId: String(accountId) } });
      }
      onSuccess?.();
    } catch (error) {
      console.error('Error creating account:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add MT5 Account</CardTitle>
        <CardDescription>
          Connect your MetaTrader 5 account to start tracking trades
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="account_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My FTMO Account" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional friendly name for this account
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mt5_login"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>MT5 Login</FormLabel>
                  <FormControl>
                    <Input placeholder="12345678" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mt5_server"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>MT5 Server</FormLabel>
                  <FormControl>
                    <Input placeholder="FTMO-Demo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mt5_password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>MT5 Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormDescription>
                    Your password is encrypted and stored securely
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Account'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
