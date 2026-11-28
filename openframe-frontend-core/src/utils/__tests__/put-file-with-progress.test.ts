/**
 * The XHR PUT both chat uploaders share: the headers go out as given, progress is the share of bytes sent, a non-2xx
 * answer and an abort reject.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { putFileWithProgress } from '../put-file-with-progress';

/** A stand-in XHR the test drives by hand. */
class FakeXhr {
  static last: FakeXhr | null = null;
  static readonly DONE = 4;
  readonly upload = new EventTarget();
  private readonly events = new EventTarget();
  readonly headers: Record<string, string> = {};
  method = '';
  url = '';
  status = 0;
  statusText = '';
  responseText = '';
  readyState = 0;
  timeout = 0;
  body: unknown;
  aborted = false;

  constructor() {
    FakeXhr.last = this;
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
  }
  abort() {
    if (this.aborted || this.readyState === FakeXhr.DONE) return;
    this.aborted = true;
    this.readyState = FakeXhr.DONE;
    this.events.dispatchEvent(new Event('abort'));
  }
  addEventListener(type: string, listener: EventListener, options?: AddEventListenerOptions) {
    this.events.addEventListener(type, listener, options);
  }
  progress(loaded: number, total: number) {
    const event = Object.assign(new Event('progress'), { lengthComputable: true, loaded, total });
    this.upload.dispatchEvent(event);
  }
  answer(status: number, statusText = '') {
    this.status = status;
    this.statusText = statusText;
    this.readyState = FakeXhr.DONE;
    this.events.dispatchEvent(new Event('load'));
  }
}

describe('putFileWithProgress', () => {
  beforeEach(() => {
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    FakeXhr.last = null;
  });

  it('PUTs the file with exactly the headers given and reports the share sent', async () => {
    const file = new File(['abc'], 'a.txt', { type: 'text/plain' });
    const onProgress = vi.fn();
    const done = putFileWithProgress('https://storage.test/put', file, {
      headers: { 'Content-Type': 'text/plain', 'x-goog-content-length-range': '0,20971520' },
      onProgress,
    });
    const xhr = FakeXhr.last;
    expect(xhr?.method).toBe('PUT');
    expect(xhr?.url).toBe('https://storage.test/put');
    expect(xhr?.headers).toEqual({ 'Content-Type': 'text/plain', 'x-goog-content-length-range': '0,20971520' });
    expect(xhr?.body).toBe(file);
    xhr?.progress(1, 4);
    xhr?.progress(4, 4);
    expect(onProgress.mock.calls).toEqual([[0.25], [1]]);
    xhr?.answer(200);
    await expect(done).resolves.toBeUndefined();
  });

  it('rejects a non-2xx answer with its status', async () => {
    const done = putFileWithProgress('https://storage.test/put', new Blob(['x']));
    FakeXhr.last?.answer(403, 'Forbidden');
    await expect(done).rejects.toThrow('Upload failed with status 403: Forbidden');
  });

  it('stops the request when the signal aborts', async () => {
    const controller = new AbortController();
    const done = putFileWithProgress('https://storage.test/put', new Blob(['x']), { signal: controller.signal });
    controller.abort();
    await expect(done).rejects.toThrow('Upload cancelled');
    expect(FakeXhr.last?.aborted).toBe(true);
  });

  it('never opens a request for a signal that is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      putFileWithProgress('https://storage.test/put', new Blob(['x']), { signal: controller.signal }),
    ).rejects.toThrow('Upload cancelled');
    expect(FakeXhr.last).toBeNull();
  });
});
