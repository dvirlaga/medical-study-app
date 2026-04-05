export interface DayPlan {
  day: number;
  date: string;
  topics: string[];
  summary: string;
  keyPoints: string[];
  osmosisTerms: string[];
  pages?: string; // e.g. "12-34" or "45, 67-70"
}

export interface StudyPlan {
  subject: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  generatedAt: string;
  days: DayPlan[];
}

export interface MultipleChoiceQuestion {
  type: 'multiple_choice';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export type Question = MultipleChoiceQuestion;
