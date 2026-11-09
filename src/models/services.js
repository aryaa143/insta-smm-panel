const db = require('../config/db');

const listActiveWithCategory = () =>
  db
    .prepare(
      `SELECT s.*, c.name AS category_name
       FROM services s LEFT JOIN categories c ON c.id = s.category_id
       WHERE s.status = 'active'
       ORDER BY c.sort_order ASC, s.name ASC`
    )
    .all();

const listAllWithCategory = () =>
  db
    .prepare(
      `SELECT s.*, c.name AS category_name
       FROM services s LEFT JOIN categories c ON c.id = s.category_id
       ORDER BY c.sort_order ASC, s.name ASC`
    )
    .all();

const findById = (id) => db.prepare('SELECT * FROM services WHERE id = ?').get(id);

const listCategories = () => db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();

const findCategoryByName = (name) => db.prepare('SELECT * FROM categories WHERE name = ?').get(name);

const createCategory = (name) => {
  const existing = findCategoryByName(name);
  if (existing) return existing;
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories').get().m;
  const info = db.prepare('INSERT INTO categories (name, sort_order) VALUES (?, ?)').run(name, maxOrder + 1);
  return { id: info.lastInsertRowid, name, sort_order: maxOrder + 1 };
};

const create = (svc) =>
  db
    .prepare(
      `INSERT INTO services
        (category_id, provider_service_id, name, description, rate_per_1000, provider_rate_per_1000, min_quantity, max_quantity, status)
       VALUES (@category_id, @provider_service_id, @name, @description, @rate_per_1000, @provider_rate_per_1000, @min_quantity, @max_quantity, @status)`
    )
    .run(svc);

const update = (id, svc) =>
  db
    .prepare(
      `UPDATE services SET category_id=@category_id, name=@name, description=@description,
        rate_per_1000=@rate_per_1000, min_quantity=@min_quantity, max_quantity=@max_quantity, status=@status
       WHERE id=@id`
    )
    .run({ ...svc, id });

const findByProviderServiceId = (providerServiceId) =>
  db.prepare('SELECT * FROM services WHERE provider_service_id = ?').get(String(providerServiceId));

const upsertFromProvider = db.transaction((providerService, markup) => {
  const existing = findByProviderServiceId(providerService.service);
  const category = createCategory(providerService.category || 'Other');
  const providerRate = parseFloat(providerService.rate) || 0;
  const ourRate = Math.round(providerRate * markup * 100) / 100;

  if (existing) {
    db.prepare(
      `UPDATE services SET name=?, description=?, provider_rate_per_1000=?, min_quantity=?, max_quantity=?, category_id=?
       WHERE id=?`
    ).run(
      providerService.name,
      providerService.type || '',
      providerRate,
      parseInt(providerService.min, 10) || 1,
      parseInt(providerService.max, 10) || 10000,
      category.id,
      existing.id
    );
    return { updated: true, id: existing.id };
  }

  const info = db
    .prepare(
      `INSERT INTO services
        (category_id, provider_service_id, name, description, rate_per_1000, provider_rate_per_1000, min_quantity, max_quantity, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'disabled')`
    )
    .run(
      category.id,
      String(providerService.service),
      providerService.name,
      providerService.type || '',
      ourRate,
      providerRate,
      parseInt(providerService.min, 10) || 1,
      parseInt(providerService.max, 10) || 10000
    );
  return { inserted: true, id: info.lastInsertRowid };
});

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
