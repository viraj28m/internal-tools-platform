-- Application role: full access to the business tables, append-only on the
-- audit log. Migrations and seeding of privileges run as the database owner.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
--> statement-breakpoint
REVOKE ALL ON TABLE "audit_log" FROM app_user;
--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE "audit_log" TO app_user;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON TABLE "audit_log" FROM app_user;
