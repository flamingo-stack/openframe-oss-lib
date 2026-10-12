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
        return toConnection(result,
                invitation -> InvitationPageCursor.of(invitation.getCreatedAt(), invitation.getId()));
    }

    private static <T> CountedGenericConnection<GenericEdge<T>> toConnection(
            CountedGenericQueryResult<T> result, Function<T, String> rawCursor) {
        return CountedGenericConnection.<GenericEdge<T>>builder()
                .edges(result.getItems().stream()
                        .map(item -> GenericEdge.<T>builder()
                                .node(item)
                                .cursor(CursorCodec.encode(rawCursor.apply(item)))
                                .build())
                        .toList())
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }
}
