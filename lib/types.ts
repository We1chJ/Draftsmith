export type IdeaStatus = "new" | "drafted" | "used" | "archived";
export type PostStatus = "draft" | "approved" | "scheduled" | "publishing" | "published" | "failed";

export type Idea = {
  id: string;
  text: string;
  source: string | null;
  tags: string[];
  status: IdeaStatus;
  created_at: string;
};

export type Post = {
  id: string;
  idea_id: string | null;
  text: string;
  status: PostStatus;
  created_at: string;
  updated_at: string;
};

// A post the user actually published before. The history is also the writer's example set.
export type PastPost = {
  id: string;
  title: string;
  text: string;
  posted_on: string | null;
  created_at: string;
};

export type Voice = {
  instructions: string | null;
  posts: PastPost[];
};

export type Variant = { hook: string; text: string };

export const POST_MAX_CHARS = 3000;
