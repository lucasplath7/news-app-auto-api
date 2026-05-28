import type { Generated } from "kysely";

interface UsersTable {
  id: Generated<string>;
  name: string;
}

interface TestTable {
  test_strings: string;
}

interface FeedStoriesTable {
  id: Generated<string>;
  topic: string;
  title: string;
  summary: string;
  sources: string[];
  created_at: Generated<Date>;
}

export interface DB {
  "template_app.users": UsersTable;
  "newsapi.test_table": TestTable;
  "newsapi.feed_stories": FeedStoriesTable;
}

