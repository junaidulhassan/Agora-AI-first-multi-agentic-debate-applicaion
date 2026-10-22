import { Atom, Cpu, Landmark, Brain, ScrollText, Sparkles, Vote, BookOpen } from 'lucide-react'

export const TOPICS = [
  {
    id: 'science',
    label: 'Science',
    icon: Atom,
    examples: ['Is the many-worlds interpretation of quantum mechanics correct?', 'Can humans reach Mars safely within 20 years?'],
  },
  {
    id: 'politics',
    label: 'Politics',
    icon: Vote,
    examples: ['Is universal basic income a good idea?', 'Should voting be mandatory?'],
  },
  {
    id: 'history',
    label: 'History',
    icon: ScrollText,
    examples: ['Was the fall of Rome inevitable?', 'Did the printing press cause the Reformation?'],
  },
  {
    id: 'technology',
    label: 'Technology',
    icon: Cpu,
    examples: ['Will artificial general intelligence arrive before 2040?', 'Is open-sourcing powerful AI models safe?'],
  },
  {
    id: 'philosophy',
    label: 'Philosophy',
    icon: Brain,
    examples: ['Do humans have free will?', 'Is morality objective?'],
  },
  {
    id: 'religion',
    label: 'Religion',
    icon: Landmark,
    examples: ['Does God exist?', 'Can science and religion be reconciled?'],
  },
  {
    id: 'custom',
    label: 'Custom',
    icon: Sparkles,
    examples: ['Is a hot dog a sandwich?', 'Should cities ban private cars downtown?'],
  },
]

export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((topic) => [topic.id, topic]))

export const FallbackTopicIcon = BookOpen
