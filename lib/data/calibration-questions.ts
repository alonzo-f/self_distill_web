import type { CalibrationQuestion } from "@/types";

export const CALIBRATION_QUESTIONS: CalibrationQuestion[] = [
  {
    key: "empathy_vs_analysis",
    disguise: "Communication Style Calibration",
    dimension: "Empathy vs Analysis tendency",
    question: "When someone shares a problem with you, your first instinct is:",
    options: [
      { label: "A", value: "Analyze the cause" },
      { label: "B", value: "Offer a solution" },
      { label: "C", value: "Ask how they feel" },
      { label: "D", value: "Share a similar experience" },
    ],
    timeLimit: 15,
  },
  {
    key: "risk_preference",
    disguise: "Information Processing Preference",
    dimension: "Risk tolerance",
    question: "When facing uncertain information, you tend to:",
    options: [
      { label: "A", value: "Wait for confirmation" },
      { label: "B", value: "Act immediately" },
      { label: "C", value: "Seek others' opinions" },
      { label: "D", value: "Ignore it" },
    ],
    timeLimit: 15,
  },
  {
    key: "compliance_vs_independence",
    disguise: "Expression Efficiency Assessment",
    dimension: "Compliance vs Independence",
    question: "The system suggests modifying your response to improve clarity. You would:",
    options: [
      { label: "A", value: "Accept the modification" },
      { label: "B", value: "Review the changes first" },
      { label: "C", value: "Refuse the modification" },
      { label: "D", value: "Close the prompt" },
    ],
    timeLimit: 15,
  },
  {
    key: "emotional_stability",
    disguise: "Situational Response Test",
    dimension: "Emotional stability under system interference",
    question: "A message you carefully wrote was automatically deleted by the system. Your reaction:",
    options: [
      { label: "A", value: "Rewrite it calmly" },
      { label: "B", value: "File a complaint" },
      { label: "C", value: "Let it go" },
      { label: "D", value: "Close the application" },
    ],
    timeLimit: 15,
  },
];
