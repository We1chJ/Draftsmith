export type IdeaStatus = "new" | "drafted" | "used" | "archived";
export type PostStatus = "draft" | "approved" | "scheduled" | "publishing" | "published" | "failed";

export type Idea = {
  id: string;
  text: string;
  status: IdeaStatus;
  created_at: string;
};

// One timeline. Drafts and published history are the same table, told apart by status.
export type Post = {
  id: string;
  idea_id: string | null;
  title: string | null;
  text: string;
  status: PostStatus;
  origin: "app" | "imported";
  published_at: string | null;
  created_at: string;
  updated_at: string;
  scheduled_at?: string | null;
  linkedin_post_id?: string | null;
  /** True while the draft is being written in the background. */
  generating?: boolean;
  error?: string | null;
  /** Present on list endpoints. */
  image_count?: number;
};

export type IdeaDraft = Pick<Post, "id" | "text" | "status" | "generating" | "error" | "updated_at">;
export type IdeaWithDrafts = Idea & { posts: IdeaDraft[] };

export type Voice = {
  instructions: string | null;
  summary: string | null;
  summary_updated_at: string | null;
  summary_post_count: number | null;
  published_count: number;
  /** Newest published posts, used verbatim as examples. */
  examples: Pick<Post, "id" | "title" | "text">[];
};

export type PostImage = {
  id: string;
  alt: string | null;
  position: number;
  mime: string;
  bytes: number | null;
  /** Signed, short-lived URL for display. */
  url: string;
};

export const POST_MAX_CHARS = 3000;
/** How many published posts go into every prompt verbatim. */
export const EXAMPLE_LIMIT = 10;

export type LinkedInStatus =
  | { connected: false; expired?: boolean; expires_at?: string; days_left?: number }
  | { connected: true; expired: false; expires_at: string; days_left: number };
