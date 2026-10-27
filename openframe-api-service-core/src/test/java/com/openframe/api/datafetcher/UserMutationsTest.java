package com.openframe.api.datafetcher;

import com.openframe.api.dto.invitation.InvitationIdInput;
import com.openframe.api.dto.invitation.InvitationResponse;
import com.openframe.api.dto.invitation.InviteUsersInput;
import com.openframe.api.dto.invitation.InviteUsersPayload;
import com.openframe.api.dto.invitation.ResendInvitationPayload;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.MutationError;
import com.openframe.api.dto.user.DeleteUserInput;
import com.openframe.api.dto.user.TransferOwnershipInput;
import com.openframe.api.dto.user.TransferOwnershipPayload;
import com.openframe.api.dto.user.UpdateUserInput;
import com.openframe.api.dto.user.UpdateUserRequest;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLUserMapper;
import com.openframe.api.service.user.InvitationService;
import com.openframe.api.service.user.InvitationService.InviteUsersResult;
import com.openframe.api.service.user.UserService;
import com.openframe.core.exception.UnauthorizedException;
import com.openframe.graphql.relay.InvalidRelayIdException;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.AuthPrincipal;
import com.openframe.security.authentication.ActorType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static com.openframe.graphql.relay.NodeType.INVITATION;
import static com.openframe.graphql.relay.NodeType.USER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/** The user and invitation mutations: Relay ids in and out, the principal, and the state after the change. */
@ExtendWith(MockitoExtension.class)
class UserMutationsTest {

    private static final RelayIdCodec CODEC = new RelayIdCodec();
    private static final AuthPrincipal ADMIN = AuthPrincipal.builder().id("me").actorType(ActorType.ADMIN).build();

    @Mock private UserService userService;
    @Mock private InvitationService invitationService;

    private UserDataFetcher users() {
        return new UserDataFetcher(userService, new GraphQLUserMapper(), CODEC);
    }

    private InvitationDataFetcher invitations() {
        return new InvitationDataFetcher(invitationService, new GraphQLUserMapper(), CODEC);
    }

    @Test
    @DisplayName("updateUser: the global id is decoded and the payload is the user the service returns")
    void updateUser() {
        UserResponse updated = UserResponse.builder().id("u-1").firstName("Jane").build();
        when(userService.updateUser(eq("u-1"), any())).thenReturn(updated);

        UserResponse user = users().updateUser(new UpdateUserInput(CODEC.encode(USER, "u-1"), "Jane", null)).getUser();

        ArgumentCaptor<UpdateUserRequest> request = ArgumentCaptor.forClass(UpdateUserRequest.class);
        verify(userService).updateUser(eq("u-1"), request.capture());
        assertThat(request.getValue().getFirstName()).isEqualTo("Jane");
        assertThat(request.getValue().getLastName()).isNull();
        assertThat(user).isSameAs(updated);
    }

    @Test
    @DisplayName("updateUser: an id of another type is refused before the service is called")
    void updateUserRefusesForeignId() {
        UpdateUserInput input = new UpdateUserInput(CODEC.encode(INVITATION, "inv-1"), "Jane", null);

        assertThatThrownBy(() -> users().updateUser(input)).isInstanceOf(InvalidRelayIdException.class);
        verifyNoInteractions(userService);
    }

    @Test
    @DisplayName("deleteUser: deletes as the caller and returns the user re-read after the delete")
    void deleteUser() {
        UserResponse deleted = UserResponse.builder().id("u-2").status("DELETED").build();
        when(userService.getUserById("u-2")).thenReturn(deleted);

        UserResponse user = users().deleteUser(new DeleteUserInput(CODEC.encode(USER, "u-2")), ADMIN).getUser();

        verify(userService).softDeleteUser("u-2", "me");
        assertThat(user).isSameAs(deleted);
    }

    @Test
    @DisplayName("deleteUser: an agent cannot delete users")
    void deleteUserRefusesAgents() {
        AuthPrincipal agent = AuthPrincipal.builder().id("machine-1").actorType(ActorType.AGENT).build();
        DeleteUserInput input = new DeleteUserInput(CODEC.encode(USER, "u-2"));

        assertThatThrownBy(() -> users().deleteUser(input, agent)).isInstanceOf(UnauthorizedException.class);
        verifyNoInteractions(userService);
    }

    @Test
    @DisplayName("transferOwnership: the caller hands over and both users come back as they are now")
    void transferOwnership() {
        UserResponse previous = UserResponse.builder().id("me").roles(List.of("ADMIN")).build();
        UserResponse next = UserResponse.builder().id("u-3").roles(List.of("OWNER", "ADMIN")).build();
        when(userService.getUserById("me")).thenReturn(previous);
        when(userService.getUserById("u-3")).thenReturn(next);

        TransferOwnershipPayload payload = users().transferOwnership(
                new TransferOwnershipInput(CODEC.encode(USER, "u-3")), ADMIN);

        verify(userService).transferOwnership("u-3", "me");
        assertThat(payload.getPreviousOwner()).isSameAs(previous);
        assertThat(payload.getNewOwner()).isSameAs(next);
    }

    @Test
    @DisplayName("revokeInvitation: takes a global or a raw id and answers with the global id")
    void revokeInvitation() {
        String globalId = CODEC.encode(INVITATION, "inv-1");

        assertThat(invitations().revokeInvitation(new InvitationIdInput(globalId)).getRevokedInvitationId())
                .isEqualTo(globalId);
        assertThat(invitations().revokeInvitation(new InvitationIdInput("inv-1")).getRevokedInvitationId())
                .isEqualTo(globalId);
        verify(invitationService, times(2)).revokeInvitation("inv-1");
    }

    @Test
    @DisplayName("resendInvitation: the replacement comes as an edge with its connection cursor, the old id as revoked")
    void resendInvitation() {
        Instant createdAt = Instant.ofEpochMilli(1_760_000_000_000L);
        InvitationResponse replacement = InvitationResponse.builder().id("inv-2").createdAt(createdAt).build();
        when(invitationService.renewInvitation("inv-1")).thenReturn(replacement);

        ResendInvitationPayload payload = invitations().resendInvitation(
                new InvitationIdInput(CODEC.encode(INVITATION, "inv-1")));

        assertThat(payload.getInvitationEdge().getNode()).isSameAs(replacement);
        assertThat(CursorCodec.decode(payload.getInvitationEdge().getCursor()))
                .isEqualTo(createdAt.toEpochMilli() + "_inv-2");
        assertThat(payload.getRevokedInvitationId()).isEqualTo(CODEC.encode(INVITATION, "inv-1"));
    }

    @Test
    @DisplayName("inviteUsers: every invitation sent becomes an edge, every refusal a userError")
    void inviteUsers() {
        InvitationResponse sent = InvitationResponse.builder().id("inv-3").createdAt(Instant.EPOCH).build();
        MutationError refused = MutationError.builder().field(List.of("emails", "1")).message("Invalid email format").build();
        when(invitationService.inviteUsers(List.of("a@acme.io", "nope")))
                .thenReturn(new InviteUsersResult(List.of(sent), List.of(refused)));

        InviteUsersPayload payload = invitations().inviteUsers(new InviteUsersInput(List.of("a@acme.io", "nope")));

        assertThat(payload.getInvitationEdges()).singleElement().satisfies(edge -> {
            assertThat(edge.getNode()).isSameAs(sent);
            assertThat(CursorCodec.decode(edge.getCursor())).isEqualTo("0_inv-3");
        });
        assertThat(payload.getUserErrors()).containsExactly(refused);
    }
}
