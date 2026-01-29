-- Add country_code column with default value first
ALTER TABLE "contact_submissions" ADD COLUMN "country_code" varchar(10);--> statement-breakpoint
-- Update existing rows with a default country code
UPDATE "contact_submissions" SET "country_code" = '+1' WHERE "country_code" IS NULL;--> statement-breakpoint
-- Now make it NOT NULL
ALTER TABLE "contact_submissions" ALTER COLUMN "country_code" SET NOT NULL;--> statement-breakpoint
-- Make phone NOT NULL (only if there are no null values)
ALTER TABLE "contact_submissions" ALTER COLUMN "phone" SET NOT NULL;