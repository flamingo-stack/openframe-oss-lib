package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsData;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.netflix.graphql.dgs.DgsMutation;
import com.netflix.graphql.dgs.DgsQuery;
import com.netflix.graphql.dgs.InputArgument;
import com.openframe.api.dto.user.UserResponse;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.data.document.tag.Tag;
import com.openframe.security.authentication.AuthPrincipal;
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
import com.openframe.data.document.rmm.script.ScriptCreationSource;
import com.openframe.api.service.rmm.script.ScriptFilterService;
import com.openframe.api.service.rmm.script.ScriptService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.annotation.Validated;

import static com.openframe.graphql.relay.NodeType.SCRIPT;
import static com.openframe.graphql.relay.NodeType.TAG;
import static com.openframe.graphql.relay.NodeType.USER;

@DgsComponent
@RequiredArgsConstructor
@Slf4j
@Validated
public class ScriptDataFetcher {

    private final ScriptService scriptService;
    private final ScriptDispatchService scriptDispatchService;
    private final ScriptFilterService scriptFilterService;
    private final GraphQLScriptMapper scriptMapper;
    private final RelayIdCodec relayIdCodec;

    @DgsQuery
    public ScriptResponse script(@InputArgument @NotBlank String id) {
        String scriptId = relayIdCodec.decode(id, SCRIPT);
        return scriptService.get(scriptId);
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

        decodeFilterIds(filter);
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
        decodeFilterIds(filter);
        ScriptFilters filters = scriptFilterService.getScriptFilters(filter);
        // authors facet values are raw user ids — re-encode to User global ids so the dashboard
        // sends the same global id back in authorIds (which is decoded above).
        List<ScriptFilterOption> authors = filters.getAuthors();
        encodeNodeOptions(authors, USER);
        return filters;
    }

    @DgsMutation
    public ScriptResponse createScript(@InputArgument @Valid CreateScriptInput input) {
        List<String> tagGlobalIds = input.getTagIds();
        List<String> tagIds = relayIdCodec.decodeAll(tagGlobalIds, TAG);
        input.setTagIds(tagIds);
        String userId = getCurrentUserId();
        return scriptService.create(input, userId, ScriptCreationSource.MANUAL);
    }

    @DgsMutation
    public ScriptResponse updateScript(@InputArgument @Valid UpdateScriptInput input) {
        String scriptGlobalId = input.getId();
        List<String> tagGlobalIds = input.getTagIds();
        String scriptId = relayIdCodec.decode(scriptGlobalId, SCRIPT);
        List<String> tagIds = relayIdCodec.decodeAll(tagGlobalIds, TAG);
        input.setId(scriptId);
        input.setTagIds(tagIds);
        return scriptService.update(input);
    }

    @DgsMutation
    public String deleteScript(@InputArgument @NotBlank String id) {
        String scriptId = relayIdCodec.decode(id, SCRIPT);
        return scriptService.delete(scriptId);
    }

    @DgsMutation
    public ScriptResponse archiveScript(@InputArgument @NotBlank String id) {
        String scriptId = relayIdCodec.decode(id, SCRIPT);
        return scriptService.archive(scriptId);
    }

    @DgsMutation
    public ScriptResponse unarchiveScript(@InputArgument @NotBlank String id) {
        String scriptId = relayIdCodec.decode(id, SCRIPT);
        return scriptService.unarchive(scriptId);
    }

    @DgsMutation
    public DispatchResponse runScript(@InputArgument @Valid RunScriptInput input) {
        String scriptGlobalId = input.getScriptId();
        String scriptId = relayIdCodec.decode(scriptGlobalId, SCRIPT);
        input.setScriptId(scriptId);
        String userId = getCurrentUserId();
        return scriptDispatchService.runScript(input, userId, ExecutionSource.MANUAL);
    }

    @DgsMutation
    public DispatchResponse batchRunScript(@InputArgument @Valid BatchRunScriptInput input) {
        String scriptGlobalId = input.getScriptId();
        String scriptId = relayIdCodec.decode(scriptGlobalId, SCRIPT);
        input.setScriptId(scriptId);
        String userId = getCurrentUserId();
        return scriptDispatchService.batchRunScript(input, userId, ExecutionSource.MANUAL);
    }

    // tagIds / authorIds arrive as Relay global ids (Tag / User) — decode to raw before filtering.
    private void decodeFilterIds(ScriptFilterInput filter) {
        if (filter == null) {
            return;
        }
        List<String> tagGlobalIds = filter.getTagIds();
        List<String> authorGlobalIds = filter.getAuthorIds();
        List<String> tagIds = relayIdCodec.decodeAll(tagGlobalIds, TAG);
        List<String> authorIds = relayIdCodec.decodeAll(authorGlobalIds, USER);
        filter.setTagIds(tagIds);
        filter.setAuthorIds(authorIds);
    }

    private void encodeNodeOptions(List<ScriptFilterOption> options, NodeType nodeType) {
        if (options == null) {
            return;
        }
        options.forEach(option -> encodeNodeOption(option, nodeType));
    }

    private void encodeNodeOption(ScriptFilterOption option, NodeType nodeType) {
        String rawId = option.getValue();
        String globalId = relayIdCodec.encode(nodeType, rawId);
        option.setValue(globalId);
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
