import { refreshCommand, type RefreshResult } from '../../commands/refresh.js';

export async function handleRawRefreshStale(projectRoot: string): Promise<RefreshResult> {
  console.log('raw_refresh_stale called');
  return await refreshCommand(projectRoot);
}
