package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.service.rmm.ScriptService;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.stream.Collectors;

/**
 * DataLoader for batch-loading {@link ScriptResponse} objects by id. Used by the
 * {@code Execution.scriptName} field resolver to resolve a script's display name
 * at read time instead of snapshotting it onto every History row.
 *
 * <p>Goes through {@link ScriptService#getScriptsByIds} so the lookup is
 * tenant-scoped and deliberately includes soft-deleted scripts (History must
 * keep resolving the name of a since-deleted script). Unknown ids resolve to
 * {@code null}, preserving positional alignment with the requested key list.
 */
@DgsDataLoader(name = "scriptDataLoader")
@RequiredArgsConstructor
public class ScriptDataLoader implements BatchLoader<String, ScriptResponse> {

    private final ScriptService scriptService;

    @Override
    public CompletionStage<List<ScriptResponse>> load(List<String> scriptIds) {
        return CompletableFuture.supplyAsync(() -> {
            Set<String> nonNullIds = scriptIds.stream()
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            if (nonNullIds.isEmpty()) {
                return scriptIds.stream()
                        .map(id -> (ScriptResponse) null)
                        .collect(Collectors.toList());
            }

            Map<String, ScriptResponse> byId = scriptService.getScriptsByIds(nonNullIds).stream()
                    .collect(Collectors.toMap(ScriptResponse::getId, s -> s));

            return scriptIds.stream()
                    .map(id -> id == null ? null : byId.get(id))
                    .collect(Collectors.toList());
        });
    }
}
