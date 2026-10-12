package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.invitation.InvitationFilterInput;
import com.openframe.api.dto.invitation.InvitationResponse;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.GraphQLUserMapper;
import com.openframe.api.service.user.InvitationService;
import graphql.relay.Relay;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class InvitationDataFetcher {

    private static final Relay RELAY = new Relay();

    private final InvitationService invitationService;
    private final GraphQLUserMapper mapper;

    @DgsQuery
    public CountedGenericConnection<GenericEdge<InvitationResponse>> invitations(
            @InputArgument InvitationFilterInput filter,
            @InputArgument String search,
            @InputArgument Integer first,
            @InputArgument String after) {
        log.debug("Fetching invitations: filter={}, search={}, first={}, after={}", filter, search, first, after);
        CursorPaginationCriteria pagination = CursorPaginationCriteria.fromConnectionArgs(
                ConnectionArgs.builder().first(first).after(after).build());
        return mapper.toInvitationConnection(invitationService.queryInvitations(filter, search, pagination));
    }

    @DgsData(parentType = "Invitation", field = "id")
    public String invitationNodeId(DgsDataFetchingEnvironment dfe) {
        InvitationResponse invitation = dfe.getSource();
        return RELAY.toGlobalId("Invitation", invitation.getId());
    }
}
