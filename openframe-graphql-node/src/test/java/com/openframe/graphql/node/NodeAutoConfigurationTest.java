package com.openframe.graphql.node;

import com.netflix.graphql.dgs.DgsFederationResolver;
import com.netflix.graphql.dgs.internal.EntityFetcherRegistry;
import com.openframe.graphql.relay.RelayAutoConfiguration;
import graphql.schema.TypeResolver;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class NodeAutoConfigurationTest {

    @Mock private EntityCallerAuthorizer customAuthorizer;
    @Mock private DgsFederationResolver customFederationResolver;

    @Test
    void context_noServiceBeans_securityContextCallerAuthorizerIsTheDefault() {
        // setup
        ApplicationContextRunner contextRunner = nodeRunner();

        // execution
        contextRunner.run(context -> {
            // verifications
            assertThat(context).hasNotFailed();
            assertThat(context).getBean(EntityCallerAuthorizer.class)
                    .isInstanceOf(SecurityContextEntityCallerAuthorizer.class);
        });
    }

    @Test
    void context_noServiceBeans_nodeFederationResolverWithoutAnyTypeResolverBean() {
        // setup
        ApplicationContextRunner contextRunner = nodeRunner();

        // execution
        contextRunner.run(context -> {
            // verifications
            assertThat(context)
                    .hasNotFailed()
                    .hasSingleBean(NodeFederationResolver.class)
                    .hasSingleBean(DgsFederationResolver.class)
                    .doesNotHaveBean(TypeResolver.class);
        });
    }

    @Test
    void context_userDefinedCallerAuthorizer_replacesTheDefault() {
        // setup
        ApplicationContextRunner contextRunner = nodeRunner()
                .withBean(EntityCallerAuthorizer.class, () -> customAuthorizer);

        // execution
        contextRunner.run(context -> {
            // verifications
            assertThat(context).hasNotFailed();
            assertThat(context).hasSingleBean(EntityCallerAuthorizer.class);
            assertThat(context).getBean(EntityCallerAuthorizer.class).isSameAs(customAuthorizer);
        });
    }

    @Test
    void context_userDefinedFederationResolver_nodeFederationResolverBacksOff() {
        // setup
        ApplicationContextRunner contextRunner = nodeRunner()
                .withBean(DgsFederationResolver.class, () -> customFederationResolver);

        // execution
        contextRunner.run(context -> {
            // verifications
            assertThat(context).hasNotFailed();
            assertThat(context).doesNotHaveBean(NodeFederationResolver.class);
            assertThat(context).getBean(DgsFederationResolver.class).isSameAs(customFederationResolver);
        });
    }

    // DefaultDgsFederationResolver, the base of NodeFederationResolver, autowires the DGS entity fetcher registry.
    private static ApplicationContextRunner nodeRunner() {
        return new ApplicationContextRunner()
                .withConfiguration(AutoConfigurations.of(RelayAutoConfiguration.class, NodeAutoConfiguration.class))
                .withBean(EntityFetcherRegistry.class);
    }
}
