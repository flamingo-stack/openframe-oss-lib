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

/**
 * DGS argument resolver that lets data fetchers declare {@code @AuthenticationPrincipal AuthPrincipal}
 * exactly like the REST controllers do (e.g. {@code /me}).
 * <p>
 * The MVC {@code AuthPrincipalArgumentResolver} in openframe-security-core only covers Spring MVC
 * controllers; the DGS/graphql invocation path needs its own resolver. This mirrors that logic:
 * the request principal is a JWT, converted to {@link AuthPrincipal}. Resolves to {@code null} for
 * unauthenticated (or non-JWT) requests, so fetchers can guard as needed.
 */
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
