package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.graphql.node.RelayNodeFinder;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.schema.DataFetchingEnvironment;
import graphql.schema.GraphQLSchema;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;
import java.util.Optional;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
public class NodeDataFetcher {

    private final RelayNodeFinder nodeFinder;

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
        return ids.stream()
                .map(id -> findNodeOrNull(principal, id, schema))
                .toList();
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
