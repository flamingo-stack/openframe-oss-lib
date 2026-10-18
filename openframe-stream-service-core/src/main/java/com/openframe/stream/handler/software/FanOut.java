package com.openframe.stream.handler.software;

import lombok.experimental.UtilityClass;

import java.util.List;
import java.util.function.Consumer;

@UtilityClass
public class FanOut {

    static final int CHUNK = 500;

    static <T> void saveInChunks(List<T> rows, Consumer<List<T>> saveAll) {
        for (int from = 0; from < rows.size(); from += CHUNK) {
            saveAll.accept(rows.subList(from, Math.min(rows.size(), from + CHUNK)));
        }
    }
}
