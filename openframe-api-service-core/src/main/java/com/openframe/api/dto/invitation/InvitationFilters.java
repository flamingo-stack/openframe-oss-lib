package com.openframe.api.dto.invitation;

import com.openframe.api.dto.user.FilterOption;
import com.openframe.data.document.user.UserRole;

import java.util.List;

/** The open invitations list's funnels: PENDING and EXPIRED, and every role. */
public record InvitationFilters(List<FilterOption<InvitationStatus>> statuses, List<FilterOption<UserRole>> roles) {
}
