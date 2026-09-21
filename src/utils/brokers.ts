import { auth } from '../firebase';

export async function brokerRequest(action: string, payload: Record<string, unknown> = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in to continue.');
  const response = await fetch('/api/brokers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The broker request could not be completed.');
  return result;
}
