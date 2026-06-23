package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.data.document.tag.Tag;
import org.dataloader.DataLoader;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.dto.script.BatchRunScriptInput;
import com.openframe.api.dto.script.CreateScriptInput;
import com.openframe.api.dto.script.RunScriptInput;
import com.openframe.api.dto.script.ScriptFilterInput;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.script.UpdateScriptInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLScriptMapper;
import com.openframe.api.service.rmm.ScriptDispatchService;
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
    private final ScriptDispatchService scriptDispatchService;
    private final GraphQLScriptMapper scriptMapper;

    @DgsQuery
    public ScriptResponse script(@InputArgument @NotBlank String id) {
        return scriptService.get(id);
    }

    @DgsQuery
    public CountedGenericConnection<GenericEdge<ScriptResponse>> scripts(
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
        CountedGenericQueryResult<ScriptResponse> result =
                scriptService.list(filter, search, sort, pagination);
        return scriptMapper.toConnection(result);
    }

    @DgsMutation
    public ScriptResponse createScript(@InputArgument @Valid CreateScriptInput input) {
        return scriptService.create(input);
    }

    @DgsMutation
    public ScriptResponse updateScript(@InputArgument @Valid UpdateScriptInput input) {
        return scriptService.update(input);
    }

    @DgsMutation
    public String deleteScript(@InputArgument @NotBlank String id) {
        return scriptService.delete(id);
    }

    @DgsMutation
    public DispatchResponse runScript(@InputArgument @Valid RunScriptInput input) {
        return scriptDispatchService.runScript(input);
    }

    @DgsMutation
    public DispatchResponse batchRunScript(@InputArgument @Valid BatchRunScriptInput input) {
        return scriptDispatchService.batchRunScript(input);
    }

    /** Resolves the {@code Script.tags} field, batched per request via the data loader. */
    @DgsData(parentType = "Script", field = "tags")
    public CompletableFuture<List<Tag>> tags(DgsDataFetchingEnvironment dfe) {
        ScriptResponse script = dfe.getSource();
        DataLoader<String, List<Tag>> loader = dfe.getDataLoader("scriptTagDataLoader");
        return loader.load(script.getId());
    }
}
