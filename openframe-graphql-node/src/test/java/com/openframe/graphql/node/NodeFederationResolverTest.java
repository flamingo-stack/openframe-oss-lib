package com.openframe.graphql.node;

import graphql.TypeResolutionEnvironment;
import graphql.schema.GraphQLObjectType;
import graphql.schema.TypeResolver;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NodeFederationResolverTest {

    @Mock private NodeEntityFinder entityFinder;
    @Mock private EntityCallerAuthorizer callerAuthorizer;
    @Mock private NodeTypeResolver nodeTypeResolver;
    @Mock private TypeResolutionEnvironment environment;

    @InjectMocks private NodeFederationResolver resolver;

    @Test
    void typeResolver_entity_resolvedByTheNodeTypeResolver() {
        // setup
        GraphQLObjectType ticketType = GraphQLObjectType.newObject().name("Ticket").build();
        when(nodeTypeResolver.resolveObjectType(environment)).thenReturn(ticketType);
        TypeResolver typeResolver = resolver.typeResolver();

        // execution
        GraphQLObjectType resolved = typeResolver.getType(environment);

        // verifications
        assertThat(resolved).isSameAs(ticketType);
    }
}
