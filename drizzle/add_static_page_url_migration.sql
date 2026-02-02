-- Add staticPageUrl column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS static_page_url VARCHAR(500);

-- Add comment for documentation
COMMENT ON COLUMN products.static_page_url IS 'URL to the existing static product page in the Next.js app';
