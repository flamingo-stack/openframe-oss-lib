package com.openframe.api.mapper;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.invitation.InvitationResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.data.repository.user.InvitationPageCursor;
import com.openframe.data.repository.user.UserPageCursor;
import org.springframework.stereotype.Component;

import java.util.function.Function;

@Component
public class GraphQLUserMapper {

    public CountedGenericConnection<GenericEdge<UserResponse>> toUserConnection(
            CountedGenericQueryResult<UserResponse> result) {
        return toConnection(result, user -> UserPageCursor.of(user.getEmail(), user.getId()));
    }

    public CountedGenericConnection<GenericEdge<InvitationResponse>> toInvitationConnection(
            CountedGenericQueryResult<InvitationResponse> result) {
        return toConnection(result, GraphQLUserMapper::invitationCursor);
    }

    /** An edge for a mutation payload, with the cursor the connection would give it. */
    public GenericEdge<InvitationResponse> toInvitationEdge(InvitationResponse invitation) {
        return edge(invitation, GraphQLUserMapper::invitationCursor);
    }

    private static String invitationCursor(InvitationResponse invitation) {
        return InvitationPageCursor.of(invitation.getCreatedAt(), invitation.getId());
    }

    private static <T> CountedGenericConnection<GenericEdge<T>> toConnection(
            CountedGenericQueryResult<T> result, Function<T, String> rawCursor) {
        return CountedGenericConnection.<GenericEdge<T>>builder()
                .edges(result.getItems().stream().map(item -> edge(item, rawCursor)).toList())
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }

    private static <T> GenericEdge<T> edge(T item, Function<T, String> rawCursor) {
        return GenericEdge.<T>builder()
                .node(item)
                .cursor(CursorCodec.encode(rawCursor.apply(item)))
                .build();
    }
}
