package com.openframe.external.web;

import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class ExternalApiWebConfigTest {

    private final ExternalApiWebConfig config = new ExternalApiWebConfig();

    @Test
    void registersTheApiCallerResolver() {
        List<HandlerMethodArgumentResolver> resolvers = new ArrayList<>();

        config.addArgumentResolvers(resolvers);

        assertEquals(1, resolvers.size());
        assertInstanceOf(ApiCallerArgumentResolver.class, resolvers.get(0));
    }

    @Test
    void keepsResolversRegisteredByOthers() {
        HandlerMethodArgumentResolver existing = mock(HandlerMethodArgumentResolver.class);
        List<HandlerMethodArgumentResolver> resolvers = new ArrayList<>(List.of(existing));

        config.addArgumentResolvers(resolvers);

        assertEquals(2, resolvers.size());
        assertSame(existing, resolvers.get(0));
        assertInstanceOf(ApiCallerArgumentResolver.class, resolvers.get(1));
    }

    @Test
    void isPickedUpAsAWebMvcConfiguration() {
        assertTrue(ExternalApiWebConfig.class.isAnnotationPresent(Configuration.class));
        assertInstanceOf(WebMvcConfigurer.class, config);
    }
}
