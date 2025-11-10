import knex, { Knex } from 'knex'
import dotenv from 'dotenv'
dotenv.config()

const client = process.env.DB_CLIENT || 'sqlite3'
const dbUrl = process.env.DB_URL || './voice2sql.sqlite'

let config: Knex.Config
if (client === 'mysql' || client === 'mysql2') {
  config = {
    client: 'mysql2',
    connection: dbUrl,
  }
} else {
  config = {
    client: 'sqlite3',
    connection: { filename: dbUrl },
    useNullAsDefault: true,
  }
}

export const db = knex(config)

export async function ensureSchema() {
  const hasTables = await db.schema.hasTable('tables')
  if (!hasTables) {
    await db.schema.createTable('tables', t => {
      t.increments('id').primary()
      t.string('name').notNullable()
    })
  }
  const hasColumns = await db.schema.hasTable('columns')
  if (!hasColumns) {
    await db.schema.createTable('columns', t => {
      t.increments('id').primary()
      t.integer('table_id').references('tables.id')
      t.string('name').notNullable()
      t.string('type').notNullable()
    })
  }
  const hasResults = await db.schema.hasTable('last_results')
  if (!hasResults) {
    await db.schema.createTable('last_results', t => {
      t.increments('id').primary()
      t.json('rows')
      t.timestamp('created_at').defaultTo(db.fn.now())
    })
  }
}

