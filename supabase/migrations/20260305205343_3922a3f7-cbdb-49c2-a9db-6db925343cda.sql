-- Enable realtime for client_accounts and tasks tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.client_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;