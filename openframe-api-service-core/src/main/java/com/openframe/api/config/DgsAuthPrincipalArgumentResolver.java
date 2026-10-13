package com.openframe.api.config;

import com.netflix.graphql.dgs.internal.method.ArgumentResolver;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.schema.DataFetchingEnvironment;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

// Resolves @AuthenticationPrincipal AuthPrincipal for DGS data fetchers, mirroring the MVC resolver.
@Component
public class DgsAuthPrincipalArgumentResolver implements ArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(AuthenticationPrincipal.class)
                && AuthPrincipal.class.isAssignableFrom(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, DataFetchingEnvironment dfe) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication instanceof JwtAuthenticationToken jwtAuth) {
            return AuthPrincipal.fromJwt(jwtAuth.getToken());
        }
        return null;
    }
}
