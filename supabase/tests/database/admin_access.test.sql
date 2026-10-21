begin;
select plan(12);

insert into auth.users (id, aud, role, email, raw_user_meta_data, raw_app_meta_data)
values
  ('55555555-5555-4555-8555-555555555555', 'authenticated', 'authenticated', 'admin@example.invalid', '{"username":"admin_user","display_name":"Admin User"}', '{}'),
  ('66666666-6666-4666-8666-666666666666', 'authenticated', 'authenticated', 'member@example.invalid', '{"username":"member_user","display_name":"Member User"}', '{}');

insert into public.admin_users (user_id)
values ('55555555-5555-4555-8555-555555555555');

insert into public.works (id, author_id, title, visibility, state)
values ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', '66666666-6666-4666-8666-666666666666', 'Moderated story', 'public', 'published');

insert into public.chapters (id, work_id, title, body, state)
values ('dddddddd-dddd-4ddd-8ddd-ddddddddddd1', 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'Moderated chapter', 'text', 'published');

set local role authenticated;
select set_config('request.jwt.claim.sub', '55555555-5555-4555-8555-555555555555', true);
select set_config('request.jwt.claims', '{"sub":"55555555-5555-4555-8555-555555555555","role":"authenticated"}', true);
select is(public.is_admin(), true, 'database membership marks the admin');
select is((select count(*)::integer from public.admin_users), 1, 'admin can see the membership table row');
select is((select count(*)::integer from public.works where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'), 1, 'admin can read all works');
select is((select count(*)::integer from public.chapters where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'), 1, 'admin can read all chapters');
select is(public.admin_unpublish_chapter('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'), true, 'admin can hide a published chapter');
select is((select state::text from public.chapters where id = 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1'), 'draft', 'chapter moderation only changes publication state');
select is(public.admin_unpublish_work('cccccccc-cccc-4ccc-8ccc-ccccccccccc1'), true, 'admin can hide a published story');
select is((select state::text from public.works where id = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'), 'draft', 'story moderation only changes publication state');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '66666666-6666-4666-8666-666666666666', true);
select set_config('request.jwt.claims', '{"sub":"66666666-6666-4666-8666-666666666666","role":"authenticated"}', true);
select is(public.is_admin(), false, 'regular members are not admins');
select is((select count(*)::integer from public.admin_users), 0, 'regular members cannot enumerate admin membership');
select throws_ok($$select public.admin_unpublish_work('cccccccc-cccc-4ccc-8ccc-ccccccccccc1')$$, '42501', 'Admin access required', 'regular members cannot call story moderation');
select throws_ok($$insert into public.admin_users (user_id) values ('66666666-6666-4666-8666-666666666666')$$, '42501', null, 'regular members cannot grant themselves admin access');

select * from finish();
rollback;
