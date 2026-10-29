package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.api.service.user.UserService;
import com.openframe.graphql.node.RelayNodeFinder;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.ParsedRelayId;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.schema.DataFetchingEnvironment;
import graphql.schema.GraphQLSchema;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class NodeDataFetcher {

    private final RelayNodeFinder nodeFinder;
    private final UserService userService;
    private final RelayIdCodec relayIdCodec;

    @DgsQuery
    public Object node(@InputArgument String id, @AuthenticationPrincipal AuthPrincipal principal,
                       DataFetchingEnvironment environment) {
        log.debug("Resolving node with global ID: {}", id);
        GraphQLSchema schema = environment.getGraphQLSchema();
        Optional<Object> node = nodeFinder.findNode(principal, id, schema);
        return node.orElse(null);
    }

    @DgsQuery
    public List<Object> nodes(@InputArgument List<String> ids, @AuthenticationPrincipal AuthPrincipal principal,
                              DataFetchingEnvironment environment) {
        log.debug("Resolving {} nodes", ids.size());
        GraphQLSchema schema = environment.getGraphQLSchema();
        Map<String, UserResponse> users = loadUsers(ids);
        return ids.stream()
                .map(id -> users.containsKey(id) ? users.get(id) : findNodeOrNull(principal, id, schema))
                .toList();
    }

    /**
     * The users among the ids in one query, keyed by global id: a client asks for many at once (the status of
     * every user a page shows), and the user loader costs a query and an avatar lookup per id. An id this does
     * not find goes through the loader like any other.
     */
    private Map<String, UserResponse> loadUsers(List<String> ids) {
        List<String> userIds = ids.stream()
                .map(relayIdCodec::parse)
                .flatMap(Optional::stream)
                .filter(globalId -> globalId.isOfType(NodeType.USER))
                .map(ParsedRelayId::getRawId)
                .distinct()
                .toList();
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return userService.getUsersByIds(userIds).stream()
                .collect(Collectors.toMap(user -> relayIdCodec.encode(NodeType.USER, user.getId()),
                        Function.identity(), (first, second) -> first));
    }

    // One unresolvable id answers null in its slot instead of failing the whole list.
    private Object findNodeOrNull(AuthPrincipal principal, String id, GraphQLSchema schema) {
        try {
            Optional<Object> node = nodeFinder.findNode(principal, id, schema);
            return node.orElse(null);
        } catch (RuntimeException e) {
            log.warn("Failed to resolve node: {}", id, e);
            return null;
        }
    }
}
