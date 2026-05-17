
DO $$
DECLARE
  v_existing uuid;
  v_uid uuid;
  rec record;
BEGIN
  FOR rec IN
    SELECT * FROM (VALUES
      ('admin@demo.app',     'Aisha Khan',   'Admin'::app_role),
      ('hod@demo.app',       'Rahul Verma',  'HOD'::app_role),
      ('finance@demo.app',   'Priya Shah',   'FinanceHead'::app_role),
      ('requester@demo.app', 'Karan Mehta',  'IC'::app_role)
    ) AS t(email, full_name, role)
  LOOP
    SELECT id INTO v_existing FROM auth.users WHERE email = rec.email;
    IF v_existing IS NULL THEN
      v_uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at, confirmation_token, email_change,
        email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000',
        v_uid, 'authenticated', 'authenticated', rec.email,
        crypt('Demo@1234', gen_salt('bf')),
        now(),
        jsonb_build_object('provider','email','providers', ARRAY['email']),
        jsonb_build_object('full_name', rec.full_name),
        now(), now(), '', '', '', ''
      );
      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_uid, v_uid::text,
        jsonb_build_object('sub', v_uid::text, 'email', rec.email, 'email_verified', true),
        'email', now(), now(), now()
      );
      v_existing := v_uid;
    END IF;

    INSERT INTO public.profiles (id, full_name, email)
    VALUES (v_existing, rec.full_name, rec.email)
    ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_existing, rec.role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END LOOP;
END $$;
