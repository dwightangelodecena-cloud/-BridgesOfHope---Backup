-- admission_requests, patients, and discharge_requests are filtered by family_id on nearly
-- every admin and mobile screen load, but had no index on that column — every such query
-- was a full table scan. Cheap, safe, additive fix to reduce query cost on constrained compute.

create index if not exists admission_requests_family_id_idx on public.admission_requests (family_id);
create index if not exists patients_family_id_idx on public.patients (family_id);
create index if not exists discharge_requests_family_id_idx on public.discharge_requests (family_id);
