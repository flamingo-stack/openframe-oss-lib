package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.api.service.ScriptTagService;
import com.openframe.data.document.tag.Tag;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;

/**
 * Batches {@code Script.tags} resolution so a list of scripts costs a single
 * tag-assignment lookup. Mirrors {@code KnowledgeBaseTagDataLoader}.
 */
@DgsDataLoader(name = "scriptTagDataLoader")
@RequiredArgsConstructor
public class ScriptTagDataLoader implements BatchLoader<String, List<Tag>> {

    private final ScriptTagService scriptTagService;

    @Override
    public CompletionStage<List<List<Tag>>> load(List<String> scriptIds) {
        return CompletableFuture.supplyAsync(() -> scriptTagService.getTagsByScriptIds(scriptIds));
    }
}
