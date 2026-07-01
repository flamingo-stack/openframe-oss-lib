package com.openframe.api.datafetcher;

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
import com.openframe.api.dto.script.BatchRunScriptInput;
import com.openframe.api.dto.script.CreateScriptInput;
import com.openframe.api.dto.script.RunScriptInput;
import com.openframe.api.dto.script.ScriptFilterInput;
import com.openframe.api.dto.script.ScriptFilters;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.script.UpdateScriptInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.mapper.GraphQLScriptMapper;
import com.openframe.api.service.rmm.ScriptDispatchService;
import com.openframe.api.service.rmm.ScriptFilterService;
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
        return scriptFilterService.getScriptFilters(filter);
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
        return scriptDispatchService.runScript(input, getCurrentUserId());
    }

    @DgsMutation
    public DispatchResponse batchRunScript(@InputArgument @Valid BatchRunScriptInput input) {
        input.setScriptId(decodeId(input.getScriptId()));
        return scriptDispatchService.batchRunScript(input, getCurrentUserId());
    }

    /** Returns the Relay global id (Base64 "Script:&lt;rawId&gt;") for the {@code id} field. */
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

    /** Resolves the {@code Script.tags} field, batched per request via the data loader. */
    @DgsData(parentType = "Script", field = "tags")
    public CompletableFuture<List<Tag>> tags(DgsDataFetchingEnvironment dfe) {
        ScriptResponse script = dfe.getSource();
        DataLoader<String, List<Tag>> loader = dfe.getDataLoader("scriptTagDataLoader");
        return loader.load(script.getId());
    }

    /** Resolves the {@code Script.author} field from {@code createdBy}, batched via the user loader. */
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
