-- FleetLanka Supabase schema (MVP + service bookings)

-- Extensions
create extension if not exists "pgcrypto";

-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Profiles (linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id),
  role text not null check (role in ('owner','manager','driver','service')),
  status text not null default 'active' check (status in ('active','inactive')),
  full_name text,
  phone text,
  created_at timestamptz not null default now()
);

-- Auto-create org + profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org_id uuid;
  v_org_name text;
  v_full_name text;
  v_role text;
  v_phone text;
begin
  v_role := lower(coalesce(new.raw_user_meta_data->>'role', 'owner'));
  if v_role not in ('owner','manager','driver','service') then
    v_role := 'owner';
  end if;

  v_full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1)
  );
  v_phone := nullif(new.raw_user_meta_data->>'phone', '');

  begin
    v_org_id := nullif(new.raw_user_meta_data->>'org_id', '')::uuid;
  exception when others then
    v_org_id := null;
  end;

  if v_org_id is null then
    v_org_name := coalesce(
      new.raw_user_meta_data->>'org_name',
      v_full_name || ' Org',
      'FleetLanka Org'
    );
    insert into public.organizations (name)
    values (v_org_name)
    returning id into v_org_id;
  end if;

  insert into public.profiles (id, org_id, role, status, full_name, phone)
  values (new.id, v_org_id, v_role, 'active', v_full_name, v_phone)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Helper function to get current user's org
create or replace function public.current_org_id()
returns uuid
language sql
stable
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

-- Vehicles
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  plate_no text not null,
  make text,
  model text,
  vehicle_type text,
  year int,
  status text default 'active',
  mileage numeric,
  odometer_km numeric,
  transmission_type text,
  engine_size_cc int,
  accident_history_count int default 0,
  fuel_efficiency numeric,
  maintenance_history text,
  reported_issues_count int default 0,
  tire_condition text,
  brake_condition text,
  battery_status text,
  created_at timestamptz not null default now(),
  unique (org_id, plate_no)
);

-- Trips (summary)
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid references public.profiles(id),
  start_time timestamptz not null,
  end_time timestamptz,
  start_lat numeric,
  start_lon numeric,
  end_lat numeric,
  end_lon numeric,
  distance_km numeric,
  duration_min numeric,
  avg_speed_kmh numeric,
  idle_min numeric,
  created_at timestamptz not null default now()
);

-- GPS points (optional)
create table if not exists public.gps_points (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  recorded_at timestamptz not null,
  lat numeric not null,
  lon numeric not null,
  speed_kmh numeric
);

-- Fuel logs
create table if not exists public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_id uuid references public.profiles(id),
  fuel_date date not null,
  liters numeric not null,
  cost_lkr numeric,
  odometer_km numeric,
  vendor text,
  created_at timestamptz not null default now()
);

-- Maintenance records
create table if not exists public.maintenance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  service_center_id uuid references public.service_centers(id) on delete set null,
  service_booking_id uuid unique references public.service_bookings(id) on delete set null,
  service_date date not null,
  service_type text,
  cost_lkr numeric,
  odometer_km numeric,
  next_service_due_km numeric,
  predicted_due_date date,
  notes text,
  created_at timestamptz not null default now()
);

-- Documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  vehicle_id uuid references public.vehicles(id) on delete cascade,
  driver_id uuid references public.profiles(id) on delete cascade,
  doc_type text not null,
  doc_number text,
  expiry_date date,
  file_url text,
  created_at timestamptz not null default now(),
  constraint documents_owner_check check (
    (vehicle_id is not null and driver_id is null)
    or (vehicle_id is null and driver_id is not null)
  )
);

-- Alerts
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  alert_type text not null,
  related_entity text,
  related_id uuid,
  message text not null,
  due_date date,
  status text default 'open',
  created_at timestamptz not null default now()
);

-- Service centers
create table if not exists public.service_centers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  profile_id uuid references public.profiles(id) on delete set null,
  name text not null,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

-- Service bookings
create table if not exists public.service_bookings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  center_id uuid not null references public.service_centers(id) on delete cascade,
  requested_date date not null,
  status text default 'pending',
  notes text,
  work_type text,
  service_notes text,
  proposed_tire_condition text,
  proposed_brake_condition text,
  proposed_battery_status text,
  completion_review_status text,
  completion_review_notes text,
  completion_reviewed_at timestamptz,
  completion_reviewed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  final_cost_lkr numeric,
  created_at timestamptz not null default now()
);

-- Driver score snapshots
create table if not exists public.driver_scores (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  driver_id uuid not null references public.profiles(id) on delete cascade,
  driver_name text,
  overall_score int not null check (overall_score between 0 and 100),
  speed_score numeric,
  idle_score numeric,
  distance_score numeric,
  consistency_score numeric,
  computed_at timestamptz not null default now()
);

-- Maintenance prediction snapshots
create table if not exists public.maintenance_predictions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  prediction int not null check (prediction in (0, 1)),
  probability numeric not null check (probability >= 0 and probability <= 1),
  risk_level text not null check (risk_level in ('low', 'medium', 'high')),
  threshold_used numeric,
  model_version text,
  input_features jsonb,
  predicted_at timestamptz not null default now()
);

create index if not exists maint_pred_org_vehicle_time_idx
  on public.maintenance_predictions (org_id, vehicle_id, predicted_at desc);

-- Enable RLS
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.gps_points enable row level security;
alter table public.fuel_logs enable row level security;
alter table public.maintenance enable row level security;
alter table public.documents enable row level security;
alter table public.alerts enable row level security;
alter table public.service_centers enable row level security;
alter table public.service_bookings enable row level security;
alter table public.driver_scores enable row level security;
alter table public.maintenance_predictions enable row level security;

-- Organizations policies
create policy "org_select" on public.organizations
  for select using (id = public.current_org_id());
create policy "org_insert" on public.organizations
  for insert with check (true);

-- Profiles policies
create policy "profile_select" on public.profiles
  for select using (id = auth.uid());
create policy "profile_insert" on public.profiles
  for insert with check (id = auth.uid());
create policy "profile_update" on public.profiles
  for update using (id = auth.uid());

-- Generic org-based policies
create policy "vehicles_org" on public.vehicles
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy "trips_org" on public.trips
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy "fuel_org" on public.fuel_logs
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy "maint_org" on public.maintenance
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy "docs_org" on public.documents
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy "alerts_org" on public.alerts
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy "centers_org" on public.service_centers
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy "bookings_org" on public.service_bookings
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy "driver_scores_org" on public.driver_scores
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

create policy "maintenance_predictions_org" on public.maintenance_predictions
  for all using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- GPS points policy (via trip org)
create policy "gps_points_trip_org" on public.gps_points
  for all using (
    exists (
      select 1 from public.trips t
      where t.id = gps_points.trip_id
        and t.org_id = public.current_org_id()
    )
  )
  with check (
    exists (
      select 1 from public.trips t
      where t.id = gps_points.trip_id
        and t.org_id = public.current_org_id()
    )
  );
