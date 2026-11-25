package com.openframe.gateway.config.error;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.http.codec.autoconfigure.CodecsAutoConfiguration;
import org.springframework.boot.test.context.runner.ReactiveWebApplicationContextRunner;
import org.springframework.boot.webflux.autoconfigure.WebFluxAutoConfiguration;
import org.springframework.boot.webflux.autoconfigure.error.ErrorWebFluxAutoConfiguration;
import org.springframework.boot.webflux.error.ErrorWebExceptionHandler;

import static org.assertj.core.api.Assertions.assertThat;

class GatewayErrorHandlingConfigTest {

    @Test
    void errorWebExceptionHandler_withBootAutoConfiguration_onlyThePathOnlyHandlerIsRegistered() {
        // setup
        AutoConfigurations autoConfigurations = AutoConfigurations.of(CodecsAutoConfiguration.class,
                WebFluxAutoConfiguration.class, ErrorWebFluxAutoConfiguration.class);
        ReactiveWebApplicationContextRunner runner = new ReactiveWebApplicationContextRunner()
                .withConfiguration(autoConfigurations)
                .withUserConfiguration(GatewayErrorHandlingConfig.class);

        // execution
        runner.run(context ->

                // verifications
                assertThat(context)
                        .hasNotFailed()
                        .hasSingleBean(ErrorWebExceptionHandler.class)
                        .getBean(ErrorWebExceptionHandler.class)
                        .isInstanceOf(PathOnlyErrorWebExceptionHandler.class));
    }
}
