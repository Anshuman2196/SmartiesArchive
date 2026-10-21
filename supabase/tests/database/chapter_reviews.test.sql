begin;
select plan(17);

insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data)
values
  ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'reviewer-one@example.invalid', '{"username":"reviewer_one","display_name":"Reviewer One"}', '{}'),
  ('66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'reviewer-two@example.invalid', '{"username":"reviewer_two","display_name":"Reviewer Two"}', '{}');

insert into public.works (id, author_id, title, visibility, state)
values
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '55555555-5555-4555-8555-555555555555', 'Reviewable public work', 'public', 'published'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', '55555555-5555-4555-8555-555555555555', 'Reviewable unlisted work', 'unlisted', 'published'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3', '55555555-5555-4555-8555-555555555555', 'Private work', 'private', 'published');

insert into public.chapters (id, work_id, title, body, state)
values
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'Public chapter', 'text', 'published'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd2', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'Unlisted chapter', 'text', 'published'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddddd3', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc3', 'Private chapter', 'text', 'published');

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
select lives_ok($$insert into public.chapter_reviews (work_id,chapter_id,user_id,rating,body) values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','dddddddd-dddd-4ddd-8ddd-ddddddddddd1','55555555-5555-4555-8555-555555555555',5,'A strong opening.')$$, 'a member can review a public chapter');
select lives_ok($$insert into public.chapter_reviews (work_id,chapter_id,user_id,rating) values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2','dddddddd-dddd-4ddd-8ddd-ddddddddddd2','55555555-5555-4555-8555-555555555555',4)$$, 'a member can review an unlisted chapter');
select throws_ok($$insert into public.chapter_reviews (work_id,chapter_id,user_id,rating) values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc3','dddddddd-dddd-4ddd-8ddd-ddddddddddd3','55555555-5555-4555-8555-555555555555',4)$$, '42501', null, 'a member cannot review a private chapter');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::integer from public.chapter_reviews where chapter_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'), 1, 'anonymous readers can see reviews on public chapters');
select is((select count(*)::integer from public.chapter_reviews where chapter_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2'), 1, 'anonymous readers can see reviews on unlisted chapters');
select is((select count(*)::integer from public.chapter_reviews where chapter_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd3'), 0, 'private chapter reviews are not visible');
select throws_ok($$insert into public.chapter_reviews (work_id,chapter_id,user_id,rating) values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','dddddddd-dddd-4ddd-8ddd-ddddddddddd1','66666666-6666-4666-8666-666666666666',3)$$, '42501', null, 'anonymous readers cannot create reviews');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}', true);
select is((select count(*)::integer from public.chapter_reviews where chapter_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'), 1, 'members can see reviews on readable chapters');
select is((with changed as (update public.chapter_reviews set body = 'tampered' where user_id = '55555555-5555-4555-8555-555555555555' returning 1) select count(*)::integer from changed), 0, 'members cannot edit another readers review');
select is((with removed as (delete from public.chapter_reviews where user_id = '55555555-5555-4555-8555-555555555555' returning 1) select count(*)::integer from removed), 0, 'members cannot delete another readers review');
select lives_ok($$insert into public.chapter_reviews (work_id,chapter_id,user_id,rating,body) values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','dddddddd-dddd-4ddd-8ddd-ddddddddddd1','66666666-6666-4666-8666-666666666666',3,'Needs room to breathe.')$$, 'a second member can review the same chapter');
select throws_ok($$insert into public.chapter_reviews (work_id,chapter_id,user_id,rating) values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','dddddddd-dddd-4ddd-8ddd-ddddddddddd1','66666666-6666-4666-8666-666666666666',2)$$, '23505', null, 'a member has one review per chapter');
select lives_ok($$update public.chapter_reviews set rating = 4, body = 'Updated thoughts.' where user_id = '66666666-6666-4666-8666-666666666666'$$, 'a member can edit their own review');
select is((select body from public.chapter_reviews where user_id = '66666666-6666-4666-8666-666666666666'), 'Updated thoughts.', 'the own review update is stored');
select throws_ok($$update public.chapter_reviews set chapter_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2' where user_id = '66666666-6666-4666-8666-666666666666'$$, 'P0001', 'review identity cannot change', 'a member cannot move their review to another chapter');
select lives_ok($$delete from public.chapter_reviews where user_id = '66666666-6666-4666-8666-666666666666'$$, 'a member can delete their own review');
select is((select count(*)::integer from public.chapter_reviews where user_id = '66666666-6666-4666-8666-666666666666'), 0, 'deleting a review removes only that review');

select * from finish();
rollback;
