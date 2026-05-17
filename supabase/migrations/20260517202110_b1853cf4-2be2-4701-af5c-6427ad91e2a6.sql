do $$ begin
  begin
    alter publication supabase_realtime add table public.approval_steps;
  exception when duplicate_object then null;
  end;
end $$;