let _resolve: ((purchased: boolean) => void) | null = null;

export function createPaywallPromise(): Promise<boolean> {
  return new Promise((resolve) => { _resolve = resolve; });
}

export function completePaywall(purchased: boolean): void {
  _resolve?.(purchased);
  _resolve = null;
}
