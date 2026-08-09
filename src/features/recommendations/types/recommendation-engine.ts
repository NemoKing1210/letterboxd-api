export type RecommendationOptions = {
  limit?: number;
};

export type Recommendation = {
  title: string;
  reason: string;
  score: number;
  basedOn: string[];
  slug?: string | null;
  movieId?: string;
  year?: number | null;
  poster?: string | null;
};

export interface RecommendationEngine {
  recommend(username: string, options?: RecommendationOptions): Promise<Recommendation[]>;
}
