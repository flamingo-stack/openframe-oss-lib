package com.openframe.graphql.node;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsFederationResolver;
import com.openframe.graphql.relay.RelayAutoConfiguration;
import com.openframe.graphql.relay.RelayIdCodec;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;

import java.util.List;

@AutoConfiguration(after = RelayAutoConfiguration.class)
@ConditionalOnClass(DgsComponent.class)
public class NodeAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public NodeLoaderRegistry nodeLoaderRegistry(ObjectProvider<NodeLoader<?>> loaders) {
        List<NodeLoader<?>> nodeLoaders = loaders.orderedStream().toList();
        return new NodeLoaderRegistry(nodeLoaders);
    }

    @Bean
    @ConditionalOnMissingBean
    public EntityStubDetector entityStubDetector() {
        return new EntityStubDetector();
    }

    @Bean
    @ConditionalOnMissingBean
    public RelayNodeFinder relayNodeFinder(RelayIdCodec relayIdCodec, NodeLoaderRegistry nodeLoaderRegistry,
                                           EntityStubDetector entityStubDetector) {
        return new RelayNodeFinder(relayIdCodec, nodeLoaderRegistry, entityStubDetector);
    }

    @Bean
    @ConditionalOnMissingBean
    public NodeEntityFinder nodeEntityFinder(RelayIdCodec relayIdCodec, NodeLoaderRegistry nodeLoaderRegistry) {
        return new NodeEntityFinder(relayIdCodec, nodeLoaderRegistry);
    }

    @Bean
    @ConditionalOnMissingBean
    public EntityCallerAuthorizer entityCallerAuthorizer() {
        return new SecurityContextEntityCallerAuthorizer();
    }

    @Bean
    @ConditionalOnMissingBean
    public NodeTypeResolver nodeTypeResolver(NodeLoaderRegistry nodeLoaderRegistry) {
        return new NodeTypeResolver(nodeLoaderRegistry);
    }

    @Bean
    @ConditionalOnMissingBean
    public NodeInterfaceWiring nodeInterfaceWiring(NodeTypeResolver nodeTypeResolver) {
        return new NodeInterfaceWiring(nodeTypeResolver);
    }

    @Bean
    @ConditionalOnMissingBean(DgsFederationResolver.class)
    public NodeFederationResolver nodeFederationResolver(NodeEntityFinder nodeEntityFinder,
                                                         EntityCallerAuthorizer entityCallerAuthorizer,
                                                         NodeTypeResolver nodeTypeResolver) {
        return new NodeFederationResolver(nodeEntityFinder, entityCallerAuthorizer, nodeTypeResolver);
    }
}
