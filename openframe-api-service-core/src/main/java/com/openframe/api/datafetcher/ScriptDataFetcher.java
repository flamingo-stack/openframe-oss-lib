package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.script.CreateScriptInput;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.script.UpdateScriptInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.ScriptMapper;
import com.openframe.api.service.rmm.ScriptService;
import com.openframe.core.exception.UnauthorizedException;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.validation.annotation.Validated;

/**
 * GraphQL resolver for RMM script CRUD.
 *
 * <p>Tenant scoping is enforced at this boundary: every operation extracts
 * {@code tenantId} from the authenticated JWT and passes it explicitly to
 * {@link ScriptService}. The service itself never touches the security
 * context, which keeps it trivially unit-testable.
 *
 * <p>Authorisation (which roles may invoke which mutation) is intentionally
 * not enforced here yet — it will be added in a dedicated security pass once
 * the RMM role model is agreed.
 */
@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class ScriptDataFetcher {

    private final ScriptService scriptService;
    private final ScriptMapper scriptMapper;

    @DgsQuery
    public ScriptResponse script(@InputArgument @NotBlank String id) {
        return scriptService.get(currentTenantId(), id);
    }

    @DgsQuery
    public GenericConnection<GenericEdge<ScriptResponse>> scripts(
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before) {

        ConnectionArgs args = ConnectionArgs.builder()
                .first(first).after(after).last(last).before(before)
                .build();
        CursorPaginationCriteria pagination = scriptMapper.toCursorPaginationCriteria(args);
        GenericQueryResult<ScriptResponse> result = scriptService.list(currentTenantId(), pagination);
        return scriptMapper.toConnection(result);
    }

    @DgsMutation
    public ScriptResponse createScript(@InputArgument @Valid CreateScriptInput input) {
        return scriptService.create(currentTenantId(), input);
    }

    @DgsMutation
    public ScriptResponse updateScript(
            @InputArgument @NotBlank String id,
            @InputArgument @Valid UpdateScriptInput input) {
        return scriptService.update(currentTenantId(), id, input);
    }

    @DgsMutation
    public boolean deleteScript(@InputArgument @NotBlank String id) {
        scriptService.delete(currentTenantId(), id);
        return true;
    }

    /**
     * Extract the tenant id from the current authenticated JWT principal.
     * Mirrors the pattern used in {@code NotificationDataFetcher}.
     */
    private String currentTenantId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken jwtAuth) {
            AuthPrincipal principal = AuthPrincipal.fromJwt(jwtAuth.getToken());
            String tenantId = principal.getTenantId();
            if (tenantId == null || tenantId.isBlank()) {
                throw new UnauthorizedException(
                        "Authenticated principal is missing tenant id");
            }
            return tenantId;
        }
        throw new UnauthorizedException(
                "Script operations require a JWT-authenticated principal; got "
                        + (auth == null ? "no authentication" : auth.getClass().getSimpleName()));
    }
}
