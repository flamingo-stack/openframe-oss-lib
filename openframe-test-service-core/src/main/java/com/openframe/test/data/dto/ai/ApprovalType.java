package com.openframe.test.data.dto.ai;

/**
 * Who is entitled to resolve a pending command approval, carried by {@code ApprovalRequestData.approvalType}.
 *
 * <p>The backend's four-level guardrail verdict ({@code SecurityApprovalLevel}: ALLOW, ASK_USER,
 * ASK_TECHNICIAN, DENY) is collapsed onto these two by {@code PolicyApprovalEvaluator}: ALLOW emits no
 * approval at all, DENY throws before one exists, ASK_USER becomes {@link #CLIENT} (or {@link #ADMIN} when
 * the caller is the admin assistant), and <b>ASK_TECHNICIAN always becomes {@link #ADMIN}</b>.
 *
 * <p>On the Fae surface the caller is never an admin assistant, so {@link #ADMIN} there means exactly one
 * thing: the tenant escalated this command to technician approval, and the user cannot authorize it
 * themselves ({@code DialogApprovalAccessValidator} rejects an AGENT resolving an ADMIN-typed request).
 */
public enum ApprovalType {
    CLIENT,
    ADMIN
}
