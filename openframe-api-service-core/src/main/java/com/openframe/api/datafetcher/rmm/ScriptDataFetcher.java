package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.data.document.tag.Tag;
import com.openframe.security.authentication.AuthPrincipal;
import graphql.relay.Relay;
import org.dataloader.DataLoader;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.rmm.DispatchResponse;
import com.openframe.api.dto.rmm.script.BatchRunScriptInput;
import com.openframe.api.dto.rmm.script.CreateScriptInput;
import com.openframe.api.dto.rmm.script.RunScriptInput;
import com.openframe.api.dto.rmm.script.ScriptFilterInput;
import com.openframe.api.dto.rmm.script.ScriptFilterOption;
import com.openframe.api.dto.rmm.script.ScriptFilters;
import com.openframe.api.dto.rmm.script.ScriptEnvVarInput;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.rmm.script.UpdateScriptInput;
import com.openframe.api.mapper.ScriptEnvVarMapper;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLScriptMapper;
import com.openframe.api.service.rmm.script.ScriptDispatchService;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.api.service.rmm.script.ScriptFilterService;
import com.openframe.api.service.rmm.script.ScriptService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class ScriptDataFetcher {

    private static final Relay RELAY = new Relay();

    private final ScriptService scriptService;
    private final ScriptDispatchService scriptDispatchService;
    private final ScriptFilterService scriptFilterService;
    private final GraphQLScriptMapper scriptMapper;

    @DgsQuery
    public ScriptResponse script(@InputArgument @NotBlank String id) {
        return scriptService.get(decodeId(id));
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

        // tagIds / authorIds arrive as Relay global ids (Tag / User) — decode to raw before filtering.
        if (filter != null) {
            filter.setTagIds(decodeIds(filter.getTagIds()));
            filter.setAuthorIds(decodeIds(filter.getAuthorIds()));
        }
        ConnectionArgs args = ConnectionArgs.builder()
                .first(first).after(after).last(last).before(before)
                .build();
        CursorPaginationCriteria pagination = scriptMapper.toCursorPaginationCriteria(args);
        CountedGenericQueryResult<ScriptResponse> result =
                scriptService.list(filter, search, sort, pagination);
        return scriptMapper.toConnection(result);
    }

    @DgsQuery
    public ScriptFilters scriptFilters(@InputArgument @Valid ScriptFilterInput filter) {
        if (filter != null) {
            filter.setTagIds(decodeIds(filter.getTagIds()));
            filter.setAuthorIds(decodeIds(filter.getAuthorIds()));
        }
        ScriptFilters filters = scriptFilterService.getScriptFilters(filter);
        // authors facet values are raw user ids — re-encode to User global ids so the dashboard
        // sends the same global id back in authorIds (which is decoded above).
        encodeNodeOptions(filters.getAuthors(), "User");
        return filters;
    }

    @DgsMutation
    public ScriptResponse createScript(@InputArgument @Valid CreateScriptInput input) {
        input.setTagIds(decodeIds(input.getTagIds()));
        return scriptService.create(input, getCurrentUserId());
    }

    @DgsMutation
    public ScriptResponse updateScript(@InputArgument @Valid UpdateScriptInput input) {
        input.setId(decodeId(input.getId()));
        input.setTagIds(decodeIds(input.getTagIds()));
        return scriptService.update(input);
    }

    @DgsMutation
    public String deleteScript(@InputArgument @NotBlank String id) {
        return scriptService.delete(decodeId(id));
    }

    @DgsMutation
    public ScriptResponse archiveScript(@InputArgument @NotBlank String id) {
        return scriptService.archive(decodeId(id));
    }

    @DgsMutation
    public ScriptResponse unarchiveScript(@InputArgument @NotBlank String id) {
        return scriptService.unarchive(decodeId(id));
    }

    @DgsMutation
    public DispatchResponse runScript(@InputArgument @Valid RunScriptInput input) {
        input.setScriptId(decodeId(input.getScriptId()));
        return scriptDispatchService.runScript(input, getCurrentUserId(), ExecutionSource.MANUAL);
    }

    @DgsMutation
    public DispatchResponse batchRunScript(@InputArgument @Valid BatchRunScriptInput input) {
        input.setScriptId(decodeId(input.getScriptId()));
        return scriptDispatchService.batchRunScript(input, getCurrentUserId(), ExecutionSource.MANUAL);
    }

    @DgsData(parentType = "Script", field = "id")
    public String scriptNodeId(DgsDataFetchingEnvironment dfe) {
        ScriptResponse script = dfe.getSource();
        return RELAY.toGlobalId("Script", script.getId());
    }

    private static String decodeId(String globalId) {
        return globalId == null ? null : RELAY.fromGlobalId(globalId).getId();
    }

    private static List<String> decodeIds(List<String> globalIds) {
        return globalIds == null ? null : globalIds.stream().map(ScriptDataFetcher::decodeId).toList();
    }

    private static void encodeNodeOptions(List<ScriptFilterOption> options, String nodeType) {
        if (options == null) {
            return;
        }
        options.forEach(o -> o.setValue(RELAY.toGlobalId(nodeType, o.getValue())));
    }

    @DgsData(parentType = "Script", field = "envVars")
    public List<ScriptEnvVarInput> envVars(DgsDataFetchingEnvironment dfe) {
        ScriptResponse script = dfe.getSource();
        return ScriptEnvVarMapper.mask(script.getEnvVars());
    }

    /** Resolves the {@code Script.tags} field, batched per request via the data loader. */
    @DgsData(parentType = "Script", field = "tags")
    public CompletableFuture<List<Tag>> tags(DgsDataFetchingEnvironment dfe) {
        ScriptResponse script = dfe.getSource();
        DataLoader<String, List<Tag>> loader = dfe.getDataLoader("scriptTagDataLoader");
        return loader.load(script.getId());
    }

    @DgsData(parentType = "Script", field = "author")
    public CompletableFuture<UserResponse> author(DgsDataFetchingEnvironment dfe) {
        ScriptResponse script = dfe.getSource();
        if (script.getCreatedBy() == null) {
            return CompletableFuture.completedFuture(null);
        }
        DataLoader<String, UserResponse> loader = dfe.getDataLoader("userDataLoader");
        return loader.load(script.getCreatedBy());
    }

    private String getCurrentUserId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return AuthPrincipal.fromJwt((Jwt) auth.getPrincipal()).getId();
    }
}
