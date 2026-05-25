import * as Notifications from 'expo-notifications';

const NOTIFICATION_ID = 'daily-agile-tip';

const TIPS = [
  'A Sprint Goal is a commitment by the Scrum Team — not a list of tasks. One clear outcome beats ten features.',
  'The Scrum Master serves the team, not the other way around. Remove impediments before adding process.',
  'Velocity is a planning tool, not a performance metric. Never use it to compare teams.',
  'Psychological safety is the foundation of high-performing teams. Without it, retrospectives become performances.',
  'The Definition of Done is the Scrum Team\'s quality standard. If it\'s weak, the team is accruing hidden debt.',
  'A Product Owner who can\'t say "no" is not doing their job. The backlog should reflect priorities, not wishes.',
  'Daily Scrum is for the Developers, not the Scrum Master. Facilitate, don\'t interrogate.',
  'Acceptance criteria are a conversation starter, not a contract. The real clarity comes from the discussion.',
  'Technical debt compounds like financial debt. A team that ignores it will eventually stop delivering value.',
  'A team that never conflicts is not collaborating — it\'s complying. Healthy conflict drives better decisions.',
  'The Sprint Backlog belongs to the Developers. Management adjusting it mid-Sprint undermines the Sprint Goal.',
  'Kanban\'s superpower is WIP limits. Without them, it\'s just a digital sticky-note board.',
  'In SAFe, the Release Train Engineer is a servant leader, not a project manager. The distinction matters.',
  'A Scrum Master\'s best day is when the team no longer needs them for decisions.',
  'User stories are not requirements — they\'re placeholders for a conversation. Write them to invite dialogue.',
  'Inspect and Adapt works when you\'re honest about what you observe. Spin kills the retrospective.',
  'The best sprint planning happens when the team truly understands the "why" behind each story.',
  'Continuous improvement is a habit, not an event. One small change per sprint beats a big transformation every quarter.',
  'A blocker left unaddressed for more than 24 hours is a coaching opportunity for the Scrum Master.',
  'Multitasking cuts individual throughput by up to 40%. WIP limits aren\'t bureaucracy — they\'re science.',
  'The Agile Manifesto values individuals and interactions over processes and tools — not instead of them.',
  'A good retrospective action item has a name attached, a deadline, and a way to measure it.',
  'Story points measure complexity, not time. If your team uses them to track hours, start over.',
  'The Sprint Review is for stakeholders to inspect the product and adapt the roadmap — not a demo for applause.',
  'Flow efficiency (value-adding time vs. wait time) is often under 15% in traditional orgs. Agile fixes the wait.',
  'PI Planning works when teams are honest about capacity. Padding is just delayed bad news.',
  'A Scrum Master who runs every meeting is a facilitator. One who grows facilitation in others is a coach.',
  'The Product Goal gives the backlog direction. Without it, refinement is just grooming noise.',
  'Empowered teams outperform managed teams. Give people the problem, not the solution.',
  'Done means done. "Done except for testing" is the most expensive phrase in software development.',
];

export function getTodaysTip(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return TIPS[dayOfYear % TIPS.length];
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleDailyTip(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => {});
  const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: 'AgileIQ Daily Tip',
      body: tip,
      data: { tipPrompt: `Tell me more about this coaching insight: "${tip}"` },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: 8,
      minute: 30,
      repeats: true,
    },
  });
}

export async function cancelDailyTip(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => {});
}
