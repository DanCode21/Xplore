import * as TaskManager from 'expo-task-manager';
import type { LocationObject } from 'expo-location';

// Background location task for active walk sessions. iOS keeps delivering
// fixes through this while the app is backgrounded or the phone is locked,
// as long as the session started in the foreground (While-Using permission
// is enough; the status-bar location indicator stays visible). Must be
// defined at module load — index.ts imports this file — so the task exists
// before iOS delivers queued events.
export const WALK_LOCATION_TASK = 'fogwalk-walk-session-location';

type LocationListener = (locations: LocationObject[]) => void;

let listener: LocationListener | null = null;

export function setWalkLocationListener(next: LocationListener | null): void {
  listener = next;
}

TaskManager.defineTask(WALK_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  const { locations } = data as { locations: LocationObject[] };
  if (locations?.length) listener?.(locations);
});
