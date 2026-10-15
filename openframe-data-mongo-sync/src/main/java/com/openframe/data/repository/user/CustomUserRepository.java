package com.openframe.data.repository.user;

import com.openframe.data.document.user.User;
import com.openframe.data.document.user.filter.UserQueryFilter;

import java.util.List;

public interface CustomUserRepository {

    List<User> findUsersBySearch(UserQueryFilter filter, int limit);

    /**
     * Users ordered by {@code (email, _id)}, starting after {@code cursor} (a {@link UserPageCursor}). The
     * search does not match the synthetic email of a self-deleted user.
     */
    List<User> findUsersPage(UserListFilter filter, String cursor, int limit);

    long countUsers(UserListFilter filter);
}
