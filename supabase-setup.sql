-- DO OR DIE — Supabase schema
-- Run once in: Supabase Dashboard > SQL Editor > New query
-- Then seed the default accounts with: npm run seed

create table if not exists users (
  email         text primary key,
  password_hash text not null,
  name          text not null,
  role          text not null default 'USER',
  created_at    timestamptz not null default now()
);

create table if not exists tasks (
  user_email   text not null references users(email) on delete cascade,
  id           text not null,
  name         text not null,
  time_label   text not null,
  importance   text not null check (importance in ('LOW','MEDIUM','HIGH')),
  created_date text not null,
  primary key (user_email, id)
);
create index if not exists tasks_user_idx on tasks(user_email);

create table if not exists daily_progress (
  user_email text not null references users(email) on delete cascade,
  date       text not null,
  task_id    text not null,
  done       boolean not null default false,
  primary key (user_email, date, task_id)
);
create index if not exists progress_user_idx on daily_progress(user_email);

create table if not exists settings (
  id            boolean primary key default true check (id),
  morning_hour  int not null default 9,
  evening_hour  int not null default 20
);
insert into settings (id, morning_hour, evening_hour)
values (true, 9, 20)
on conflict (id) do nothing;
create table if not exists email_settings (
  user_email   text primary key references users(email) on delete cascade,
  morning_hour int not null default 9,
  evening_hour int not null default 20
);
