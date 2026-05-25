package com.openframe.data.repository.user;

import com.openframe.data.document.user.User;
import com.openframe.data.document.user.filter.UserQueryFilter;

import java.util.List;

public interface CustomUserRepository {

    List<User> findUsersBySearch(UserQueryFilter filter, int limit);
}
