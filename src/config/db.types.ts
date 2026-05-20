import type { Generated } from "kysely";

interface UsersTable {
  id: Generated<string>;
  name: string;
}

interface TestTable {
  test_strings: string;
}

export interface DB {
  "template_app.users": UsersTable;
  "newsapi.test_table": TestTable;
}

