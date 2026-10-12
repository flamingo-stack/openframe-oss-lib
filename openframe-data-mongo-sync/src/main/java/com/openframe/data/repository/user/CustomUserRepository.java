package com.openframe.data.repository.user;

import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.document.user.filter.UserQueryFilter;

import java.util.Collection;
import java.util.List;

public interface CustomUserRepository {

    List<User> findUsersBySearch(UserQueryFilter filter, int limit);

    /**
     * Users ordered by {@code (email, _id)}, starting after {@code cursor} (a {@link UserPageCursor}).
     * {@code search} matches every whitespace-separated token against first name, last name or email;
     * the synthetic email of a self-deleted user is not matched. {@code excludeIds} are left out.
     */
    List<User> findUsersPage(Collection<UserStatus> statuses, Collection<String> excludeIds, String search,
                             String cursor, int limit);

    long countUsers(Collection<UserStatus> statuses, Collection<String> excludeIds, String search);
}
