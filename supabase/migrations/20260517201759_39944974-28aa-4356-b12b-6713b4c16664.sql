
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;

create policy "push_select_self_or_admin" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "push_insert_self" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy "push_delete_self_or_admin" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid() or public.is_admin(auth.uid()));

create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
