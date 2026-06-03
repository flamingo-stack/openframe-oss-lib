package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.script.CreateScriptInput;
import com.openframe.api.dto.script.ScriptFilterInput;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.script.UpdateScriptInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLScriptMapper;
import com.openframe.api.service.rmm.ScriptService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

/**
 * GraphQL resolver for RMM script CRUD.
 *
 * <p>Pure passthrough to {@link ScriptService} — tenant scoping is resolved
 * inside the service via {@code TenantIdProvider}. Authorisation (which roles
 * may invoke which mutation) is intentionally not enforced here yet — it will
 * be added in a dedicated security pass once the RMM role model is agreed.
 */
@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class ScriptDataFetcher {

    private final ScriptService scriptService;
    private final GraphQLScriptMapper scriptMapper;

    @DgsQuery
    public ScriptResponse script(@InputArgument @NotBlank String id) {
        return scriptService.get(id);
    }

    @DgsQuery
    public GenericConnection<GenericEdge<ScriptResponse>> scripts(
            @InputArgument @Valid ScriptFilterInput filter,
            @InputArgument String search,
            @InputArgument @Valid SortInput sort,
            @InputArgument Integer first,
            @InputArgument String after,
            @InputArgument Integer last,
            @InputArgument String before) {

        ConnectionArgs args = ConnectionArgs.builder()
                .first(first).after(after).last(last).before(before)
                .build();
        CursorPaginationCriteria pagination = scriptMapper.toCursorPaginationCriteria(args);
        GenericQueryResult<ScriptResponse> result =
                scriptService.list(filter, search, sort, pagination);
        return scriptMapper.toConnection(result);
    }

    @DgsMutation
    public ScriptResponse createScript(@InputArgument @Valid CreateScriptInput input) {
        return scriptService.create(input);
    }

    @DgsMutation
    public ScriptResponse updateScript(
            @InputArgument @NotBlank String id,
            @InputArgument @Valid UpdateScriptInput input) {
        return scriptService.update(id, input);
    }

    @DgsMutation
    public boolean deleteScript(@InputArgument @NotBlank String id) {
        scriptService.delete(id);
        return true;
    }
}
