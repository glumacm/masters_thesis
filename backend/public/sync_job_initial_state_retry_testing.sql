DELETE FROM public.sync_job where id is not null;

INSERT INTO public.sync_job (id, job_uuid, status, retries, created_datetime, entity_name) VALUES (1, '97707473-28a0-4c05-8676-ab243a11e936', 'IN_PROGRESS', 0, '2023-08-24 22:07:09', 'App\Entity\TestEntity');
INSERT INTO public.sync_job (id, job_uuid, status, retries, created_datetime, entity_name) VALUES (2, '97707473-28a0-4c05-8676-ab243a11e937', 'FINISHED', 0, '2023-08-24 22:10:10', 'App\Entity\TestEntity');
INSERT INTO public.sync_job (id, job_uuid, status, retries, created_datetime, entity_name) VALUES (3, '97707473-28a0-4c05-8676-ab243a11e938', 'FINISHED', 0, '2023-08-25 16:33:52', 'App\Entity\TestEntity');
INSERT INTO public.sync_job (id, job_uuid, status, retries, created_datetime, entity_name) VALUES (4, '97707473-28a0-4c05-8676-ab243a11e939', 'STOPPED', 0, '2023-08-25 17:26:01', 'App\Entity\TestEntity');
-- INSERT INTO public.sync_job (id, job_uuid, status, retries, created_datetime, entity_name) VALUES (5, 'd5a67cca-d2cf-4f09-9773-4fe38307e0e5', 'finished', 0, '2023-08-25 19:15:31', 'App\Entity\TestEntity');
-- INSERT INTO public.sync_job (id, job_uuid, status, retries, created_datetime, entity_name) VALUES (6, 'cb3cfe9f-dc1b-4568-8ede-d0be6f96de5c', 'finished', 0, '2023-08-26 11:20:38', 'App\Entity\TestEntity');
-- INSERT INTO public.sync_job (id, job_uuid, status, retries, created_datetime, entity_name) VALUES (7, '306d7703-9405-41a5-b184-aa56d3376f91', 'finished', 0, '2023-08-26 11:40:29', 'App\Entity\TestEntity');
-- INSERT INTO public.sync_job (id, job_uuid, status, retries, created_datetime, entity_name) VALUES (8, '2bce63da-9f63-4515-9d41-ec01e9d0213d', 'finished', 0, '2023-08-26 11:41:42', 'App\Entity\TestEntity');
-- INSERT INTO public.sync_job (id, job_uuid, status, retries, created_datetime, entity_name) VALUES (9, 'eded3860-8bc2-4d25-b27e-a00182b37701', 'finished', 0, '2023-08-26 11:42:53', 'App\Entity\TestEntity');
-- INSERT INTO public.sync_job (id, job_uuid, status, retries, created_datetime, entity_name) VALUES (10, '185900f7-e8ac-499f-bd5c-cafe67376df4', 'finished', 0, '2023-08-26 11:49:14', 'App\Entity\TestEntity');

