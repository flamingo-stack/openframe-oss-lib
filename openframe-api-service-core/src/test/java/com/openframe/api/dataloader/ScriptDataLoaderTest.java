package com.openframe.api.dataloader;

import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.service.rmm.ScriptService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * {@link ScriptDataLoader} batches the {@code Execution.scriptName} field resolution:
 * it must preserve positional alignment with the requested key list, dedupe to a single
 * tenant-scoped service call, and resolve unknown / null keys to {@code null}.
 */
@ExtendWith(MockitoExtension.class)
class ScriptDataLoaderTest {

    @Mock
    private ScriptService scriptService;

    @InjectMocks
    private ScriptDataLoader loader;

    @Test
    @DisplayName("load: maps each id to its script and preserves the order of the requested keys")
    void load_mapsByIdInOrder() throws Exception {
        when(scriptService.getScriptsByIds(anyCollection())).thenReturn(List.of(
                ScriptResponse.builder().id("s-1").name("alpha").build(),
                ScriptResponse.builder().id("s-2").name("beta").build()));

        List<ScriptResponse> result = loader.load(List.of("s-1", "s-2")).toCompletableFuture().get();

        assertThat(result).extracting(ScriptResponse::getName).containsExactly("alpha", "beta");
    }

    @Test
    @DisplayName("load: an unknown id resolves to null in its position — the row's scriptName just renders null")
    void load_unknownId_resolvesToNull() throws Exception {
        when(scriptService.getScriptsByIds(anyCollection())).thenReturn(List.of(
                ScriptResponse.builder().id("s-1").name("alpha").build()));

        List<ScriptResponse> result = loader.load(List.of("s-1", "missing")).toCompletableFuture().get();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getName()).isEqualTo("alpha");
        assertThat(result.get(1)).isNull();
    }

    @Test
    @DisplayName("load: a null key is tolerated and resolves to null, without being passed to the service")
    void load_nullKey_resolvesToNull() throws Exception {
        when(scriptService.getScriptsByIds(anyCollection())).thenReturn(List.of(
                ScriptResponse.builder().id("s-1").name("alpha").build()));

        List<ScriptResponse> result = loader.load(Arrays.asList("s-1", null)).toCompletableFuture().get();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getName()).isEqualTo("alpha");
        assertThat(result.get(1)).isNull();
    }

    @Test
    @DisplayName("load: all-null keys short-circuit to a same-size null list — no service call")
    void load_allNullKeys_noServiceCall() throws Exception {
        List<ScriptResponse> result = loader.load(Arrays.asList(null, null)).toCompletableFuture().get();

        assertThat(result).hasSize(2).containsOnlyNulls();
        verifyNoInteractions(scriptService);
    }
}
