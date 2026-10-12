package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
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
import com.openframe.data.document.user.User;
import graphql.relay.Relay;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class UserDataFetcher {

    private static final Relay RELAY = new Relay();

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

    // Fields typed User resolve to a UserResponse; the node resolver also admits the User document.
    @DgsData(parentType = "User", field = "id")
    public String userNodeId(DgsDataFetchingEnvironment dfe) {
        Object source = dfe.getSource();
        String rawId = source instanceof UserResponse response ? response.getId() : ((User) source).getId();
        return RELAY.toGlobalId("User", rawId);
    }
}
