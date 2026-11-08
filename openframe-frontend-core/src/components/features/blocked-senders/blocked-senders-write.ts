import { toast } from '../../../hooks/use-toast';
import { apiErrorMessage, errorMessage } from '../../../utils/common';
import { contentFetch } from '../../../utils/embed-content-fetch';

export interface BlockedSendersWrite {
  url: string;
  method: 'POST' | 'DELETE';
  body?: unknown;
  /** The toast when the host answers with success. */
  success: string;
  /** The toast title, and the message when the host names no reason, when it does not. */
  failure: string;
}

/**
 * ONE write to the host's blocked-senders routes: send it, then say how it went in a toast (the host's own reason on
 * a refusal, through `apiErrorMessage`). Answers whether it succeeded, so the caller reloads what it changed.
 */
export async function sendBlockedSendersWrite({
  url,
  method,
  body,
  success,
  failure,
}: BlockedSendersWrite): Promise<boolean> {
  try {
    const response = await contentFetch(url, {
      method,
      ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      throw new Error(apiErrorMessage(payload, failure));
    }
    toast({ title: success, variant: 'success' });
    return true;
  } catch (error) {
    toast({ title: failure, description: errorMessage(error, failure), variant: 'error' });
    return false;
  }
}
