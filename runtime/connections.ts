export class ConnectionRegistry {
  readonly #windows = new Map<
    string,
    { connectionId: string; source: object }
  >();

  register(connectionId: string, windowId: string, source: object): void {
    this.#windows.set(windowId, { connectionId, source });
  }

  owns(connectionId: string, windowId: string, source: object): boolean {
    const entry = this.#windows.get(windowId);
    return entry?.connectionId === connectionId && entry.source === source;
  }

  remove(windowId: string): void {
    this.#windows.delete(windowId);
  }
}
