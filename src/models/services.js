const db = require('../config/db');

const listActiveWithCategory = async () => {
  const res = await db.query(`
    SELECT s.*, c.name AS category_name
    FROM services s
    LEFT JOIN categories c ON c.id = s.category_id
    WHERE s.status = 'active'
    ORDER BY c.sort_order ASC, s.name ASC
  `);
  return res.rows;
};

const listAllWithCategory = async () => {
  const res = await db.query(`
    SELECT s.*, c.name AS category_name
    FROM services s
    LEFT JOIN categories c ON c.id = s.category_id
    ORDER BY c.sort_order ASC, s.name ASC
  `);
  return res.rows;
};

const findById = async (id) => {
  const res = await db.query('SELECT * FROM services WHERE id = $1', [id]);
  return res.rows[0] || null;
};

const listCategories = async () => {
  const res = await db.query('SELECT * FROM categories ORDER BY sort_order ASC');
  return res.rows;
};

const findCategoryByName = async (name) => {
  const res = await db.query('SELECT * FROM categories WHERE name = $1', [name]);
  return res.rows[0] || null;
};

const createCategory = async (name) => {
  const existing = await findCategoryByName(name);
  if (existing) return existing;

  const maxOrderRes = await db.query(
    'SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM categories'
  );
  const maxOrder = maxOrderRes.rows[0] ? maxOrderRes.rows[0].m : 0;
  const nextOrder = maxOrder + 1;

  const insRes = await db.query(
    'INSERT INTO categories (name, sort_order) VALUES ($1, $2) RETURNING id, name, sort_order',
    [name, nextOrder]
  );
  return insRes.rows[0];
};

const create = async (svc) => {
  const res = await db.query(
    `INSERT INTO services
      (category_id, provider_service_id, name, description, rate_per_1000, provider_rate_per_1000, min_quantity, max_quantity, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      svc.category_id,
      svc.provider_service_id,
      svc.name,
      svc.description,
      svc.rate_per_1000,
      svc.provider_rate_per_1000,
      svc.min_quantity,
      svc.max_quantity,
      svc.status || 'active',
    ]
  );
  return res.rows[0];
};

const update = async (id, svc) => {
  await db.query(
    `UPDATE services
     SET category_id = $1,
         name = $2,
         description = $3,
         rate_per_1000 = $4,
         min_quantity = $5,
         max_quantity = $6
     WHERE id = $7`,
    [
      svc.category_id,
      svc.name,
      svc.description,
      svc.rate_per_1000,
      svc.min_quantity,
      svc.max_quantity,
      id,
    ]
  );
};

const findByProviderServiceId = async (providerServiceId) => {
  const res = await db.query(
    'SELECT * FROM services WHERE provider_service_id = $1',
    [String(providerServiceId)]
  );
  return res.rows[0] || null;
};

const upsertFromProvider = async (providerService, markup) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const existingRes = await client.query(
      'SELECT * FROM services WHERE provider_service_id = $1',
      [String(providerService.service)]
    );
    const existing = existingRes.rows[0] || null;

    const categoryName = providerService.category || 'Other';
    let catRes = await client.query('SELECT * FROM categories WHERE name = $1', [categoryName]);
    let category = catRes.rows[0];
    if (!category) {
      const maxRes = await client.query(
        'SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM categories'
      );
      const nextOrder = (maxRes.rows[0] ? maxRes.rows[0].m : 0) + 1;
      const insCat = await client.query(
        'INSERT INTO categories (name, sort_order) VALUES ($1, $2) RETURNING *',
        [categoryName, nextOrder]
      );
      category = insCat.rows[0];
    }

    const providerRate = parseFloat(providerService.rate) || 0;
    const ourRate = Math.round(providerRate * markup * 100) / 100;

    if (existing) {
      await client.query(
        `UPDATE services
         SET name = $1,
             description = $2,
             provider_rate_per_1000 = $3,
             min_quantity = $4,
             max_quantity = $5,
             category_id = $6
         WHERE id = $7`,
        [
          providerService.name,
          providerService.type || '',
          providerRate,
          parseInt(providerService.min, 10) || 1,
          parseInt(providerService.max, 10) || 10000,
          category.id,
          existing.id,
        ]
      );
      await client.query('COMMIT');
      return { updated: true, id: existing.id };
    }

    const insSvc = await client.query(
      `INSERT INTO services
        (category_id, provider_service_id, name, description, rate_per_1000, provider_rate_per_1000, min_quantity, max_quantity, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'disabled')
       RETURNING id`,
      [
        category.id,
        String(providerService.service),
        providerService.name,
        providerService.type || '',
        ourRate,
        providerRate,
        parseInt(providerService.min, 10) || 1,
        parseInt(providerService.max, 10) || 10000,
      ]
    );

    await client.query('COMMIT');
    return { inserted: true, id: insSvc.rows[0].id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  listActiveWithCategory,
  listAllWithCategory,
  findById,
  listCategories,
  createCategory,
  create,
  update,
  findByProviderServiceId,
  upsertFromProvider,
};