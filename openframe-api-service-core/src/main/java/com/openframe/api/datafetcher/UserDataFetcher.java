package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.user.UserFilterInput;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLUserMapper;
import com.openframe.api.service.user.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class UserDataFetcher {

    private final UserService userService;
    private final GraphQLUserMapper mapper;

    @DgsQuery
    public CountedGenericConnection<GenericEdge<UserResponse>> users(
            @InputArgument UserFilterInput filter,
            @InputArgument String search,
            @InputArgument Integer first,
            @InputArgument String after) {
        log.debug("Fetching users: filter={}, search={}, first={}, after={}", filter, search, first, after);
        CursorPaginationCriteria pagination = CursorPaginationCriteria.fromConnectionArgs(
                ConnectionArgs.builder().first(first).after(after).build());
        return mapper.toUserConnection(userService.queryUsers(filter, search, pagination));
    }
}
