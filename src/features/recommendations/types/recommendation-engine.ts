export type RecommendationOptions = {
  limit?: number;
};

export type Recommendation = {
  title: string;
  reason: string;
  score: number;
  basedOn: string[];
};

export interface RecommendationEngine {
  recommend(username: string, options?: RecommendationOptions): Promise<Recommendation[]>;
}
