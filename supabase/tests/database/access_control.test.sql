begin;
select plan(38);

-- Fixture users are created only in the local test database. The profile
-- trigger must derive profiles from auth metadata without granting user write
-- access to other profiles.
insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data)
values
  ('11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'writer-one@example.invalid', '{"username":"writer_one","display_name":"Writer One"}', '{}'),
  ('22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'writer-two@example.invalid', '{"username":"writer_two","display_name":"Writer Two"}', '{}');

insert into public.works (id, author_id, title, summary, visibility, state)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'Public published', '', 'public', 'published'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'Unlisted published', '', 'unlisted', 'published'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', '11111111-1111-4111-8111-111111111111', 'Private published', '', 'private', 'published'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', '11111111-1111-4111-8111-111111111111', 'Public draft', '', 'public', 'draft');

insert into public.chapters (id, work_id, title, body, state)
values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Public chapter', 'text', 'published'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Draft chapter', 'text', 'draft'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'Unlisted chapter', 'text', 'published'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Private chapter', 'text', 'published'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'Chapter in draft work', 'text', 'published');

select ok(exists (select 1 from public.profiles where id = '11111111-1111-4111-8111-111111111111' and username = 'writer_one'), 'registration trigger creates the first profile');
select ok(exists (select 1 from public.profiles where id = '22222222-2222-4222-8222-222222222222' and username = 'writer_two'), 'registration trigger creates the second profile');
select throws_ok($$insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values ('33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated', 'invalid-name@example.invalid', '{"username":"x","display_name":"Invalid"}', '{}')$$, '23514', null, 'invalid registration metadata cannot create a profile');
select throws_ok($$insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data) values ('44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated', 'duplicate-name@example.invalid', '{"username":"WRITER_ONE","display_name":"Impersonator"}', '{}')$$, '23505', null, 'profile usernames are unique regardless of letter case');

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::integer from public.works), 1, 'anonymous table queries expose only public published works');
select is((select count(*)::integer from public.works where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'), 0, 'unlisted work rows cannot be enumerated through the table API');
select is((select count(*)::integer from public.read_unlisted_work('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')), 1, 'the unlisted share ID retrieves only its requested work');
select is((select count(*)::integer from public.works where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'), 0, 'anonymous readers cannot read private works');
select is((select count(*)::integer from public.chapters where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'), 1, 'anonymous readers can read a published public chapter');
select is((select count(*)::integer from public.chapters where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3'), 0, 'unlisted chapters cannot be enumerated through the table API');
select is((select count(*)::integer from public.read_unlisted_chapter('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb3')), 1, 'the unlisted share ID retrieves its requested published chapter');
select is((select count(*)::integer from public.read_unlisted_chapters('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')), 1, 'the unlisted share ID lists only published chapters');
select is((select count(*)::integer from public.chapters where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2'), 0, 'guessing a draft chapter ID does not reveal its content');
select is((select count(*)::integer from public.chapters where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb4'), 0, 'anonymous readers cannot read a private chapter');
select is((select count(*)::integer from public.chapters where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb5'), 0, 'a published chapter remains unreadable while its work is a draft');
select is((select count(*)::integer from public.profiles), 2, 'anonymous readers may view public profiles');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select is((select count(*)::integer from public.works), 1, 'a different member sees public published works only');
select is((select count(*)::integer from public.read_unlisted_work('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2')), 1, 'a member can read unlisted content by its share ID');
update public.profiles set username = 'stolen_name' where id = '11111111-1111-4111-8111-111111111111';
select is((select username from public.profiles where id = '11111111-1111-4111-8111-111111111111'), 'writer_one', 'a member cannot alter another profile');
select lives_ok($$update public.profiles set display_name = 'Writer Two Edited' where id = '22222222-2222-4222-8222-222222222222'$$, 'a member can update their own profile');
select lives_ok($$insert into public.works (id, author_id, title, visibility, state) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', '22222222-2222-4222-8222-222222222222', 'Own draft', 'private', 'draft')$$, 'a member can create their own work');
select throws_ok($$insert into public.works (author_id, title, visibility, state) values ('11111111-1111-4111-8111-111111111111', 'Impersonated', 'public', 'published')$$, '42501', null, 'a member cannot create work as another author');
select throws_ok($$insert into public.chapters (work_id, title, body, state) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Unauthorized', 'text', 'published')$$, '42501', null, 'a member cannot create a chapter in another author work');
select is((with changed as (update public.chapters set body = 'tampered' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' returning 1) select count(*)::integer from changed), 0, 'a member cannot edit another author chapter');
select is((with changed as (update public.works set state = 'draft' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' returning 1) select count(*)::integer from changed), 0, 'a member cannot unpublish another author work');
select is((with removed as (delete from public.works where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1' returning 1) select count(*)::integer from removed), 0, 'a member cannot delete another author work');
select lives_ok($$insert into public.chapters (id, work_id, title, body, state) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5', 'Own chapter', 'text', 'draft')$$, 'a member can create a chapter in their own work');
select is((select position::integer from public.chapters where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6'), 1, 'chapter position trigger assigns the next position');
select lives_ok($$update public.chapters set state = 'published' where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6'$$, 'a member can publish their own chapter');
select lives_ok($$update public.works set state = 'published', visibility = 'public' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'$$, 'a member can publish their own work');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::integer from public.works where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5'), 1, 'a newly published public work becomes readable');
select is((select count(*)::integer from public.chapters where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6'), 1, 'a newly published chapter becomes readable');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);
select lives_ok($$delete from public.chapters where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb6'$$, 'a member can delete their own chapter');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);
select is((select count(*)::integer from public.works), 4, 'owners can read their own private and draft works');
select is((select count(*)::integer from public.chapters), 5, 'owners can read their own draft and published chapters');
select is((select count(*)::integer from public.chapters where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1' and body = 'text'), 1, 'another member mutation did not change the owner chapter');
select is((select state::text from public.works where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 'published', 'another member could not unpublish the owner work');
select is((select count(*)::integer from public.works where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'), 1, 'another member deletion did not remove the owner work');

select * from finish();
rollback;
