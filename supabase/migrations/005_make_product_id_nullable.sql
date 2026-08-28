-- Migration: 005_make_product_id_nullable.sql
-- Purpose: Allow media library uploads without requiring a product_id association
-- This makes product_id nullable so standalone media items can be stored

ALTER TABLE product_images
  ALTER COLUMN product_id DROP NOT NULL;

-- Also add a comment explaining the table's dual use
COMMENT ON TABLE product_images IS 'Stores both product images (with product_id) and standalone media library items (with null product_id)';
