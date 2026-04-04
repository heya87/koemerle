/**
 * Drops and recreates the public schema, then exits.
 * Usage: npm run db:reset
 */
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');

const sql = postgres(DATABASE_URL);
await sql`DROP SCHEMA public CASCADE`;
await sql`CREATE SCHEMA public`;
console.log('Database reset.');
await sql.end();
