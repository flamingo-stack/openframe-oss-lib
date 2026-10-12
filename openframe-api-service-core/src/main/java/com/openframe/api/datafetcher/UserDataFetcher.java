package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.user.DeleteUserInput;
import com.openframe.api.dto.user.TransferOwnershipInput;
import com.openframe.api.dto.user.TransferOwnershipPayload;
import com.openframe.api.dto.user.UpdateUserInput;
import com.openframe.api.dto.user.UpdateUserRequest;
import com.openframe.api.dto.user.UserFilterInput;
import com.openframe.api.dto.user.UserPayload;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLUserMapper;
import com.openframe.api.service.user.UserService;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;

import static com.openframe.api.support.CurrentPrincipalSupport.requireHumanUserId;
import static com.openframe.graphql.relay.NodeType.USER;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class UserDataFetcher {

    /** A search is a few words typed into a box; anything longer is not one. */
    private static final int MAX_SEARCH_LENGTH = 200;

    private final UserService userService;
    private final GraphQLUserMapper mapper;
    private final RelayIdCodec relayIdCodec;

    @DgsQuery
    public CountedGenericConnection<GenericEdge<UserResponse>> users(
            @InputArgument UserFilterInput filter,
            @InputArgument @Size(max = MAX_SEARCH_LENGTH) String search,
            @InputArgument Integer first,
            @InputArgument String after) {
        log.debug("Fetching users: filter={}, search={}, first={}, after={}", filter, search, first, after);
        CursorPaginationCriteria pagination = CursorPaginationCriteria.fromConnectionArgs(
                ConnectionArgs.builder().first(first).after(after).build());
        return mapper.toUserConnection(userService.queryUsers(withRawIds(filter), search, pagination));
    }

    private UserFilterInput withRawIds(UserFilterInput filter) {
        if (filter == null || filter.getExcludeIds() == null) {
            return filter;
        }
        return UserFilterInput.builder()
                .statuses(filter.getStatuses())
                .excludeIds(relayIdCodec.decodeAll(filter.getExcludeIds(), USER))
                .build();
    }

    @DgsMutation
    public UserPayload updateUser(@InputArgument @Valid UpdateUserInput input) {
        String id = relayIdCodec.decode(input.getId(), USER);
        UpdateUserRequest request = new UpdateUserRequest();
        request.setFirstName(input.getFirstName());
        request.setLastName(input.getLastName());
        return new UserPayload(userService.updateUser(id, request));
    }

    @DgsMutation
    public UserPayload deleteUser(@InputArgument @Valid DeleteUserInput input,
                                  @AuthenticationPrincipal AuthPrincipal principal) {
        String id = relayIdCodec.decode(input.getId(), USER);
        userService.softDeleteUser(id, requireHumanUserId(principal));
        return new UserPayload(userService.getUserById(id));
    }

    @DgsMutation
    public TransferOwnershipPayload transferOwnership(@InputArgument @Valid TransferOwnershipInput input,
                                                      @AuthenticationPrincipal AuthPrincipal principal) {
        String requesterId = requireHumanUserId(principal);
        String newOwnerId = relayIdCodec.decode(input.getNewOwnerId(), USER);
        userService.transferOwnership(newOwnerId, requesterId);
        return new TransferOwnershipPayload(userService.getUserById(requesterId), userService.getUserById(newOwnerId));
    }
}
