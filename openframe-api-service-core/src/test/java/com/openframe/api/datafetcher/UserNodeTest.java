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
import com.openframe.api.service.user.InvitationService;
import com.openframe.api.service.user.UserService;
import com.openframe.graphql.node.RelayNodeFinder;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import graphql.schema.DataFetchingEnvironment;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

/** Users and invitations as Relay nodes: batched nodes(ids:) and opaque edge cursors. */
@ExtendWith(MockitoExtension.class)
class UserNodeTest {

    private static final RelayIdCodec CODEC = new RelayIdCodec();

    @Mock private UserService userService;
    @Mock private InvitationService invitationService;
    @Mock private RelayNodeFinder nodeFinder;

    @Test
    @DisplayName("nodes(ids:) loads every user in one query, in input order; an id it misses goes through the finder")
    void nodesBatchesUsers() {
        UserResponse jane = UserResponse.builder().id("u-1").email("jane@acme.io").build();
        UserResponse john = UserResponse.builder().id("u-2").email("john@acme.io").build();
        when(userService.getUsersByIds(List.of("u-2", "u-1", "u-gone"))).thenReturn(List.of(jane, john));
        String gone = CODEC.encode(NodeType.USER, "u-gone");
        DataFetchingEnvironment environment = mock(DataFetchingEnvironment.class);

        List<Object> nodes = new NodeDataFetcher(nodeFinder, userService, CODEC).nodes(List.of(
                CODEC.encode(NodeType.USER, "u-2"),
                CODEC.encode(NodeType.USER, "u-1"),
                gone,
                CODEC.encode(NodeType.USER, "u-2")), null, environment);

        assertThat(nodes).containsExactly(john, jane, null, john);
        verify(nodeFinder).findNode(null, gone, null);
        verifyNoMoreInteractions(nodeFinder);
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
                userService, new GraphQLUserMapper(), CODEC).users(null, "jane", 10, CursorCodec.encode("a@acme.io_u-1"), null, null);

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
                invitationService, new GraphQLUserMapper(), CODEC).invitations(null, null, null, null, null, null);

        assertThat(CursorCodec.decode(connection.getEdges().getFirst().getCursor()))
                .isEqualTo(createdAt.toEpochMilli() + "_inv-1");
    }

    @Test
    void users_lastAndBeforeNextToFirstAndAfter_backwardPageBeforeTheDecodedCursorReachesTheService() {
        // setup
        String after = CursorCodec.encode("a@acme.io_u-1");
        String before = CursorCodec.encode("c@acme.io_u-3");
        CursorPaginationCriteria backwardPage = CursorPaginationCriteria.builder()
                .limit(5)
                .cursor("c@acme.io_u-3")
                .backward(true)
                .build();
        CountedGenericQueryResult<UserResponse> noUsers = CountedGenericQueryResult.<UserResponse>builder()
                .items(List.of())
                .pageInfo(PageInfo.builder().build())
                .build();
        UserDataFetcher dataFetcher = new UserDataFetcher(userService, new GraphQLUserMapper(), CODEC);
        when(userService.queryUsers(null, null, backwardPage)).thenReturn(noUsers);

        // execution
        CountedGenericConnection<GenericEdge<UserResponse>> connection =
                dataFetcher.users(null, null, 10, after, 5, before);

        // verifications
        verify(userService).queryUsers(null, null, backwardPage);
        assertThat(connection.getPageInfo()).isSameAs(noUsers.getPageInfo());
    }

    @Test
    void invitations_lastAndBeforeNextToFirstAndAfter_backwardPageBeforeTheDecodedCursorReachesTheService() {
        // setup
        String after = CursorCodec.encode("1750000000000_inv-9");
        String before = CursorCodec.encode("1750000000000_inv-3");
        CursorPaginationCriteria backwardPage = CursorPaginationCriteria.builder()
                .limit(5)
                .cursor("1750000000000_inv-3")
                .backward(true)
                .build();
        CountedGenericQueryResult<InvitationResponse> noInvitations =
                CountedGenericQueryResult.<InvitationResponse>builder()
                        .items(List.of())
                        .pageInfo(PageInfo.builder().build())
                        .build();
        InvitationDataFetcher dataFetcher = new InvitationDataFetcher(invitationService, new GraphQLUserMapper(), CODEC);
        when(invitationService.queryInvitations(null, null, backwardPage)).thenReturn(noInvitations);

        // execution
        CountedGenericConnection<GenericEdge<InvitationResponse>> connection =
                dataFetcher.invitations(null, null, 10, after, 5, before);

        // verifications
        verify(invitationService).queryInvitations(null, null, backwardPage);
        assertThat(connection.getPageInfo()).isSameAs(noInvitations.getPageInfo());
    }

    @Test
    void users_lastWithoutBefore_backwardPageWithoutACursorReachesTheService() {
        // setup
        CursorPaginationCriteria lastPage = CursorPaginationCriteria.builder().limit(5).backward(true).build();
        CountedGenericQueryResult<UserResponse> noUsers = CountedGenericQueryResult.<UserResponse>builder()
                .items(List.of())
                .pageInfo(PageInfo.builder().build())
                .build();
        UserDataFetcher dataFetcher = new UserDataFetcher(userService, new GraphQLUserMapper(), CODEC);
        when(userService.queryUsers(null, null, lastPage)).thenReturn(noUsers);

        // execution
        dataFetcher.users(null, null, null, null, 5, null);

        // verifications
        verify(userService).queryUsers(null, null, lastPage);
    }
}
