package com.openframe.api.support;

import com.openframe.api.support.client.InternalDomainValidationHttpClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.support.RestClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

@Configuration
public class InternalClientsConfig {

    @Bean
    public InternalDomainValidationHttpClient internalDomainValidationHttpClient(
            @Value("${openframe.shared.internal-api.base-url}") String baseUrl
    ) {
        RestClient restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .build();
        RestClientAdapter adapter = RestClientAdapter.create(restClient);
        HttpServiceProxyFactory factory = HttpServiceProxyFactory.builderFor(adapter).build();
        return factory.createClient(InternalDomainValidationHttpClient.class);
    }
}
