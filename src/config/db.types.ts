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

interface PipelineFeedStoriesTable {
  id: Generated<string>;
  pipeline_run_id: string;
  topic: string;
  title: string;
  summary: string;
  sources: string[];
  created_at: Generated<Date>;
}

interface CandidateStoriesTable {
  id: Generated<string>;
  pipeline_run_id: string;
  topic: string;
  title: string;
  url: string;
  snippet: string;
  source_domain: string;
  legitimacy_score: number | null;
  is_duplicate: boolean | null;
  sub_topic: string | null;
  cluster_id: string | null;
  status: string;
  created_at: Generated<Date>;
}

export interface DB {
  "template_app.users": UsersTable;
  "newsapi.test_table": TestTable;
  "newsapi.feed_stories": FeedStoriesTable;
  "newsapi.pipeline_feed_stories": PipelineFeedStoriesTable;
  "newsapi.candidate_stories": CandidateStoriesTable;
}
