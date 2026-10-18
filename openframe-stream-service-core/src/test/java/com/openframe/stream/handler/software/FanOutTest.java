package com.openframe.stream.handler.software;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

class FanOutTest {

    @Test
    void saveInChunks_emptyList_neverCallsSaveAll() {
        List<List<Integer>> batches = new ArrayList<>();
        FanOut.saveInChunks(List.<Integer>of(), batches::add);
        assertThat(batches).isEmpty();
    }

    @Test
    void saveInChunks_belowChunk_savesOnce() {
        List<Integer> rows = IntStream.range(0, 10).boxed().toList();
        List<List<Integer>> batches = new ArrayList<>();

        FanOut.saveInChunks(rows, b -> batches.add(List.copyOf(b)));

        assertThat(batches).hasSize(1);
        assertThat(batches.get(0)).hasSize(10);
    }

    @Test
    void saveInChunks_aboveChunk_splitsIntoFixedSizeBatches() {
        int total = FanOut.CHUNK + 1;
        List<Integer> rows = IntStream.range(0, total).boxed().toList();
        List<List<Integer>> batches = new ArrayList<>();

        FanOut.saveInChunks(rows, b -> batches.add(List.copyOf(b)));

        assertThat(batches).hasSize(2);
        assertThat(batches.get(0)).hasSize(FanOut.CHUNK);
        assertThat(batches.get(1)).hasSize(1);
        assertThat(batches.stream().mapToInt(List::size).sum()).isEqualTo(total);
    }
}
