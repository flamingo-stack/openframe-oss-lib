package com.openframe.data.repository.user;

import com.openframe.data.document.user.UserRole;
import com.openframe.data.document.user.UserStatus;

import java.util.Collection;

/**
 * What {@link CustomUserRepository#findUsersPage} and {@link CustomUserRepository#countUsers} narrow by; a null
 * or empty part narrows by nothing.
 *
 * @param roles      granted roles, as stored (see {@link UserRole#grantedFor} for effective ones)
 * @param excludeIds users left out
 * @param search     every whitespace-separated word must match the first name, last name or email
 */
public record UserListFilter(Collection<UserStatus> statuses, Collection<UserRole> roles,
                             Collection<String> excludeIds, String search) {

    public UserListFilter withStatuses(Collection<UserStatus> statuses) {
        return new UserListFilter(statuses, roles, excludeIds, search);
    }

    public UserListFilter withRoles(Collection<UserRole> roles) {
        return new UserListFilter(statuses, roles, excludeIds, search);
    }
}
