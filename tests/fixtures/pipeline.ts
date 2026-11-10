export const candidates = [
  { title: 'Story A', url: 'https://source-a.example/story', snippet: 'First report.', sourceDomain: 'source-a.example' },
  { title: 'Story B', url: 'https://source-b.example/story', snippet: 'Second report.', sourceDomain: 'source-b.example' },
  { title: 'Rejected story', url: 'https://source-c.example/story', snippet: 'Unreliable report.', sourceDomain: 'source-c.example' },
  { title: 'Duplicate story', url: 'https://source-d.example/story', snippet: 'Duplicate report.', sourceDomain: 'source-d.example' },
];

export const classifications = candidates.map((_, candidateIndex) => ({
  candidateIndex,
  legitimacyScore: candidateIndex === 2 ? 0.2 : 0.9,
  isDuplicate: candidateIndex === 3,
  subTopic: 'test-event',
}));

export const stories = [{
  title: 'Combined story',
  summary: 'A summary supported by both sources.',
  sources: candidates.slice(0, 2).map((candidate) => candidate.url),
}];
