-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'PHASE_OUT', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "ImportRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'ABORTED', 'FAILED');

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "chemical_name" TEXT NOT NULL,
    "function" TEXT NOT NULL,
    "application_area" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "certifications" TEXT[],
    "status" "ProductStatus" NOT NULL,
    "launch_year" INTEGER,
    "description" TEXT NOT NULL,
    "is_listed" BOOLEAN NOT NULL DEFAULT true,
    "content_hash" TEXT NOT NULL,
    "last_import_run_id" INTEGER,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "rating_avg" DECIMAL(3,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "author_name" VARCHAR(80) NOT NULL,
    "rating" SMALLINT NOT NULL,
    "title" VARCHAR(120),
    "body" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_runs" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "file_checksum" TEXT NOT NULL,
    "status" "ImportRunStatus" NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "rows_read" INTEGER NOT NULL DEFAULT 0,
    "inserted" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "unchanged" INTEGER NOT NULL DEFAULT 0,
    "relisted" INTEGER NOT NULL DEFAULT 0,
    "delisted" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "issues" JSONB NOT NULL DEFAULT '[]',
    "error_message" TEXT,

    CONSTRAINT "import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_is_listed_status_idx" ON "products"("is_listed", "status");

-- CreateIndex
CREATE INDEX "products_function_idx" ON "products"("function");

-- CreateIndex
CREATE INDEX "products_application_area_idx" ON "products"("application_area");

-- CreateIndex
CREATE INDEX "products_region_idx" ON "products"("region");

-- CreateIndex
CREATE INDEX "products_launch_year_idx" ON "products"("launch_year");

-- CreateIndex
CREATE INDEX "products_rating_avg_idx" ON "products"("rating_avg");

-- CreateIndex
CREATE INDEX "products_certifications_idx" ON "products" USING GIN ("certifications");

-- CreateIndex
CREATE INDEX "reviews_product_id_created_at_idx" ON "reviews"("product_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Hand-written additions (not expressible in schema.prisma)
-- ---------------------------------------------------------------------------

-- Ratings are 1..5. Enforced in the database, not only in the API.
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);

-- Partial, case-insensitive text search ("lauret", "10013", "polysorb") that stays
-- index-backed at ~50k products. Postgres pg_trgm instead of a separate search engine.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "products_name_trgm_idx"          ON "products" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "products_chemical_name_trgm_idx" ON "products" USING GIN ("chemical_name" gin_trgm_ops);
CREATE INDEX "products_sku_trgm_idx"           ON "products" USING GIN ("sku" gin_trgm_ops);
CREATE INDEX "products_description_trgm_idx"   ON "products" USING GIN ("description" gin_trgm_ops);
