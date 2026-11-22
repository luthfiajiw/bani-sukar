CREATE TYPE "public"."gender" AS ENUM('L', 'P');--> statement-breakpoint
CREATE TYPE "public"."union_status" AS ENUM('married', 'divorced', 'widowed');--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"nickname" text,
	"gender" "gender" NOT NULL,
	"birth_place" text,
	"birth_date" date,
	"is_deceased" boolean DEFAULT false NOT NULL,
	"death_date" date,
	"is_blood_line" boolean DEFAULT true NOT NULL,
	"parent_union_id" uuid,
	"birth_order" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"husband_id" uuid,
	"wife_id" uuid,
	"status" "union_status" DEFAULT 'married' NOT NULL,
	"union_order" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unions_at_least_one_partner_chk" CHECK ("unions"."husband_id" IS NOT NULL OR "unions"."wife_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admin_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "persons" ADD CONSTRAINT "persons_parent_union_id_unions_id_fk" FOREIGN KEY ("parent_union_id") REFERENCES "public"."unions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unions" ADD CONSTRAINT "unions_husband_id_persons_id_fk" FOREIGN KEY ("husband_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unions" ADD CONSTRAINT "unions_wife_id_persons_id_fk" FOREIGN KEY ("wife_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "persons_parent_union_id_idx" ON "persons" USING btree ("parent_union_id");--> statement-breakpoint
CREATE INDEX "persons_full_name_idx" ON "persons" USING btree ("full_name");--> statement-breakpoint
CREATE UNIQUE INDEX "persons_parent_union_birth_order_uniq" ON "persons" USING btree ("parent_union_id","birth_order");--> statement-breakpoint
CREATE INDEX "unions_husband_id_idx" ON "unions" USING btree ("husband_id");--> statement-breakpoint
CREATE INDEX "unions_wife_id_idx" ON "unions" USING btree ("wife_id");