package com.openframe.graphql.relay;

import com.netflix.graphql.dgs.DgsComponent;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@AutoConfiguration
public class RelayAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public RelayIdCodec relayIdCodec() {
        return new RelayIdCodec();
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnClass(DgsComponent.class)
    static class RelayNodeIdWiringConfiguration {

        @Bean
        @ConditionalOnMissingBean
        public RelayIdEncodingPolicy relayIdEncodingPolicy() {
            return new AlwaysEncodeRelayIds();
        }

        @Bean
        @ConditionalOnMissingBean
        public RelayNodeIdWiring relayNodeIdWiring(RelayIdCodec relayIdCodec, RelayIdEncodingPolicy encodingPolicy) {
            return new RelayNodeIdWiring(relayIdCodec, encodingPolicy);
        }
    }
}
