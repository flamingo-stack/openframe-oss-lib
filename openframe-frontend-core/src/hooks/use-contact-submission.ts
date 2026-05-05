import { useState, useCallback, useEffect } from 'react';
import { useToast } from "./use-toast";
import { useRouter } from 'next/navigation';

interface ContactSubmissionOptions {
  userId?: string;
  successRedirectUrl?: string;
  successToastMessage?: string;
  onSuccess?: () => void;
}

/**
 * Mirrors the API contract at POST /api/contact (see `ContactBaseSchema` in
 * the consuming app). Keep optional fields aligned with the Zod schema —
 * anything missing here OR there will be silently dropped on submission.
 *
 * Tracking fields (rdt_cid, utm_*, referrer_url) are forwarded as-is and
 * persisted by the API; they don't need to be declared on the form, but
 * the index signature below preserves any extra keys callers spread in.
 */
interface ContactFormData {
  name: string;
  email: string;
  helpCategory: string;
  message: string;
  linkedin_url?: string;
  companySize?: string;
  referralSource?: string;
  rdt_cid?: string;
  // Permissive index signature — tracking metadata, A/B variants, and
  // future per-form fields flow through unchanged. The API decides what
  // to keep via its Zod schema.
  [key: string]: unknown;
}

/**
 * useContactSubmission
 * --------------------
 * Provides a helper for submitting contact form data to `/api/contact`.
 * Handles loading state, success detection, toast notifications, and redirect.
 * Follows the same pattern as useWaitlistRegistration for consistency.
 */
export function useContactSubmission(options: ContactSubmissionOptions = {}) {
  const { userId, successRedirectUrl, successToastMessage, onSuccess } = options;
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const submit = useCallback(async (formData: ContactFormData) => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...formData,
          user_id: userId
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit contact form');
      }

      // Success
      setIsSuccess(true);
      const message = successToastMessage 
        ? `Thank you! Your message has been sent. ${successToastMessage}`
        : 'Thank you! Your message has been sent successfully.';
      
      toast({
        title: "Message sent!",
        description: message,
        variant: 'success',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      toast({ 
        title: 'Failed to send message', 
        description: message, 
        variant: 'destructive' 
      });
      throw error; // allow caller to handle if needed
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, toast, userId, successToastMessage]);

  // Handle redirect after success
  useEffect(() => {
    if (isSuccess && successRedirectUrl) {
      console.log('🚀 Contact submission successful, redirecting to:', successRedirectUrl);
      const timer = setTimeout(() => {
        console.log('🎯 Performing redirect now to:', successRedirectUrl);
        if (successRedirectUrl.startsWith('http')) {
          window.location.href = successRedirectUrl;
        } else {
          router.push(successRedirectUrl);
        }
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [isSuccess, successRedirectUrl, router]);

  // Call onSuccess callback if provided
  useEffect(() => {
    if (isSuccess && onSuccess) {
      onSuccess();
    }
  }, [isSuccess, onSuccess]);

  return { submit, isSubmitting, isSuccess, setIsSuccess } as const;
}