'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StudyPlan, DayPlan, Question, MultipleChoiceQuestion } from '@/lib/types';

const START_DATE = new Date('2026-04-05T00:00:00Z');
const TOTAL_DAYS = 47;

function getCurrentDay(): number {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.min(diff + 1, TOTAL_DAYS));
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export default function DashboardPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = useState(true);
  const [currentDay, setCurrentDay] = useState<number>(1);
  const [viewDay, setViewDay] = useState<number>(1);
  const [todayPlan, setTodayPlan] = useState<DayPlan | null>(null);

  // Quiz state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allAskedQuestions, setAllAskedQuestions] = useState<string[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);

  useEffect(() => {
    const day = getCurrentDay();
    setCurrentDay(day);
    setViewDay(day);
    fetchPlan();
  }, []);

  useEffect(() => {
    if (plan) {
      const dayData = plan.days.find((d) => d.day === viewDay) ?? null;
      setTodayPlan(dayData);
      resetQuiz();
      setAllAskedQuestions([]);
    }
  }, [plan, viewDay]);

  async function fetchPlan() {
    setLoadingPlan(true);
    try {
      const res = await fetch('/api/study-plan');
      const data = await res.json();
      if (!data.plan) { router.push('/setup'); return; }
      setPlan(data.plan);
    } catch {
      router.push('/setup');
    } finally {
      setLoadingPlan(false);
    }
  }

  function resetQuiz() {
    setQuizStarted(false);
    setQuestions([]);
    setCurrentQ(0);
    setSelectedAnswer(null);
    setAnswered(false);
    setScore(0);
    setQuizDone(false);
  }

  async function fetchQuestions(isNew = false) {
    if (!todayPlan) return;
    setLoadingQuestions(true);
    setQuizStarted(true);
    setQuizDone(false);
    setCurrentQ(0);
    setScore(0);
    setAnswered(false);
    setSelectedAnswer(null);

    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayPlan: todayPlan,
          previousQuestions: isNew ? allAskedQuestions : [],
        }),
      });
      const data = await res.json();
      const newQuestions: Question[] = data.questions ?? [];
      setQuestions(newQuestions);
      // Track all questions asked so far for this day
      setAllAskedQuestions((prev) => [
        ...prev,
        ...newQuestions.map((q) => q.question),
      ]);
    } catch {
      setQuestions([]);
    } finally {
      setLoadingQuestions(false);
    }
  }

  function handleAnswer() {
    if (!answered) {
      setAnswered(true);
      const q = questions[currentQ] as MultipleChoiceQuestion;
      if (selectedAnswer === q.correctIndex) setScore((s) => s + 1);
    } else {
      if (currentQ + 1 >= questions.length) {
        setQuizDone(true);
      } else {
        setCurrentQ((c) => c + 1);
        setAnswered(false);
        setSelectedAnswer(null);
      }
    }
  }

  const progress = plan ? Math.round((currentDay / TOTAL_DAYS) * 100) : 0;

  if (loadingPlan) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-spin mb-3">⚕️</div>
          <p className="text-gray-600">טוען תוכנית לימודים...</p>
        </div>
      </div>
    );
  }

  if (!plan || !todayPlan) return null;

  const currentQ_data = questions[currentQ] as MultipleChoiceQuestion | undefined;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-3xl mx-auto space-y-4">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">🏥 {plan.subject}</h1>
            <p className="text-gray-500 text-sm mt-0.5">{formatDate(todayPlan.date)}</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-blue-600">יום {viewDay}</span>
            <p className="text-gray-400 text-xs">מתוך {TOTAL_DAYS}</p>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>התקדמות</span>
            <span>{progress}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-3">
            <button
              onClick={() => setViewDay((d) => Math.max(1, d - 1))}
              disabled={viewDay === 1}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-300"
            >
              ← יום קודם
            </button>
            {viewDay !== currentDay && (
              <button onClick={() => setViewDay(currentDay)} className="text-sm text-indigo-600 underline">
                חזור להיום
              </button>
            )}
            <button
              onClick={() => setViewDay((d) => Math.min(TOTAL_DAYS, d + 1))}
              disabled={viewDay === TOTAL_DAYS}
              className="text-sm text-blue-600 hover:text-blue-800 disabled:text-gray-300"
            >
              יום הבא →
            </button>
          </div>
        </div>

        {/* Today's Material */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">📚 חומר ללימוד היום</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {todayPlan.topics.map((topic, i) => (
              <span key={i} className="bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">{topic}</span>
            ))}
          </div>
          <p className="text-gray-700 leading-relaxed mb-4" dir="auto">{todayPlan.summary}</p>
          <h3 className="font-semibold text-gray-800 mb-2">נקודות מפתח:</h3>
          <ul className="space-y-2">
            {todayPlan.keyPoints.map((point, i) => (
              <li key={i} className="flex gap-2 text-gray-700" dir="auto">
                <span className="text-blue-500 mt-0.5 shrink-0">✓</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Osmosis Videos */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-1">🎬 סרטוני Osmosis</h2>
          <p className="text-sm text-gray-500 mb-3">לחץ לחיפוש סרטונים רלוונטיים ב-Osmosis</p>
          <div className="flex flex-wrap gap-2">
            {todayPlan.osmosisTerms.map((term, i) => (
              <a
                key={i}
                href={`https://www.osmosis.org/search?q=${encodeURIComponent(term)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                🔍 {term} ↗
              </a>
            ))}
          </div>
        </div>

        {/* Quiz Section */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-lg font-bold text-gray-900 mb-3">📝 חידון יומי</h2>

          {!quizStarted && (
            <div className="text-center py-4">
              <p className="text-gray-500 mb-4">5 שאלות אמריקאיות על חומר היום</p>
              <button
                onClick={() => fetchQuestions(false)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                התחל חידון
              </button>
            </div>
          )}

          {quizStarted && loadingQuestions && (
            <div className="text-center py-6">
              <div className="animate-spin text-2xl mb-2">🤖</div>
              <p className="text-gray-500">Claude מייצר שאלות חדשות...</p>
            </div>
          )}

          {quizStarted && !loadingQuestions && !quizDone && currentQ_data && (
            <div>
              <div className="flex justify-between text-sm text-gray-400 mb-3">
                <span>שאלה {currentQ + 1} מתוך {questions.length}</span>
                <span>ניקוד: {score}</span>
              </div>

              <p className="font-medium text-gray-800 mb-4 text-lg leading-relaxed" dir="auto">
                {currentQ_data.question}
              </p>

              <div className="space-y-2">
                {currentQ_data.options.map((opt, i) => {
                  let cls = 'border border-gray-200 rounded-xl p-3 cursor-pointer transition-all';
                  if (!answered) {
                    cls += selectedAnswer === i ? ' bg-blue-50 border-blue-400' : ' hover:bg-gray-50';
                  } else {
                    if (i === currentQ_data.correctIndex) cls += ' bg-green-50 border-green-400 text-green-800';
                    else if (selectedAnswer === i) cls += ' bg-red-50 border-red-400 text-red-800';
                  }
                  return (
                    <div key={i} className={cls} onClick={() => !answered && setSelectedAnswer(i)} dir="auto">
                      <span className="font-medium">{'ABCD'[i]}. </span>{opt}
                    </div>
                  );
                })}
                {answered && (
                  <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-800 mt-2" dir="auto">
                    <strong>הסבר:</strong> {currentQ_data.explanation}
                  </div>
                )}
              </div>

              <button
                onClick={handleAnswer}
                disabled={!answered && selectedAnswer === null}
                className="mt-4 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors"
              >
                {answered ? (currentQ + 1 >= questions.length ? 'סיים חידון' : 'שאלה הבאה →') : 'בדוק תשובה'}
              </button>
            </div>
          )}

          {quizDone && (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">
                {score >= 4 ? '🏆' : score >= 2 ? '👍' : '📖'}
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-1">{score} / {questions.length} נכון</h3>
              <p className="text-gray-500 mb-5 text-sm">
                {score >= 4 ? 'מעולה! שלטת בחומר!' : score >= 2 ? 'כל הכבוד, כדאי לחזור על החומר החלש.' : 'כדאי לחזור ולקרוא שוב את החומר.'}
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => fetchQuestions(false)}
                  className="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-medium px-5 py-2 rounded-xl text-sm transition-colors"
                >
                  נסה שוב
                </button>
                <button
                  onClick={() => fetchQuestions(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2 rounded-xl text-sm transition-colors"
                >
                  🔄 שאלות חדשות
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center pb-6">
          <button onClick={() => router.push('/setup')} className="text-xs text-gray-400 hover:text-gray-600 underline">
            עדכן קובץ לימוד
          </button>
        </div>
      </div>
    </div>
  );
}
