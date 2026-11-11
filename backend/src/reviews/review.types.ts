export interface ReviewView {
  id: number;
  authorName: string;
  rating: number;
  title: string | null;
  body: string;
  createdAt: string;
}

export interface ReviewPage {
  items: ReviewView[];
  total: number;
  page: number;
  pageSize: number;
}
