/**
 * Migration: Add foreign key relationships across the schema.
 *
 * 1. menu_items.category_id → menu_categories(id) ON DELETE RESTRICT
 * 2. order_items.menu_item_id → menu_items(id) ON DELETE SET NULL
 * 3. reviews.menu_item_id → menu_items(id) ON DELETE CASCADE
 * 4. admin_login_logs.admin_id → admin_account(id) ON DELETE SET NULL
 * 5. orders.coupon_code → coupons(code) ON DELETE SET NULL
 *
 * Usage: node src/db/migrate-foreign-keys.js
 */
require("dotenv").config();
const pool = require("./pool");

const steps = [
  // ── 1. menu_items → menu_categories ──
  {
    name: "Add category_id column to menu_items",
    sql: `ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category_id INTEGER;`,
  },
  {
    name: "Populate category_id from category name",
    sql: `
      UPDATE menu_items mi
      SET category_id = mc.id
      FROM menu_categories mc
      WHERE mi.category = mc.name
        AND mi.category_id IS NULL;
    `,
  },
  {
    name: "Insert missing categories referenced by menu_items",
    sql: `
      INSERT INTO menu_categories (name, sort_order)
      SELECT DISTINCT mi.category, 999
      FROM menu_items mi
      LEFT JOIN menu_categories mc ON mc.name = mi.category
      WHERE mc.id IS NULL AND mi.category IS NOT NULL
      ON CONFLICT (name) DO NOTHING;
    `,
  },
  {
    name: "Populate category_id for newly inserted categories",
    sql: `
      UPDATE menu_items mi
      SET category_id = mc.id
      FROM menu_categories mc
      WHERE mi.category = mc.name
        AND mi.category_id IS NULL;
    `,
  },
  {
    name: "Set category_id NOT NULL",
    sql: `ALTER TABLE menu_items ALTER COLUMN category_id SET NOT NULL;`,
  },
  {
    name: "Add FK menu_items.category_id → menu_categories(id)",
    sql: `
      ALTER TABLE menu_items
      DROP CONSTRAINT IF EXISTS fk_menu_items_category;

      ALTER TABLE menu_items
      ADD CONSTRAINT fk_menu_items_category
      FOREIGN KEY (category_id) REFERENCES menu_categories(id)
      ON DELETE RESTRICT;
    `,
  },
  {
    name: "Drop old category text column",
    sql: `ALTER TABLE menu_items DROP COLUMN IF EXISTS category;`,
  },
  {
    name: "Replace category text index with category_id index",
    sql: `
      DROP INDEX IF EXISTS idx_menu_items_category;
      CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
    `,
  },

  // ── 2. order_items → menu_items ──
  {
    name: "Add menu_item_id column to order_items",
    sql: `ALTER TABLE order_items ADD COLUMN IF NOT EXISTS menu_item_id INTEGER;`,
  },
  {
    name: "Populate order_items.menu_item_id from item name",
    sql: `
      UPDATE order_items oi
      SET menu_item_id = mi.id
      FROM menu_items mi
      WHERE oi.name = mi.name
        AND oi.menu_item_id IS NULL;
    `,
  },
  {
    name: "Add FK order_items.menu_item_id → menu_items(id)",
    sql: `
      ALTER TABLE order_items
      DROP CONSTRAINT IF EXISTS fk_order_items_menu_item;

      ALTER TABLE order_items
      ADD CONSTRAINT fk_order_items_menu_item
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
      ON DELETE SET NULL;
    `,
  },

  // ── 3. reviews → menu_items ──
  {
    name: "Add menu_item_id column to reviews",
    sql: `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS menu_item_id INTEGER;`,
  },
  {
    name: "Populate reviews.menu_item_id from item_name",
    sql: `
      UPDATE reviews r
      SET menu_item_id = mi.id
      FROM menu_items mi
      WHERE r.item_name = mi.name
        AND r.menu_item_id IS NULL;
    `,
  },
  {
    name: "Add FK reviews.menu_item_id → menu_items(id)",
    sql: `
      ALTER TABLE reviews
      DROP CONSTRAINT IF EXISTS fk_reviews_menu_item;

      ALTER TABLE reviews
      ADD CONSTRAINT fk_reviews_menu_item
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
      ON DELETE CASCADE;
    `,
  },

  // ── 4. admin_login_logs → admin_account ──
  {
    name: "Add FK admin_login_logs.admin_id → admin_account(id)",
    sql: `
      -- Nullify any orphaned admin_id values first
      UPDATE admin_login_logs
      SET admin_id = NULL
      WHERE admin_id IS NOT NULL
        AND admin_id NOT IN (SELECT id FROM admin_account);

      ALTER TABLE admin_login_logs
      DROP CONSTRAINT IF EXISTS fk_admin_login_logs_admin;

      ALTER TABLE admin_login_logs
      ADD CONSTRAINT fk_admin_login_logs_admin
      FOREIGN KEY (admin_id) REFERENCES admin_account(id)
      ON DELETE SET NULL;
    `,
  },

  // ── 5. orders → coupons ──
  {
    name: "Nullify orphaned coupon_code values in orders",
    sql: `
      UPDATE orders
      SET coupon_code = NULL
      WHERE coupon_code IS NOT NULL
        AND coupon_code NOT IN (SELECT code FROM coupons);
    `,
  },
  {
    name: "Add FK orders.coupon_code → coupons(code)",
    sql: `
      ALTER TABLE orders
      DROP CONSTRAINT IF EXISTS fk_orders_coupon;

      ALTER TABLE orders
      ADD CONSTRAINT fk_orders_coupon
      FOREIGN KEY (coupon_code) REFERENCES coupons(code)
      ON DELETE SET NULL;
    `,
  },
];

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const step of steps) {
      console.log(`⏳ ${step.name}...`);
      await client.query(step.sql);
      console.log(`✅ ${step.name}`);
    }

    await client.query("COMMIT");
    console.log("\n🎉 All foreign key migrations completed successfully!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n❌ Migration failed, rolled back:", err.message);
    console.error(err);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
