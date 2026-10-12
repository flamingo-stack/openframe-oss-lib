package com.openframe.api.datafetcher;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.invitation.InvitationResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.mapper.GraphQLUserMapper;
import com.openframe.api.service.InstalledAgentService;
import com.openframe.api.service.TagService;
import com.openframe.api.service.ToolConnectionService;
import com.openframe.api.service.ToolService;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.rmm.schedule.ScheduleRunService;
import com.openframe.api.service.rmm.schedule.ScheduleScriptService;
import com.openframe.api.service.rmm.script.ScriptExecutionService;
import com.openframe.api.service.rmm.script.ScriptService;
import com.openframe.api.service.user.InvitationService;
import com.openframe.api.service.user.UserService;
import com.openframe.data.service.OrganizationService;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Users and invitations as Relay nodes: node(id:) refetch and opaque edge cursors. */
@ExtendWith(MockitoExtension.class)
class UserNodeTest {

    private static final RelayIdCodec CODEC = new RelayIdCodec();

    @Mock private UserService userService;
    @Mock private InvitationService invitationService;

    @Test
    @DisplayName("node(User) resolves the user by the raw id inside the global id")
    void userNodeResolvesByRawId() {
        UserResponse user = UserResponse.builder().id("u-1").email("jane@acme.io").build();
        when(userService.findUserById("u-1")).thenReturn(Optional.of(user));

        assertThat(nodeFetcher().node(CODEC.encode(NodeType.USER, "u-1"))).isSameAs(user);
    }

    @Test
    @DisplayName("node(Invitation) resolves only an open invitation")
    void invitationNodeResolvesOpenInvitationsOnly() {
        InvitationResponse invitation = InvitationResponse.builder().id("inv-1").build();
        when(invitationService.findOpenInvitation("inv-1")).thenReturn(Optional.of(invitation));
        when(invitationService.findOpenInvitation("inv-revoked")).thenReturn(Optional.empty());

        assertThat(nodeFetcher().node(CODEC.encode(NodeType.INVITATION, "inv-1"))).isSameAs(invitation);
        assertThat(nodeFetcher().node(CODEC.encode(NodeType.INVITATION, "inv-revoked"))).isNull();
    }

    @Test
    @DisplayName("users(): the after cursor is decoded for the service, and every edge carries an opaque cursor")
    void usersConnection() {
        UserResponse user = UserResponse.builder().id("u-2").email("jane_doe@acme.io").build();
        when(userService.queryUsers(isNull(), eq("jane"), any())).thenReturn(CountedGenericQueryResult.<UserResponse>builder()
                .items(List.of(user))
                .pageInfo(PageInfo.builder().build())
                .filteredCount(1)
                .build());

        CountedGenericConnection<GenericEdge<UserResponse>> connection = new UserDataFetcher(
                userService, new GraphQLUserMapper(), CODEC).users(null, "jane", 10, CursorCodec.encode("a@acme.io_u-1"));

        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        verify(userService).queryUsers(isNull(), eq("jane"), pagination.capture());
        assertThat(pagination.getValue().getLimit()).isEqualTo(10);
        assertThat(pagination.getValue().getCursor()).isEqualTo("a@acme.io_u-1");
        assertThat(connection.getEdges()).singleElement().satisfies(edge -> {
            assertThat(edge.getNode()).isSameAs(user);
            assertThat(CursorCodec.decode(edge.getCursor())).isEqualTo("jane_doe@acme.io_u-2");
        });
        assertThat(connection.getFilteredCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("invitations(): every edge carries an opaque (createdAt, id) cursor")
    void invitationsConnection() {
        Instant createdAt = Instant.ofEpochMilli(1_750_000_000_000L);
        InvitationResponse invitation = InvitationResponse.builder().id("inv-1").createdAt(createdAt).build();
        when(invitationService.queryInvitations(isNull(), isNull(), any()))
                .thenReturn(CountedGenericQueryResult.<InvitationResponse>builder()
                        .items(List.of(invitation))
                        .pageInfo(PageInfo.builder().build())
                        .build());

        CountedGenericConnection<GenericEdge<InvitationResponse>> connection = new InvitationDataFetcher(
                invitationService, new GraphQLUserMapper(), CODEC).invitations(null, null, null, null);

        assertThat(CursorCodec.decode(connection.getEdges().getFirst().getCursor()))
                .isEqualTo(createdAt.toEpochMilli() + "_inv-1");
    }

    private NodeDataFetcher nodeFetcher() {
        return new NodeDataFetcher(mock(DeviceService.class), mock(OrganizationService.class), mock(ToolService.class),
                mock(TagService.class), mock(ToolConnectionService.class), mock(InstalledAgentService.class),
                mock(ScriptService.class), mock(ScriptExecutionService.class), mock(ScheduleScriptService.class),
                mock(ScheduleRunService.class), userService, invitationService,
                emptyProvider(), emptyProvider(), CODEC);
    }

    @SuppressWarnings("unchecked")
    private static <T> ObjectProvider<T> emptyProvider() {
        return mock(ObjectProvider.class);
    }
}
