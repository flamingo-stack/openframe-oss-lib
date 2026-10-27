package com.openframe.api.dto.user;

import com.openframe.data.document.user.UserRole;
import com.openframe.data.document.user.UserStatus;

import java.util.List;

/**
 * The users list's funnels: every status and every role, in declaration order.
 *
 * @param roles effective roles, as the filter matches them: ADMIN counts the owners too
 */
public record UserFilters(List<FilterOption<UserStatus>> statuses, List<FilterOption<UserRole>> roles) {
}
