import { defineDb, defineTable, column } from 'astro:db';

const Guestbook = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),
    name: column.text(),
    message: column.text(),
    website: column.text({ optional: true }),
    createdAt: column.date(),
  },
});

// https://astro.build/db/config
export default defineDb({
  tables: {
    Guestbook,
  },
});
