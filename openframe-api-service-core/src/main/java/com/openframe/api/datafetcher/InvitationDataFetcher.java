package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.invitation.InvitationFilterInput;
import com.openframe.api.dto.invitation.InvitationFilters;
import com.openframe.api.dto.invitation.InvitationIdInput;
import com.openframe.api.dto.invitation.InvitationResponse;
import com.openframe.api.dto.invitation.InviteUsersInput;
import com.openframe.api.dto.invitation.InviteUsersPayload;
import com.openframe.api.dto.invitation.ResendInvitationPayload;
import com.openframe.api.dto.invitation.RevokeInvitationPayload;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.GraphQLUserMapper;
import com.openframe.api.service.user.InvitationService;
import com.openframe.api.service.user.InvitationService.InviteUsersResult;
import com.openframe.graphql.relay.RelayIdCodec;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

import static com.openframe.graphql.relay.NodeType.INVITATION;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class InvitationDataFetcher {

    /** A search is a few words typed into a box; anything longer is not one. */
    private static final int MAX_SEARCH_LENGTH = 200;

    private final InvitationService invitationService;
    private final GraphQLUserMapper mapper;
    private final RelayIdCodec relayIdCodec;

    @DgsQuery
    public CountedGenericConnection<GenericEdge<InvitationResponse>> invitations(
            @InputArgument InvitationFilterInput filter,
            @InputArgument @Size(max = MAX_SEARCH_LENGTH) String search,
            @InputArgument Integer first,
            @InputArgument String after) {
        log.debug("Fetching invitations: filter={}, search={}, first={}, after={}", filter, search, first, after);
        CursorPaginationCriteria pagination = CursorPaginationCriteria.fromConnectionArgs(
                ConnectionArgs.builder().first(first).after(after).build());
        return mapper.toInvitationConnection(invitationService.queryInvitations(filter, search, pagination));
    }

    @DgsQuery
    public InvitationFilters invitationFilters(@InputArgument InvitationFilterInput filter,
                                               @InputArgument @Size(max = MAX_SEARCH_LENGTH) String search) {
        return invitationService.invitationFilters(filter, search);
    }

    @DgsMutation
    public InviteUsersPayload inviteUsers(@InputArgument @Valid InviteUsersInput input) {
        InviteUsersResult result = invitationService.inviteUsers(input.getEmails());
        return InviteUsersPayload.builder()
                .invitationEdges(result.invitations().stream().map(mapper::toInvitationEdge).toList())
                .userErrors(result.errors())
                .build();
    }

    @DgsMutation
    public RevokeInvitationPayload revokeInvitation(@InputArgument @Valid InvitationIdInput input) {
        String id = relayIdCodec.decode(input.getId(), INVITATION);
        invitationService.revokeInvitation(id);
        return new RevokeInvitationPayload(relayIdCodec.encode(INVITATION, id));
    }

    @DgsMutation
    public ResendInvitationPayload resendInvitation(@InputArgument @Valid InvitationIdInput input) {
        String id = relayIdCodec.decode(input.getId(), INVITATION);
        InvitationResponse created = invitationService.renewInvitation(id);
        return new ResendInvitationPayload(mapper.toInvitationEdge(created), relayIdCodec.encode(INVITATION, id));
    }
}
